import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get("ID_DO_CLIENTE_DO_CALENDARIO_DO_GOOGLE")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabaseClient(authHeader?: string) {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id ?? null;
}


async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: tokenData } = await supabase.from("google_calendar_tokens").select("*").eq("user_id", userId).single();
  if (!tokenData) return null;
  if (new Date(tokenData.expires_at) > new Date()) return tokenData.access_token;

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok || refreshed.error || !refreshed.access_token) return null;
  await supabase.from("google_calendar_tokens").update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  }).eq("user_id", userId);
  return refreshed.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const supabase = getSupabaseClient();

    // OAuth callback does NOT require auth (comes from Google redirect)
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      if (!code || !stateRaw) {
        return new Response("Missing code or state", { status: 400, headers: corsHeaders });
      }

      const state = JSON.parse(atob(stateRaw));
      const callbackUserId = state.user_id;
      const redirectUri = state.redirect_uri || "https://spc-vision-boost.lovable.app";

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-calendar?action=callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      console.log("Token exchange response status:", tokenRes.status);
      if (tokens.error) {
        console.error("Token error:", tokens.error, tokens.error_description);
        return new Response(`Token error: ${tokens.error_description}`, { status: 400, headers: corsHeaders });
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await supabase.from("google_calendar_tokens").upsert({
        user_id: callbackUserId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || "",
        expires_at: expiresAt,
      }, { onConflict: "user_id" });

      console.log("Tokens saved for user:", callbackUserId);

      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${redirectUri}/agenda?gcal=connected` },
      });
    }

    // All other actions require authentication
    const userId = await getUserId(req);

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: "No valid session token found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manager-only summary: read today's events directly from each Atendimento user's connected Google Calendar.
    if (action === "team-events") {
      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (roleError || roleRow?.role !== "gestor") {
        return new Response(JSON.stringify({ error: "Acesso permitido somente ao gestor." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timeMin = url.searchParams.get("timeMin");
      const timeMax = url.searchParams.get("timeMax");
      if (!timeMin || !timeMax) {
        return new Response(JSON.stringify({ error: "Informe timeMin e timeMax para o dia consultado." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: roles }, { data: profileRows }, { data: tokenRows }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").eq("role", "atendimento"),
        supabase.from("profiles").select("user_id, display_name, email"),
        supabase.from("google_calendar_tokens").select("user_id"),
      ]);
      const roleUsers = roles || [];
      const profileMap = new Map((profileRows || []).map((p: any) => [p.user_id, p]));
      const connectedIds = new Set((tokenRows || []).map((t: any) => t.user_id));
      const users = await Promise.all(roleUsers.map(async (role: any) => {
        const profile: any = profileMap.get(role.user_id);
        const name = profile?.display_name || profile?.email || "Usuário do atendimento";
        if (!connectedIds.has(role.user_id)) {
          return { user_id: role.user_id, name, email: profile?.email || "", connected: false, appointments: 0, error: null };
        }

        const accessToken = await getValidAccessToken(role.user_id);
        if (!accessToken) {
          return { user_id: role.user_id, name, email: profile?.email || "", connected: false, appointments: 0, error: "Reconectar Google Calendar" };
        }

        try {
          const params = new URLSearchParams({
            timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "2500",
          });
          const response = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + params.toString(),
            { headers: { Authorization: "Bearer " + accessToken } },
          );
          const result = await response.json();
          if (!response.ok) {
            return { user_id: role.user_id, name, email: profile?.email || "", connected: true, appointments: 0, error: result.error?.message || "Não foi possível ler a agenda" };
          }
          let items = result.items || [];
          let pageToken = result.nextPageToken || "";
          while (pageToken) {
            const nextParams = new URLSearchParams({
              timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "2500", pageToken,
            });
            const nextResponse = await fetch(
              "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + nextParams.toString(),
              { headers: { Authorization: "Bearer " + accessToken } },
            );
            const nextResult = await nextResponse.json();
            if (!nextResponse.ok) break;
            items = items.concat(nextResult.items || []);
            pageToken = nextResult.nextPageToken || "";
          }
          const appointments = items.filter((event: any) => event.status !== "cancelled").length;
          return { user_id: role.user_id, name, email: profile?.email || "", connected: true, appointments, error: null };
        } catch (error) {
          return { user_id: role.user_id, name, email: profile?.email || "", connected: true, appointments: 0, error: error instanceof Error ? error.message : "Falha ao consultar agenda" };
        }
      }));

      return new Response(JSON.stringify({ users, timeMin, timeMax }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate OAuth URL
    if (action === "auth-url") {
      const redirectUri = url.searchParams.get("redirect_uri") || url.origin;
      const state = JSON.stringify({ user_id: userId, redirect_uri: redirectUri });
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", `${SUPABASE_URL}/functions/v1/google-calendar?action=callback`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", btoa(state));

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // (callback already handled above)

    // Check connection status
    if (action === "status") {
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("expires_at")
        .eq("user_id", userId)
        .single();

      return new Response(JSON.stringify({ connected: !!data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Disconnect
    if (action === "disconnect") {
      await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read the complete event details from every calendar accessible to this authenticated user.
    if (action === "events") {
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        await supabase.from("google_calendar_tokens").delete().eq("user_id", userId);
        return new Response(JSON.stringify({ error: "Token expired, reconnect", connected: false }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timeMin = url.searchParams.get("timeMin") || "1970-01-01T00:00:00.000Z";
      const timeMax = url.searchParams.get("timeMax") || "2100-01-01T00:00:00.000Z";
      const calendars: any[] = [];
      let calendarPageToken = "";
      do {
        const params = new URLSearchParams({ maxResults: "250" });
        if (calendarPageToken) params.set("pageToken", calendarPageToken);
        const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?" + params.toString(), {
          headers: { Authorization: "Bearer " + accessToken },
        });
        const result = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: result.error?.message || "Não foi possível listar agendas" }), {
            status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        calendars.push(...(result.items || []));
        calendarPageToken = result.nextPageToken || "";
      } while (calendarPageToken);

      const events: any[] = [];
      const calendarErrors: Array<{ calendar: string; error: string }> = [];
      for (const calendar of calendars) {
        let pageToken = "";
        try {
          do {
            const params = new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "2500",
            });
            if (pageToken) params.set("pageToken", pageToken);
            const endpoint = "https://www.googleapis.com/calendar/v3/calendars/" +
              encodeURIComponent(calendar.id) + "/events?" + params.toString();
            const response = await fetch(endpoint, { headers: { Authorization: "Bearer " + accessToken } });
            const result = await response.json();
            if (!response.ok) {
              calendarErrors.push({ calendar: calendar.summary || calendar.id, error: result.error?.message || "Falha ao carregar eventos" });
              break;
            }
            for (const e of (result.items || [])) {
              events.push({
                id: calendar.id + "::" + e.id,
                google_event_id: e.id,
                calendar_id: calendar.id,
                calendar_name: calendar.summary || calendar.id,
                summary: e.summary || "(Sem título)",
                start: e.start?.dateTime || e.start?.date || "",
                end: e.end?.dateTime || e.end?.date || "",
                location: e.location || "",
                description: e.description || "",
                status: e.status || "",
                htmlLink: e.htmlLink || "",
                creator: e.creator || null,
                organizer: e.organizer || null,
                attendees: e.attendees || [],
                visibility: e.visibility || "",
                transparency: e.transparency || "",
                created: e.created || "",
                updated: e.updated || "",
                recurrence: e.recurrence || [],
                recurringEventId: e.recurringEventId || "",
                reminders: e.reminders || null,
                conferenceData: e.conferenceData || null,
                attachments: e.attachments || [],
                eventType: e.eventType || "default",
                colorId: e.colorId || "",
                guestsCanInviteOthers: e.guestsCanInviteOthers,
                guestsCanModify: e.guestsCanModify,
                guestsCanSeeOtherGuests: e.guestsCanSeeOtherGuests,
                hangoutLink: e.hangoutLink || e.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === "video")?.uri || "",
              });
            }
            pageToken = result.nextPageToken || "";
          } while (pageToken);
        } catch (error) {
          calendarErrors.push({ calendar: calendar.summary || calendar.id, error: error instanceof Error ? error.message : "Falha ao carregar agenda" });
        }
      }
      events.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
      return new Response(JSON.stringify({
        events, connected: true, calendars_count: calendars.length, events_count: events.length, calendar_errors: calendarErrors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Edit a Google Calendar event in the exact calendar from which it was loaded.
    if (action === "update-event" && req.method === "POST") {
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) return new Response(JSON.stringify({ error: "Google Calendar desconectado; reconecte a conta." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const body = await req.json();
      const { calendar_id, event_id, summary, description, start_datetime, end_datetime, location, attendee_emails, all_day } = body;
      if (!calendar_id || !event_id || !summary || !start_datetime || !end_datetime) {
        return new Response(JSON.stringify({ error: "Informe agenda, evento, título, início e fim." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const googleBody: any = { summary, description: description || "", location: location || "" };
      if (all_day) {
        googleBody.start = { date: String(start_datetime).slice(0, 10) };
        googleBody.end = { date: String(end_datetime).slice(0, 10) };
      } else {
        googleBody.start = { dateTime: start_datetime, timeZone: "America/Sao_Paulo" };
        googleBody.end = { dateTime: end_datetime, timeZone: "America/Sao_Paulo" };
      }
      if (Array.isArray(attendee_emails)) {
        googleBody.attendees = attendee_emails.filter((email: unknown) => typeof email === "string" && email.includes("@")).map((email: string) => ({ email }));
      }
      const endpoint = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendar_id) +
        "/events/" + encodeURIComponent(event_id) + "?sendUpdates=all";
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(googleBody),
      });
      const result = await response.json();
      if (!response.ok) return new Response(JSON.stringify({ error: result.error?.message || "Falha ao atualizar evento no Google Calendar" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ ok: true, event: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete from Google itself, not just from the CRM display.
    if (action === "delete-event" && req.method === "POST") {
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) return new Response(JSON.stringify({ error: "Google Calendar desconectado; reconecte a conta." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const { calendar_id, event_id } = await req.json();
      if (!calendar_id || !event_id) return new Response(JSON.stringify({ error: "Informe agenda e evento." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const endpoint = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendar_id) +
        "/events/" + encodeURIComponent(event_id) + "?sendUpdates=all";
      const response = await fetch(endpoint, { method: "DELETE", headers: { Authorization: "Bearer " + accessToken } });
      if (!response.ok && response.status !== 410 && response.status !== 404) {
        const result = await response.json().catch(() => ({}));
        return new Response(JSON.stringify({ error: result.error?.message || "Falha ao excluir evento no Google Calendar" }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
