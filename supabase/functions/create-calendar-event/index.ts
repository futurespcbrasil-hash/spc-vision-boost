import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("ID_DO_CLIENTE_DO_CALENDARIO_DO_GOOGLE")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;

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
  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return null;

  let accessToken = tokenData.access_token;

  if (new Date(tokenData.expires_at) <= new Date()) {
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
    const refreshData = await refreshRes.json();
    if (refreshData.error) {
      console.error("Token refresh failed:", refreshData.error);
      return null;
    }
    accessToken = refreshData.access_token;
    await supabase.from("google_calendar_tokens").update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    }).eq("user_id", userId);
  }

  return accessToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, description, start_datetime, end_datetime, client_email } = await req.json();

    if (!title || !start_datetime || !end_datetime) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, start_datetime, end_datetime" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert event as pending
    const { data: eventRow, error: insertError } = await supabase.from("events").insert({
      user_id: userId,
      title,
      description: description || "",
      start_datetime,
      end_datetime,
      client_email: client_email || "",
      status: "pending",
    }).select().single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to sync with Google Calendar
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.log("No Google token, event saved as pending");
      return new Response(JSON.stringify({ event: eventRow, synced: false, message: "Evento salvo mas Google Calendar não conectado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestId = crypto.randomUUID();
    const googleBody = {
      summary: title,
      description: description || "",
      start: { dateTime: start_datetime, timeZone: "America/Sao_Paulo" },
      end: { dateTime: end_datetime, timeZone: "America/Sao_Paulo" },
      attendees: client_email ? [{ email: client_email }] : [],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const gcalRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleBody),
      }
    );

    const gcalData = await gcalRes.json();

    if (gcalData.error) {
      console.error("Google Calendar API error:", JSON.stringify(gcalData.error));
      await supabase.from("events").update({ status: "error" }).eq("id", eventRow.id);
      return new Response(JSON.stringify({
        event: { ...eventRow, status: "error" },
        synced: false,
        google_error: gcalData.error.message,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meetLink = gcalData.hangoutLink || null;
    const googleEventId = gcalData.id;

    const { data: updatedEvent } = await supabase.from("events").update({
      google_event_id: googleEventId,
      meet_link: meetLink,
      status: "synced",
    }).eq("id", eventRow.id).select().single();

    return new Response(JSON.stringify({ event: updatedEvent, synced: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
