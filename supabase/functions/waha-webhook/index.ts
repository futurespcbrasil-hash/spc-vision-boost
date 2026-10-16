import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const str = (v: unknown) => typeof v === "string" ? v : "";
const cleanWebhookSecret = (value: string | null | undefined) =>
  (value || "").split(/\r?\n/)[0].replace(/\s+Copiar chave.*$/i, "").trim();

const timestamp = (v: unknown) => {
  if (typeof v === "number") return new Date(v < 10_000_000_000 ? v * 1000 : v).toISOString();
  if (typeof v === "string" && v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return new Date(n < 10_000_000_000 ? n * 1000 : n).toISOString();
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = cleanWebhookSecret(Deno.env.get("WAHA_WEBHOOK_SECRET"));
  const supplied = cleanWebhookSecret(new URL(req.url).searchParams.get("token") || req.headers.get("X-WAHA-Webhook-Secret"));
  if (!secret || !supplied || supplied !== secret) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server not configured" }, 500);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  let event: any;
  try { event = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const eventName = str(event?.event);
  if (!["message", "message.any", "message.ack", "state.change", "session.status"].includes(eventName)) {
    return json({ accepted: true, ignored: true });
  }

  const session = str(event?.session);
  if (!session) return json({ accepted: true, ignored: true });
  const { data: instance, error: instanceError } = await db.from("whatsapp_instances")
    .select("id,owner_id,provider_instance_name").eq("provider", "waha").eq("provider_instance_name", session).maybeSingle();
  if (instanceError) return json({ error: "Database lookup failed" }, 500);
  if (!instance) return json({ accepted: true, ignored: true });

  const payload = event?.payload || {};
  if (eventName === "state.change" || eventName === "session.status") {
    const state = str(payload?.status || payload?.state || payload?.name).toUpperCase();
    const status = ["WORKING", "CONNECTED", "OPEN"].includes(state) ? "connected"
      : state.includes("QR") ? "qr"
      : ["STARTING", "SCAN_QR_CODE"].includes(state) ? "connecting"
      : ["STOPPED", "FAILED", "DISCONNECTED"].includes(state) ? "disconnected" : null;
    if (status) await db.from("whatsapp_instances").update({
      status, last_status_at: new Date().toISOString(),
    }).eq("id", instance.id);
    return json({ accepted: true });
  }

  if (eventName === "message.ack") return json({ accepted: true });

  const fromMe = payload?.fromMe === true || payload?.from_me === true || payload?.key?.fromMe === true;
  // Em alguns eventos message.any de saída, WAHA fornece chatId mas não preenche to.
  const candidateRemote = str(fromMe
    ? payload?.to || payload?.chatId || payload?.chat_id || payload?._data?.id?.remote
    : payload?.from || payload?.chatId || payload?.chat_id);
  // payload.id é o ID DA MENSAGEM, não o ID da conversa.
  const waChatId = str(payload?.chatId || payload?.chat_id || payload?._data?.id?.remote || candidateRemote);
  if (!waChatId) return json({ accepted: true, ignored: true });
  const remote = candidateRemote || waChatId;
  const phoneSource = candidateRemote && !candidateRemote.endsWith("@lid") ? candidateRemote : waChatId;
  const contactNumber = phoneSource.split("@")[0].replace(/\D/g, "");
  const incomingName = str(payload?._data?.notifyName || payload?._data?.pushName || payload?.pushName || payload?.notifyName);
  const body = str(payload?.body || payload?.text);
  const rawType = str(payload?.type || payload?.media?.mimetype).toLowerCase();
  const messageType = rawType.includes("image") ? "image" : rawType.includes("audio") || rawType.includes("ptt") ? "audio"
    : rawType.includes("video") ? "video" : payload?.hasMedia ? "document" : "text";
  const sentAt = timestamp(payload?.timestamp || payload?.t);
  const mediaUrl = str(payload?.media?.url || payload?.mediaUrl) || null;
  const avatar = str(payload?._data?.profilePicThumbObj?.eurl || payload?.profilePictureUrl) || null;

  let { data: existingChat } = await db.from("whatsapp_chats").select("id,unread_count,contact_number,contact_name,wa_chat_id")
    .eq("instance_id", instance.id).eq("wa_chat_id", waChatId).maybeSingle();
  // Se a WAHA alternar entre JID telefônico e LID, reutilize a conversa pelo telefone conhecido.
  if (!existingChat && contactNumber.length >= 10 && !waChatId.endsWith("@g.us")) {
    const lookup = await db.from("whatsapp_chats").select("id,unread_count,contact_number,contact_name,wa_chat_id")
      .eq("instance_id", instance.id).eq("contact_number", contactNumber).eq("is_group", false).limit(1).maybeSingle();
    existingChat = lookup.data;
  }
  const persistedContactNumber = waChatId.endsWith("@lid") && existingChat?.contact_number
    ? existingChat.contact_number : contactNumber;
  const previousName = str(existingChat?.contact_name);
  const previousNumber = str(existingChat?.contact_number).replace(/\D/g, "");
  const contactName = incomingName || (previousName && previousName.replace(/\D/g, "") !== previousNumber ? previousName : "") || persistedContactNumber;
  let chatId = existingChat?.id as string | undefined;
  if (chatId) {
    await db.from("whatsapp_chats").update({
      contact_number: persistedContactNumber, contact_name: contactName, avatar_url: avatar,
      last_message: body || (messageType !== "text" ? `[${messageType}]` : ""),
      last_message_at: sentAt, unread_count: fromMe ? (existingChat?.unread_count || 0) : (existingChat?.unread_count || 0) + 1,
      is_group: waChatId.endsWith("@g.us"), updated_at: new Date().toISOString(),
    }).eq("id", chatId);
  } else {
    const { data: inserted, error } = await db.from("whatsapp_chats").insert({
      instance_id: instance.id, wa_chat_id: waChatId, contact_number: persistedContactNumber,
      contact_name: contactName, avatar_url: avatar,
      last_message: body || (messageType !== "text" ? `[${messageType}]` : ""),
      last_message_at: sentAt, unread_count: fromMe ? 0 : 1,
      is_group: waChatId.endsWith("@g.us"), archived: false,
    }).select("id").single();
    if (error) return json({ error: "Failed to persist chat" }, 500);
    chatId = inserted.id;
  }

  const messageId = str(payload?.id?._serialized || payload?.id || payload?.key?.id);
  if (messageId) {
    const { data: duplicate } = await db.from("whatsapp_messages").select("id").eq("instance_id", instance.id).eq("wa_message_id", messageId).maybeSingle();
    if (!duplicate) {
      const { error } = await db.from("whatsapp_messages").insert({
        chat_id: chatId, instance_id: instance.id, wa_message_id: messageId,
        from_me: fromMe, sender: fromMe ? "me" : str(payload?.participant || payload?._data?.id?.participant) || contactNumber,
        message_type: messageType, text: body, media_url: mediaUrl,
        media_mime: str(payload?.media?.mimetype) || null,
        media_filename: str(payload?.media?.filename) || null,
        status: "received", timestamp: sentAt, raw: payload,
        sent_by: fromMe ? instance.owner_id : null,
      });
      if (error) return json({ error: "Failed to persist message" }, 500);
    }
  }
  return json({ accepted: true });
});
