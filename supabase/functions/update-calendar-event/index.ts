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
    if (refreshData.error) return null;
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

    const { event_id, title, description, start_datetime, end_datetime, client_email } = await req.json();

    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get existing event
    const { data: existing } = await supabase.from("events").select("*").eq("id", event_id).eq("user_id", userId).single();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update in DB
    const updateFields: any = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (start_datetime !== undefined) updateFields.start_datetime = start_datetime;
    if (end_datetime !== undefined) updateFields.end_datetime = end_datetime;
    if (client_email !== undefined) updateFields.client_email = client_email;

    const { data: updatedEvent } = await supabase.from("events").update(updateFields).eq("id", event_id).select().single();

    // Update in Google if synced
    if (existing.google_event_id) {
      const accessToken = await getValidAccessToken(userId);
      if (accessToken) {
        const googleBody: any = {};
        if (title !== undefined) googleBody.summary = title;
        if (description !== undefined) googleBody.description = description;
        if (start_datetime !== undefined) googleBody.start = { dateTime: start_datetime, timeZone: "America/Sao_Paulo" };
        if (end_datetime !== undefined) googleBody.end = { dateTime: end_datetime, timeZone: "America/Sao_Paulo" };
        if (client_email !== undefined) googleBody.attendees = client_email ? [{ email: client_email }] : [];

        const gcalRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existing.google_event_id}?sendUpdates=all`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleBody),
          }
        );

        if (!gcalRes.ok) {
          const errData = await gcalRes.json();
          console.error("Google update error:", JSON.stringify(errData));
          await supabase.from("events").update({ status: "error" }).eq("id", event_id);
        }
      }
    }

    return new Response(JSON.stringify({ event: updatedEvent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
