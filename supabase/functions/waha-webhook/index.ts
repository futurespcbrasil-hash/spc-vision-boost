import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const str = (v: unknown) => typeof v === "string" ? v : "";
const collapseRepeatedPhoneDigits = (value: unknown): string => {
  const digits = String(value || "").split("@")[0].replace(/\D/g, "");
  if (digits.length % 2 === 0) {
    const half = digits.slice(0, digits.length / 2);
    if (half.length >= 10 && half.length <= 13 && half === digits.slice(digits.length / 2)) return half;
  }
  return digits;
};
const normalizeWhatsAppPhone = (value: unknown): string => {
  let digits = collapseRepeatedPhoneDigits(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 11 && digits[2] === "9") digits = digits.slice(0, 2) + digits.slice(3);
  return digits;
};

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
  return "1970-01-01T00:00:00.000Z";
};

const logDatabaseFailure = (operation: string, error: { code?: unknown } | null | undefined) => {
  // Keep customer data and provider payloads out of logs; the operation and
  // PostgreSQL error code are enough to identify failing webhook stages.
  const code = typeof error?.code === "string" ? error.code : "unknown";
  console.error("[waha-webhook] database operation failed", { operation, code });
};

const databaseFailure = (operation: string, error: { code?: unknown } | null | undefined, message: string) => {
  logDatabaseFailure(operation, error);
  return json({ error: message }, 500);
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
  if (!["message", "message.any", "message.ack", "message.revoked", "message.revoke", "message.deleted", "message.delete", "state.change", "session.status"].includes(eventName)) {
    return json({ accepted: true, ignored: true });
  }

  const session = str(event?.session);
  if (!session) return json({ accepted: true, ignored: true });
  const { data: instance, error: instanceError } = await db.from("whatsapp_instances")
    .select("id,owner_id,provider_instance_name").eq("provider", "waha").eq("provider_instance_name", session).maybeSingle();
  if (instanceError) return databaseFailure("instance_lookup", instanceError, "Database lookup failed");
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

  // Exclusões/revogações no telefone são refletidas no CRM em tempo real via Realtime.
  if (["message.revoked", "message.revoke", "message.deleted", "message.delete"].includes(eventName)) {
    const revokeId = str(payload?.revokedMessageId?._serialized || payload?.revokedMessageId ||
      payload?.messageId?._serialized || payload?.messageId || payload?.id?._serialized ||
      payload?.id || payload?.key?.id || payload?._data?.id?.id);
    if (!revokeId) return json({ accepted: true, ignored: true, reason: "missing message id" });
    const { data: oldMessage, error: findError } = await db.from("whatsapp_messages")
      .select("id,chat_id,timestamp,wa_message_id").eq("instance_id", instance.id)
      .eq("wa_message_id", revokeId).maybeSingle();
    if (findError) return databaseFailure("revoked_message_lookup", findError, "Deleted message lookup failed");
    if (!oldMessage) return json({ accepted: true, notFound: true });
    const { error: deleteError } = await db.from("whatsapp_messages")
      .update({ text: "[crm_deleted]", status: "deleted", raw: { crm_deleted: true, deleted_at: new Date().toISOString(), event: payload } })
      .eq("id", oldMessage.id);
    if (deleteError) return databaseFailure("revoke_message_update", deleteError, "Failed to delete message from CRM");
    const { data: latestRows } = await db.from("whatsapp_messages").select("text,timestamp")
      .eq("chat_id", oldMessage.chat_id).neq("text", "[crm_deleted]")
      .order("timestamp", { ascending: false }).limit(1);
    const latest = latestRows?.[0];
    await db.from("whatsapp_chats").update({
      last_message: latest ? (latest.text || "") : "",
      last_message_at: latest?.timestamp || oldMessage.timestamp,
      updated_at: new Date().toISOString(),
    }).eq("id", oldMessage.chat_id);
    return json({ accepted: true, deleted: true });
  }

  const fromMe = payload?.fromMe === true || payload?.from_me === true || payload?.key?.fromMe === true;
  // Em alguns eventos message.any de saída, WAHA fornece chatId mas não preenche to.
  const candidateRemote = str(fromMe
    ? payload?.to || payload?.chatId || payload?.chat_id || payload?._data?.id?.remote
    : payload?.from || payload?.chatId || payload?.chat_id);
  // payload.id é o ID DA MENSAGEM, não o ID da conversa.
  const waChatId = str(payload?.chatId || payload?.chat_id || payload?._data?.id?.remote || candidateRemote);
  if (!waChatId || waChatId === "status@broadcast" || waChatId.endsWith("@newsletter") || waChatId.endsWith("@broadcast")) {
    return json({ accepted: true, ignored: true });
  }
  // WAHA pode entregar message e message.any para a mesma mensagem. Deduplicar
  // antes de alterar unread_count/last_message para não contar o mesmo evento duas vezes.
  const messageId = str(payload?.id?._serialized || payload?.id || payload?.key?.id);
  if (messageId) {
    const { data: duplicate, error: duplicateError } = await db.from("whatsapp_messages")
      .select("id").eq("instance_id", instance.id).eq("wa_message_id", messageId).maybeSingle();
    if (duplicateError) return databaseFailure("message_deduplication_lookup", duplicateError, "Message deduplication lookup failed");
    if (duplicate) return json({ accepted: true, duplicate: true });
  }
  // WAHA/WhatsApp may send a private LID as the chat ID. Never treat LID digits as a phone number.
  const alternateRemote = str(
    payload?.remoteJidAlt || payload?.key?.remoteJidAlt ||
    payload?._data?.remoteJidAlt || payload?._data?.key?.remoteJidAlt ||
    payload?._data?.id?.remoteJidAlt || payload?._data?.id?._serializedAlt
  );
  const alternatePhoneJid = [alternateRemote, str(payload?.from), str(payload?.to),
    str(payload?._data?.id?.remote), str(payload?.chatId)]
    .find((value) => value.includes("@c.us") && !value.endsWith("@lid")) || "";
  const phoneSource = alternatePhoneJid ||
    (candidateRemote && !candidateRemote.endsWith("@lid") ? candidateRemote :
      (!waChatId.endsWith("@lid") ? waChatId : ""));
  const contactNumber = phoneSource ? collapseRepeatedPhoneDigits(phoneSource) : "";
  const incomingName = str(payload?._data?.notifyName || payload?._data?.pushName || payload?.pushName || payload?.notifyName);
  const body = str(payload?.body || payload?.text);
  const rawType = str(payload?.type).toLowerCase();
  const mediaMime = str(payload?.media?.mimetype || payload?.mimetype).toLowerCase();
  const mediaName = str(payload?.media?.filename || payload?.media?.fileName || payload?.filename).toLowerCase();
  // WAHA pode marcar imagem enviada como documentWithCaption/document; o MIME real prevalece.
  const messageType = mediaMime.startsWith("image/") || rawType.includes("image") || rawType.includes("sticker") || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(mediaName)
    ? (rawType.includes("sticker") ? "sticker" : rawType.includes("gif") || mediaMime === "image/gif" ? "gif" : "image")
    : mediaMime.startsWith("audio/") || rawType.includes("audio") || rawType.includes("ptt") ? "audio"
    : mediaMime.startsWith("video/") || rawType.includes("video") ? "video"
    : payload?.hasMedia || rawType.includes("document") || mediaMime ? "document" : "text";
  const sentAt = timestamp(payload?.timestamp ?? payload?.t ?? payload?._data?.t ?? payload?._data?.timestamp);
  const mediaUrl = str(payload?.media?.url || payload?.mediaUrl) || null;
  const avatar = str(payload?._data?.profilePicThumbObj?.eurl || payload?.profilePictureUrl) || null;

  let { data: existingChat } = await db.from("whatsapp_chats").select("id,unread_count,contact_number,contact_name,wa_chat_id,assigned_to")
    .eq("instance_id", instance.id).eq("wa_chat_id", waChatId).maybeSingle();
  // If WAHA alternates between a phone JID and a LID, match by the alternate phone JID.
  if (contactNumber.length >= 10 && !waChatId.endsWith("@g.us")) {
    // Normalize Brazilian numbers (with/without country code and ninth digit) before
    // matching. If legacy aliases exist, prefer the LID row used by WAHA for history.
    const candidates = await db.from("whatsapp_chats")
      .select("id,unread_count,contact_number,contact_name,wa_chat_id,assigned_to")
      .eq("instance_id", instance.id).eq("is_group", false).limit(500);
    if (candidates.error) return databaseFailure("chat_deduplication_lookup", candidates.error, "Chat deduplication lookup failed");
    const incomingPhone = normalizeWhatsAppPhone(contactNumber);
    const phoneMatches = (candidates.data || []).filter((row: any) =>
      incomingPhone && normalizeWhatsAppPhone(row.contact_number) === incomingPhone
    );
    const lidMatch = phoneMatches.find((row: any) => str(row.wa_chat_id).endsWith("@lid"));
    if (lidMatch && (!existingChat || !str(existingChat.wa_chat_id).endsWith("@lid"))) {
      existingChat = lidMatch;
    } else if (!existingChat) {
      existingChat = phoneMatches[0] || null;
    }
  }
  const lidDigits = waChatId.endsWith("@lid") ? waChatId.split("@")[0].replace(/\D/g, "") : "";
  const previousNumber = str(existingChat?.contact_number).replace(/\D/g, "");
  const persistedContactNumber = waChatId.endsWith("@lid")
    ? (contactNumber.length >= 10 ? contactNumber : (previousNumber && previousNumber !== lidDigits ? str(existingChat?.contact_number) : ""))
    : contactNumber;
  const previousName = str(existingChat?.contact_name).trim();
  const savedNameIsUseful = !!previousName &&
    previousName.replace(/\D/g, "") !== previousNumber &&
    !/^salvar contato$/i.test(previousName) &&
    !/^\+?[\d\s().-]+$/.test(previousName);
  // A CRM-saved contact name takes precedence over WhatsApp's profile/push name.
  const contactName = (savedNameIsUseful ? previousName : "") || incomingName || persistedContactNumber || "Contato do WhatsApp";
  let chatId = existingChat?.id as string | undefined;
  if (chatId) {
    const { error: chatUpdateError } = await db.from("whatsapp_chats").update({
      // Prefer the WAHA LID when it is known for this phone, so message history opens
      // against the identifier accepted by the active WhatsApp session.
      wa_chat_id: waChatId.endsWith("@lid") ? waChatId : existingChat?.wa_chat_id,
      contact_number: persistedContactNumber, contact_name: contactName, avatar_url: avatar,
      last_message: body || (messageType !== "text" ? `[${messageType}]` : ""),
      last_message_at: sentAt, unread_count: existingChat?.unread_count || 0,
      is_group: waChatId.endsWith("@g.us"), updated_at: new Date().toISOString(),
    }).eq("id", chatId);
    if (chatUpdateError) logDatabaseFailure("chat_summary_update", chatUpdateError);
  } else {
    const { data: inserted, error } = await db.from("whatsapp_chats").insert({
      instance_id: instance.id, wa_chat_id: waChatId, contact_number: persistedContactNumber,
      contact_name: contactName, avatar_url: avatar,
      last_message: body || (messageType !== "text" ? `[${messageType}]` : ""),
      last_message_at: sentAt, unread_count: 0,
      is_group: waChatId.endsWith("@g.us"), archived: false,
    }).select("id").single();
    if (error) return databaseFailure("chat_insert", error, "Failed to persist chat");
    chatId = inserted.id;
  }

  if (messageId) {
    const { error } = await db.from("whatsapp_messages").insert({
        chat_id: chatId, instance_id: instance.id, wa_message_id: messageId,
        from_me: fromMe, sender: fromMe ? "me" : str(payload?.participant || payload?._data?.id?.participant) || contactNumber,
        message_type: messageType, text: body, media_url: mediaUrl,
        media_mime: str(payload?.media?.mimetype) || null,
        media_filename: str(payload?.media?.filename) || null,
        status: "received", timestamp: sentAt, raw: payload,
        sent_by: fromMe ? instance.owner_id : null,
    });
    // Concurrent WAHA event types can race past the initial lookup. The unique
    // (instance_id, wa_message_id) constraint is the final idempotency guard.
    if (error) {
      if (error.code === "23505") return json({ accepted: true, duplicate: true });
      return databaseFailure("message_insert", error, "Failed to persist message");
    }
  }
  // Increment unread only after the message has been accepted by the unique message-ID
  // constraint. This prevents duplicate message/message.any deliveries from inflating the badge.
  if (!fromMe && messageId) {
    const { data: unreadChat, error: unreadLookupError } = await db.from("whatsapp_chats")
      .select("unread_count").eq("id", chatId).maybeSingle();
    if (unreadLookupError) return databaseFailure("unread_counter_lookup", unreadLookupError, "Failed to update unread counter");
    const { error: unreadUpdateError } = await db.from("whatsapp_chats")
      .update({ unread_count: Number(unreadChat?.unread_count || 0) + 1 })
      .eq("id", chatId);
    if (unreadUpdateError) return databaseFailure("unread_counter_update", unreadUpdateError, "Failed to update unread counter");
  } else if (!fromMe && !messageId) {
    const { data: unreadChat } = await db.from("whatsapp_chats").select("unread_count").eq("id", chatId).maybeSingle();
    await db.from("whatsapp_chats").update({ unread_count: Number(unreadChat?.unread_count || 0) + 1 }).eq("id", chatId);
  }

  // Ciclos de atendimento: consome a nota da pesquisa antes das automações e
  // inicia novo ciclo quando o cliente volta a falar após um atendimento encerrado.
  let newServiceCycleStarted = false;
  if (!fromMe && !waChatId.endsWith("@g.us") && chatId) {
    try {
      const trimmedReply = body.trim();
      const { data: pendingSurvey, error: surveyLookupError } = await db.from("whatsapp_service_sessions")
        .select("id,survey_status,survey_sent_at,closed_at").eq("chat_id", chatId).eq("status", "closed")
        .in("survey_status", ["sent", "pending"]).order("closed_at", { ascending: false }).limit(1).maybeSingle();
      if (surveyLookupError) throw surveyLookupError;
      const surveyAge = pendingSurvey?.survey_sent_at ? Date.now() - new Date(pendingSurvey.survey_sent_at).getTime() : null;
      // A resposta pode chegar antes de o envio da pesquisa terminar de gravar survey_sent_at.
      // Aceitar respostas 1–5 enquanto a pesquisa estiver pendente, ou até 7 dias após o envio.
      const isRatingReply = /^[1-5]$/.test(trimmedReply);
      const surveyWithinWindow = surveyAge === null || (surveyAge >= -5 * 60 * 1000 && surveyAge <= 7 * 24 * 60 * 60 * 1000);
      if (pendingSurvey && isRatingReply && surveyWithinWindow) {
        const { data: updatedRating, error: ratingError } = await db.from("whatsapp_service_sessions").update({
          rating: Number(trimmedReply), rating_received_at: sentAt, survey_status: "responded", updated_at: new Date().toISOString(),
        }).eq("id", pendingSurvey.id).is("rating", null).select("id").maybeSingle();
        if (ratingError) throw ratingError;
        if (updatedRating) {
          // Confirmação imediata ao cliente após registrar a nota.
          const thankYou = "Obrigado por avaliar o atendimento da Future Soluções! ⭐\n\nSua nota foi registrada. Este atendimento está encerrado. Se precisar de algo mais, é só nos chamar novamente.";
          const configuredUrl = Deno.env.get("WAHA_API_URL") || "";
          const apiUrl = configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;
          const apiKey = Deno.env.get("WAHA_API_KEY");
          if (apiUrl && apiKey) {
            const response = await fetch(`${apiUrl}/api/sendText`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
              body: JSON.stringify({ session, chatId: waChatId, text: thankYou }),
            });
            if (!response.ok) console.error("[waha-webhook] Could not send rating thank-you:", response.status);
          } else {
            console.error("[waha-webhook] WAHA_API_URL/WAHA_API_KEY missing; rating saved but thank-you was not sent.");
          }
          return json({ accepted: true, satisfaction_rating: Number(trimmedReply), thank_you_attempted: true });
        }
      }
      // Não descartar uma pesquisa por uma resposta numérica recebida durante a corrida de gravação.
      if (pendingSurvey && !isRatingReply) {
        await db.from("whatsapp_service_sessions").update({ survey_status: "skipped", updated_at: new Date().toISOString() }).eq("id", pendingSurvey.id).in("survey_status", ["sent", "pending"]);
      }
      const { data: activeCycle, error: activeCycleError } = await db.from("whatsapp_service_sessions")
        .select("id,started_at").eq("chat_id", chatId).is("closed_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (activeCycleError) throw activeCycleError;
      if (activeCycle?.id) {
        await db.from("whatsapp_service_sessions").update({ last_activity_at: sentAt, updated_at: new Date().toISOString() }).eq("id", activeCycle.id);
        // Se a resposta da pesquisa chegou antes do fechamento ser persistido, o "1–5"
        // pode ter criado um ciclo acidental. Reconhece essa corrida pela coincidência
        // dos horários e reinicia o menu na próxima mensagem real do cliente.
        const { data: latestRatedCycle, error: ratedCycleError } = await db.from("whatsapp_service_sessions")
          .select("rating_received_at").eq("chat_id", chatId).eq("status", "closed")
          .eq("survey_status", "responded").not("rating_received_at", "is", null)
          .order("rating_received_at", { ascending: false }).limit(1).maybeSingle();
        if (ratedCycleError) throw ratedCycleError;
        if (latestRatedCycle?.rating_received_at && activeCycle.started_at) {
          const startDelta = Math.abs(new Date(activeCycle.started_at).getTime() - new Date(latestRatedCycle.rating_received_at).getTime());
          if (startDelta <= 2 * 60 * 1000) newServiceCycleStarted = true;
        }
      } else {
        const { data: createdCycle, error: cycleCreateError } = await db.from("whatsapp_service_sessions").insert({
          chat_id: chatId, instance_id: instance.id, assigned_to: str(existingChat?.assigned_to) || null,
          created_by: instance.owner_id, status: "in_progress", started_at: sentAt, last_activity_at: sentAt,
        }).select("id").maybeSingle();
        if (cycleCreateError && !String(cycleCreateError.message || "").includes("idx_whatsapp_service_sessions_one_active_per_chat")) throw cycleCreateError;
        newServiceCycleStarted = !!createdCycle?.id;
      }
    } catch (cycleError) {
      console.error("[waha-webhook] Could not update service cycle:", cycleError);
    }
  }
  // Native CRM automation: only incoming direct text messages; never interrupt a human.
  if (!fromMe && !waChatId.endsWith("@g.us") && body.trim() && chatId) {
    try {
      const { data: flow, error: flowError } = await db.from("whatsapp_flows")
        .select("id,welcome_message,menu_message,fallback_message,options")
        .eq("instance_id", instance.id).eq("is_active", true).maybeSingle();
      if (flowError) throw flowError;
      if (flow) {
        const { data: flowSession, error: sessionError } = await db.from("whatsapp_flow_sessions")
          .select("*").eq("instance_id", instance.id).eq("chat_id", chatId).maybeSingle();
        if (sessionError) throw sessionError;

        let assignedTo = str(existingChat?.assigned_to);
        const menuText = [
          str(flow.welcome_message).trim(), str(flow.menu_message).trim(),
          ...(Array.isArray(flow.options) ? flow.options.map((option: any, index: number) => `${index + 1} — ${str(option?.label).trim()}`) : []),
          "Digite o número da opção desejada.",
        ].filter(Boolean).join("\n\n");

        const sendAutomaticText = async (text: string) => {
          const configuredUrl = Deno.env.get("WAHA_API_URL") || "";
          const apiUrl = configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;
          const apiKey = Deno.env.get("WAHA_API_KEY");
          if (!apiUrl || !apiKey) throw new Error("WAHA_API_URL/WAHA_API_KEY não configurados para automações.");
          const response = await fetch(`${apiUrl}/api/sendText`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ session, chatId: waChatId, text }),
          });
          if (!response.ok) throw new Error(`WAHA sendText HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
          return await response.json().catch(() => ({}));
        };

        // Atendimento novo após encerramento: reinicia o menu, mesmo que a sessão
        // anterior tenha sido roteada para um atendente. A nova escolha volta a
        // determinar o destino, sem alterar a avaliação do ciclo encerrado.
        if (newServiceCycleStarted && flowSession?.status !== "awaiting_choice") {
          await db.from("whatsapp_service_sessions").update({ assigned_to: null, updated_at: new Date().toISOString() })
            .eq("chat_id", chatId).is("closed_at", null);
          if (assignedTo) {
            await db.from("whatsapp_chats").update({ assigned_to: null, updated_at: new Date().toISOString() }).eq("id", chatId);
            await db.from("whatsapp_chat_assignment_history").insert({
              chat_id: chatId, previous_assignee: assignedTo, new_assignee: null, changed_by: instance.owner_id,
            });
            assignedTo = "";
          }
          await db.from("whatsapp_flow_sessions").upsert({
            flow_id: flow.id, instance_id: instance.id, chat_id: chatId, wa_chat_id: waChatId,
            status: "awaiting_choice", selected_option_key: null, target_label: null, assigned_to: null,
            last_inbound_message_id: messageId || null,
            last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }, { onConflict: "instance_id,chat_id" });
          await sendAutomaticText(menuText);
          return json({ accepted: true, new_service_cycle: true, menu_resent: true });
        }


        if (flowSession?.status === "awaiting_choice" && assignedTo) {
          await db.from("whatsapp_flow_sessions").update({
            flow_id: flow.id, status: "paused", updated_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
          }).eq("id", flowSession.id);
        } else if (!flowSession && !assignedTo) {
          await sendAutomaticText(menuText);
          await db.from("whatsapp_flow_sessions").upsert({
            flow_id: flow.id, instance_id: instance.id, chat_id: chatId, wa_chat_id: waChatId,
            status: "awaiting_choice", last_inbound_message_id: messageId || null,
            last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }, { onConflict: "instance_id,chat_id" });
        } else if (flowSession?.status === "awaiting_choice" && !assignedTo) {
          const normalized = body.trim().toLocaleLowerCase("pt-BR");
          const options = Array.isArray(flow.options) ? flow.options : [];
          const option = options.find((item: any, index: number) => {
            const key = str(item?.key) || String(index + 1);
            const label = str(item?.label).trim().toLocaleLowerCase("pt-BR");
            return normalized === key.toLocaleLowerCase("pt-BR") || normalized === label
              || normalized === `${key}.` || normalized === `${key}-` || normalized === `${key} —`;
          });
          if (!option) {
            // Reexibe somente o menu, sem mensagem de erro adicional. Limita respostas
            // automáticas para não inundar o cliente se ele enviar várias mensagens inválidas.
            const now = new Date();
            const lastInvalidReplyAt = flowSession.last_invalid_reply_at
              ? new Date(flowSession.last_invalid_reply_at).getTime()
              : 0;
            const shouldResendMenu = !Number.isFinite(lastInvalidReplyAt)
              || lastInvalidReplyAt <= 0
              || now.getTime() - lastInvalidReplyAt >= 30_000;
            if (shouldResendMenu) {
              await sendAutomaticText(menuText);
            }
            await db.from("whatsapp_flow_sessions").update({
              flow_id: flow.id,
              last_inbound_message_id: messageId || null,
              last_invalid_reply_at: shouldResendMenu ? now.toISOString() : flowSession.last_invalid_reply_at,
              last_interaction_at: now.toISOString(),
              updated_at: now.toISOString(),
            }).eq("id", flowSession.id);
          } else {
            const targetUserId = str(option?.target_user_id) || null;
            const targetLabel = str(option?.target_label).trim() || str(option?.label).trim();
            const reply = str(option?.reply_message).trim() || `Certo! Seu atendimento será direcionado para ${targetLabel}.`;
            await sendAutomaticText(reply);
            await db.from("whatsapp_flow_sessions").update({
              flow_id: flow.id, status: "routed", selected_option_key: str(option?.key),
              target_label: targetLabel, assigned_to: targetUserId,
              last_inbound_message_id: messageId || null,
              last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq("id", flowSession.id);
            if (targetUserId) {
              await db.from("whatsapp_chats").update({ assigned_to: targetUserId, updated_at: new Date().toISOString() }).eq("id", chatId);
              await db.from("whatsapp_chat_assignment_history").insert({
                chat_id: chatId, previous_assignee: assignedTo || null,
                new_assignee: targetUserId, changed_by: instance.owner_id,
              });
              await db.from("whatsapp_notifications").insert({
                user_id: targetUserId, title: `Novo atendimento · ${targetLabel}`,
                body: `Uma conversa foi direcionada pelo menu automático: ${contactName || persistedContactNumber}.`,
                chat_id: chatId, created_by: instance.owner_id,
              });
            }
          }
        }
      }
    } catch (automationError) {
      console.error("[waha-webhook] WhatsApp flow automation failed", automationError);
    }
  }
  return json({ accepted: true });
});

