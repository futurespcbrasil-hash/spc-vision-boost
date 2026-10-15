import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const wahaUrl = Deno.env.get("WAHA_API_URL")?.replace(/\/+$/, "");
  const wahaKey = Deno.env.get("WAHA_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase não está configurado no servidor." }, 500);
  if (!wahaUrl || !wahaKey) return json({ error: "WAHA ainda não configurada. Defina WAHA_API_URL e WAHA_API_KEY nos secrets do Supabase." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Autenticação necessária." }, 401);
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const action = String(body.action || "");
  const instanceId = typeof body.instance_id === "string" ? body.instance_id : "";
  const number = typeof body.number === "string" ? body.number : "";
  const sessionFromBody = typeof body.session === "string" ? body.session : "";

  const callWaha = async (path: string, method = "GET", payload?: unknown) => {
    const response = await fetch(`${wahaUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Api-Key": wahaKey },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const raw = await response.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!response.ok) throw new Error(data?.message || data?.error || `WAHA respondeu HTTP ${response.status}`);
    return data;
  };

  const getOwnedInstance = async () => {
    if (!instanceId) throw new Error("instance_id é obrigatório.");
    const { data, error } = await db.from("whatsapp_instances").select("*").eq("id", instanceId).eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Instância não encontrada ou sem permissão.");
    if (data.provider === "waha" && data.provider_instance_name) return data;

    // Migração sob demanda: cria uma sessão WAHA nova e preserva o ID antigo da Ryze
    // para auditoria/rollback. Não apaga nem modifica a sessão antiga no provedor anterior.
    const safeName = String(data.name || "whatsapp").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "whatsapp";
    const newSession = `u${user.id.replaceAll("-", "").slice(0, 8)}-${safeName}-${crypto.randomUUID().slice(0, 6)}`;
    await callWaha("/api/sessions", "POST", { name: newSession, start: false, config: { webhooks: [] } });
    const { data: migrated, error: migrationError } = await db.from("whatsapp_instances")
      .update({ provider: "waha", provider_instance_name: newSession, status: "created", qr_code: null })
      .eq("id", data.id).eq("owner_id", user.id).select("*").single();
    if (migrationError) {
      await callWaha(`/api/sessions/${encodeURIComponent(newSession)}`, "DELETE").catch(() => null);
      throw migrationError;
    }
    return migrated;
  };
  const normalizeStatus = (status: string) => {
    if (["WORKING", "SCAN_QR_CODE", "STARTING", "STOPPED", "FAILED"].includes(status)) {
      return ({ WORKING: "connected", SCAN_QR_CODE: "qr", STARTING: "connecting", STOPPED: "disconnected", FAILED: "disconnected" } as Record<string, string>)[status];
    }
    return status?.toLowerCase() || "unknown";
  };

  try {
    switch (action) {
      case "sync_instances": {
        const { data, error } = await db.from("whatsapp_instances").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ instances: data || [] });
      }
      case "create_instance": {
        const name = String(body.name || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
        if (!name) return json({ error: "Informe um nome válido para a instância." }, 400);
        const session = `u${user.id.replaceAll("-", "").slice(0, 8)}-${name}-${crypto.randomUUID().slice(0, 6)}`;
        await callWaha("/api/sessions", "POST", { name: session, start: false, config: { webhooks: [] } });
        const { data, error } = await db.from("whatsapp_instances").insert({
          owner_id: user.id, name: String(body.name).trim(), provider: "waha",
          provider_instance_name: session, ryze_instance_id: session, status: "created",
        }).select("*").single();
        if (error) {
          await callWaha(`/api/sessions/${encodeURIComponent(session)}`, "DELETE").catch(() => null);
          throw error;
        }
        return json({ instance: data });
      }
      case "connect": {
        const inst = await getOwnedInstance();
        const session = encodeURIComponent(inst.provider_instance_name);
        let status = await callWaha(`/api/sessions/${session}`).catch(() => null);
        if (!status || ["STOPPED", "FAILED"].includes(String(status.status))) {
          await callWaha(`/api/sessions/${session}/start`, "POST", {});
          status = await callWaha(`/api/sessions/${session}`).catch(() => status);
        }
        const qr = await callWaha(`/api/${session}/auth/qr?format=raw`).catch(() => null);
        const qrValue = typeof qr === "string" ? qr : qr?.data || qr?.value || qr?.qr || null;
        const normalized = normalizeStatus(String(status?.status || "STARTING"));
        await db.from("whatsapp_instances").update({ status: normalized, qr_code: qrValue }).eq("id", inst.id).eq("owner_id", user.id);
        return json({ status: normalized, qr: qrValue, raw: status, already_connected: normalized === "connected", instance: inst });
      }
      case "status": {
        const inst = await getOwnedInstance();
        const session = encodeURIComponent(inst.provider_instance_name);
        const status = await callWaha(`/api/sessions/${session}`);
        const normalized = normalizeStatus(String(status?.status || "unknown"));
        const phone = status?.me?.id?.split("@")[0] || status?.me?.id || inst.phone || null;
        await db.from("whatsapp_instances").update({ status: normalized, phone, qr_code: normalized === "connected" ? null : inst.qr_code, last_status_at: new Date().toISOString() }).eq("id", inst.id).eq("owner_id", user.id);
        return json({ status: normalized, phone, raw: status });
      }
      case "disconnect": {
        const inst = await getOwnedInstance();
        await callWaha(`/api/sessions/${encodeURIComponent(inst.provider_instance_name)}/stop`, "POST", {});
        await db.from("whatsapp_instances").update({ status: "disconnected", qr_code: null }).eq("id", inst.id).eq("owner_id", user.id);
        return json({ success: true, status: "disconnected" });
      }
      case "delete_instance": {
        const inst = await getOwnedInstance();
        await callWaha(`/api/sessions/${encodeURIComponent(inst.provider_instance_name)}`, "DELETE").catch((e) => {
          if (!String(e.message).includes("404")) throw e;
        });
        const { error } = await db.from("whatsapp_instances").delete().eq("id", inst.id).eq("owner_id", user.id);
        if (error) throw error;
        return json({ success: true });
      }
      case "register_webhook": {
        const inst = await getOwnedInstance();
        const hookUrl = Deno.env.get("WAHA_WEBHOOK_URL");
        const hookSecret = Deno.env.get("WAHA_WEBHOOK_SECRET");
        if (!hookUrl || !hookSecret) return json({ error: "Defina WAHA_WEBHOOK_URL e WAHA_WEBHOOK_SECRET nos secrets do Supabase." }, 503);
        const target = new URL(hookUrl);
        target.searchParams.set("token", hookSecret);
        await callWaha(`/api/sessions/${encodeURIComponent(inst.provider_instance_name)}`, "PUT", { config: { webhooks: [{ url: target.toString(), events: ["message", "message.any", "message.ack", "state.change", "session.status"] }] } });
        return json({ success: true });
      }
      case "send_text": {
        const inst = await getOwnedInstance();
        if (!number || typeof body.text !== "string" || !body.text.trim()) return json({ error: "Número e texto são obrigatórios." }, 400);
        const chatId = number.includes("@") ? number : `${number.replace(/\D/g, "")}@c.us`;
        const result = await callWaha("/api/sendText", "POST", { session: inst.provider_instance_name, chatId, text: body.text });
        return json(result);
      }
      case "send_media": {
        const inst = await getOwnedInstance();
        if (!number || typeof body.media_url !== "string" || !body.media_url) return json({ error: "Número e URL da mídia são obrigatórios." }, 400);
        const chatId = number.includes("@") ? number : `${number.replace(/\D/g, "")}@c.us`;
        const mediaType = String(body.media_type || "document");
        const mimetype = typeof body.media_mime === "string" ? body.media_mime : "application/octet-stream";
        const filename = typeof body.filename === "string" ? body.filename : "arquivo";
        const payload: Record<string, unknown> = { session: inst.provider_instance_name, chatId, file: { url: body.media_url, mimetype, filename } };
        if (typeof body.caption === "string" && body.caption) payload.caption = body.caption;
        const result = await callWaha("/api/sendFile", "POST", payload);
        return json({ ...result, media_type: mediaType });
      }
      case "get_chats": {
        const inst = await getOwnedInstance();
        const chats = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/chats`);
        return json({ chats });
      }
      case "get_contacts": {
        const inst = await getOwnedInstance();
        const contacts = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/contacts`);
        return json({ contacts });
      }
      case "get_messages": {
        const inst = await getOwnedInstance();
        const chatId = typeof body.wa_chat_id === "string" ? body.wa_chat_id : "";
        if (!chatId) return json({ error: "wa_chat_id é obrigatório." }, 400);
        const messages = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/chats/${encodeURIComponent(chatId)}/messages?limit=100`);
        return json({ messages });
      }
      case "get_profile_pic": {
        const inst = await getOwnedInstance();
        const chatId = typeof body.wa_chat_id === "string" ? body.wa_chat_id : "";
        if (!chatId) return json({ error: "wa_chat_id é obrigatório." }, 400);
        const pic = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/contacts/${encodeURIComponent(chatId)}/profile-picture`).catch(() => null);
        return json({ url: pic?.url || pic?.profilePictureUrl || null });
      }
      default:
        return json({ error: `Ação não suportada: ${action}` }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na integração WAHA.";
    return json({ error: message }, 502);
  }
});
