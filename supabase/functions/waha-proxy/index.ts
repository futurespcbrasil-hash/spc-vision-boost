import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const cleanWebhookSecret = (value: string | null | undefined) =>
  (value || "").split(/\r?\n/)[0].replace(/\s+Copiar chave.*$/i, "").trim();

// Corrige números legados concatenados duas vezes, preservando números legítimos.
const collapseRepeatedPhoneDigits = (value: unknown): string => {
  const digits = String(value || "").split("@")[0].replace(/\D/g, "");
  if (digits.length % 2 === 0) {
    const half = digits.slice(0, digits.length / 2);
    if (half.length >= 10 && half.length <= 13 && half === digits.slice(digits.length / 2)) return half;
  }
  return digits;
};
// Canonicaliza números brasileiros sem confundir dígitos de identificadores @lid com telefone.
const normalizeWhatsAppPhone = (value: unknown): string => {
  let digits = collapseRepeatedPhoneDigits(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 11 && digits[2] === "9") digits = digits.slice(0, 2) + digits.slice(3);
  return digits;
};

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
    // Sem timeout, uma requisição travada ao provedor pode manter a ação pendente
    // indefinidamente e bloquear a interface. Não repetimos automaticamente envios:
    // em timeout de POST, o resultado remoto pode ser incerto e retry poderia duplicar.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(`${wahaUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", "X-Api-Key": wahaKey },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: controller.signal,
      });
      const raw = await response.text();
      let data: any;
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      if (!response.ok) {
        // Preserva status e detalhe do provedor para diagnosticar 4xx/5xx.
        // Nunca devolve links assinados ou credenciais que possam aparecer no corpo.
        let detail = String(data?.message || data?.error || data?.detail || raw || "").trim();
        if (typeof payload === "object" && payload !== null) {
          const file = (payload as Record<string, any>).file;
          if (typeof file?.url === "string" && file.url) detail = detail.split(file.url).join("[URL DO ARQUIVO REDIGIDA]");
        }
        detail = detail.slice(0, 900);
        throw new Error(`WAHA HTTP ${response.status}${detail ? ": " + detail : ""}`);
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Tempo limite de 25 segundos ao comunicar com a WAHA. Verifique o estado da conversa antes de repetir um envio, pois o WhatsApp pode já ter recebido a mensagem.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const getOwnedInstance = async (access?: {
    chatDbId?: string; waChatId?: string; recipient?: string; messageDbId?: string; allowAnyAssigned?: boolean;
  }) => {
    if (!instanceId) throw new Error("instance_id é obrigatório.");
    const { data: owned, error: ownerError } = await db.from("whatsapp_instances")
      .select("*").eq("id", instanceId).eq("owner_id", user.id).maybeSingle();
    if (ownerError) throw ownerError;
    if (owned) {
      if (owned.provider === "waha" && owned.provider_instance_name) return owned;
      const safeName = String(owned.name || "whatsapp").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "whatsapp";
      const newSession = "u" + user.id.replaceAll("-", "").slice(0, 8) + "-" + safeName + "-" + crypto.randomUUID().slice(0, 6);
      await callWaha("/api/sessions", "POST", { name: newSession, start: false, config: { webhooks: [] } });
      const { data: migrated, error: migrationError } = await db.from("whatsapp_instances")
        .update({ provider: "waha", provider_instance_name: newSession, status: "created", qr_code: null })
        .eq("id", owned.id).eq("owner_id", user.id).select("*").single();
      if (migrationError) {
        await callWaha("/api/sessions/" + encodeURIComponent(newSession), "DELETE").catch(() => null);
        throw migrationError;
      }
      return migrated;
    }
    if (!access) throw new Error("Instância não encontrada ou sem permissão.");
    const { data: sharedInstance, error: sharedError } = await db.from("whatsapp_instances")
      .select("*").eq("id", instanceId).maybeSingle();
    if (sharedError) throw sharedError;
    if (!sharedInstance || sharedInstance.provider !== "waha" || !sharedInstance.provider_instance_name) {
      throw new Error("Instância não encontrada ou sem permissão.");
    }
    let requestedChatId = access.chatDbId || "";
    if (access.messageDbId) {
      const { data: messageRow, error: messageLookupError } = await db.from("whatsapp_messages")
        .select("chat_id").eq("id", access.messageDbId).eq("instance_id", instanceId).maybeSingle();
      if (messageLookupError) throw messageLookupError;
      if (!messageRow?.chat_id) throw new Error("Mensagem não encontrada ou sem permissão.");
      requestedChatId = messageRow.chat_id;
    }
    let assignedQuery = db.from("whatsapp_chats").select("id,wa_chat_id,contact_number")
      .eq("instance_id", instanceId).eq("assigned_to", user.id);
    if (requestedChatId) assignedQuery = assignedQuery.eq("id", requestedChatId);
    if (access.waChatId) assignedQuery = assignedQuery.eq("wa_chat_id", access.waChatId);
    if (access.allowAnyAssigned) assignedQuery = assignedQuery.limit(1);
    const { data: assignedChats, error: assignedError } = await assignedQuery;
    if (assignedError) throw assignedError;
    let permitted = assignedChats || [];
    if (access.recipient) {
      const recipient = String(access.recipient).trim();
      const digits = recipient.replace(/[^0-9]/g, "");
      permitted = permitted.filter((chat: any) => chat.wa_chat_id === recipient
        || String(chat.contact_number || "").replace(/[^0-9]/g, "") === digits
        || chat.wa_chat_id.split("@")[0].replace(/[^0-9]/g, "") === digits);
    }
    if (!permitted.length) throw new Error("Você só pode acessar conversas atribuídas a você.");
    return sharedInstance;
  };
  // Resolve telefones novos pelo endpoint oficial da WAHA. No Brasil, o WhatsApp
  // pode exigir um LID em vez do JID baseado no telefone; enviar diretamente para
  // @c.us pode gerar "no LID found".
  const resolveChatId = async (session: string, recipient: string) => {
    const value = String(recipient || "").trim();
    if (!value) throw new Error("Informe o número ou identificador da conversa.");
    if (value.endsWith("@g.us") || value.endsWith("@lid")) return value;
    let phone = value;
    if (value.endsWith("@c.us")) phone = value.slice(0, -5);
    phone = collapseRepeatedPhoneDigits(phone);
    if (!phone) throw new Error("O número informado é inválido.");
    if ((phone.length === 10 || phone.length === 11) && !phone.startsWith("55")) phone = "55" + phone;
    if (phone.length < 10 || phone.length > 15) throw new Error("Número inválido. Informe país + DDD + telefone.");
    const params = new URLSearchParams({ session, phone });
    const checked = await callWaha("/api/contacts/check-exists?" + params.toString());
    if (checked?.numberExists === false) throw new Error("O número " + phone + " não está registrado no WhatsApp.");
    const chatId = typeof checked?.chatId === "string" ? checked.chatId : "";
    if (!chatId) throw new Error("A WAHA não retornou o identificador correto deste contato. Confira o número e tente novamente.");
    return chatId;
  };

  const persistOutbound = async (inst: any, chatId: string, text: string, messageType: string, result: any, recipient: string, replyTo?: string, media?: { url: string; mime: string; filename: string; storagePath?: string }) => {
    const now = new Date().toISOString();
    let digits = collapseRepeatedPhoneDigits(String(recipient || chatId));
    let { data: existing } = await db.from("whatsapp_chats")
      .select("id,unread_count,contact_name,contact_number,wa_chat_id")
      .eq("instance_id", inst.id).eq("wa_chat_id", chatId).maybeSingle();
    if (!existing && digits.length >= 10 && !chatId.endsWith("@g.us")) {
      const lookup = await db.from("whatsapp_chats")
        .select("id,unread_count,contact_name,contact_number,wa_chat_id")
        .eq("instance_id", inst.id).eq("is_group", false).limit(500);
      if (lookup.error) throw lookup.error;
      const targetPhone = normalizeWhatsAppPhone(digits);
      const matches = (lookup.data || []).filter((row: any) =>
        targetPhone && normalizeWhatsAppPhone(row.contact_number) === targetPhone
      );
      existing = matches.find((row: any) => String(row.wa_chat_id || "").endsWith("@lid")) || matches[0] || null;
    }
    if ((String(recipient || "").endsWith("@lid") || String(chatId || "").endsWith("@lid")) && existing?.contact_number) {
      digits = String(existing.contact_number).replace(/\D/g, "");
    }
    let chatIdDb = existing?.id as string | undefined;
    const previousName = String(existing?.contact_name || "").trim();
    const previousNumber = String(existing?.contact_number || "").replace(/\D/g, "");
    const hasPreviousName = !!previousName && previousName.replace(/\D/g, "") !== previousNumber;
    const chatRecord = {
      instance_id: inst.id, wa_chat_id: chatId, contact_number: digits,
      contact_name: hasPreviousName ? previousName : (digits || chatId), last_message: text || (messageType !== "text" ? "[" + messageType + "]" : ""),
      last_message_at: now, is_group: chatId.endsWith("@g.us"), updated_at: now,
    };
    if (chatIdDb) {
      const { error } = await db.from("whatsapp_chats").update(chatRecord).eq("id", chatIdDb);
      if (error) throw new Error("Mensagem enviada, mas falhou atualizar a conversa no CRM: " + error.message);
    } else {
      const { data: inserted, error } = await db.from("whatsapp_chats").insert({ ...chatRecord, unread_count: 0, archived: false }).select("id").single();
      if (error) throw new Error("Mensagem enviada, mas falhou criar a conversa no CRM: " + error.message);
      chatIdDb = inserted.id;
    }
    const rawId = result?.id?._serialized || result?.id || result?.messageId || result?.key?.id || null;
    if (chatIdDb) {
      let duplicate: any = null;
      if (typeof rawId === "string" && rawId) {
        const { data } = await db.from("whatsapp_messages").select("id").eq("instance_id", inst.id).eq("wa_message_id", rawId).maybeSingle();
        duplicate = data;
      }
      if (!duplicate) {
        const { error } = await db.from("whatsapp_messages").insert({
          chat_id: chatIdDb, instance_id: inst.id, wa_message_id: typeof rawId === "string" ? rawId : null,
          from_me: true, sender: "me", message_type: messageType, text: text || null,
          media_url: media?.url || null, media_mime: media?.mime || null, media_filename: media?.filename || null,
          status: "sent", timestamp: now,
          raw: { ...(result && typeof result === "object" ? result : {}), ...(media?.storagePath ? { crm_media_storage_path: media.storagePath } : {}) },
          sent_by: inst.owner_id, reply_to: replyTo || null,
        });
        if (error) throw new Error("Mensagem enviada, mas falhou gravar o histórico no CRM: " + error.message);
      }
    }
  };

  const updateLeadInteractionForNumber = async (inst: any, numberValue: string, chatId: string, messageText: string) => {
    const { data: chatRecord } = await db.from("whatsapp_chats").select("contact_number,contact_name")
      .eq("instance_id", inst.id).eq("wa_chat_id", chatId).maybeSingle();

    const normalizeLeadNumber = (value: unknown) => {
      let digits = String(value || "").split("@")[0].replace(/\D/g, "");
      if (digits.length >= 20 && digits.length % 2 === 0 && digits.slice(0, digits.length / 2) === digits.slice(digits.length / 2)) {
        digits = digits.slice(0, digits.length / 2);
      }
      if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
      return digits;
    };
    // WAHA pode entregar números em formatos diferentes (JID @c.us, @lid e
    // contact_number com DDI/DDD divergentes). Testa todas as fontes disponíveis.
    const targets = [...new Set([chatRecord?.contact_number, numberValue, chatId]
      .map(normalizeLeadNumber).filter((value) => value.length >= 10))];
    if (!targets.length) return false;

    const exactMatch = (row: any) => [row.whatsapp, row.phone].some((value: unknown) => {
      const candidate = normalizeLeadNumber(value);
      return candidate && targets.some(target => candidate === target || (candidate.length >= 10 && target.length >= 10 && candidate.slice(-10) === target.slice(-10)));
    });
    const suffixMatch = (row: any) => [row.whatsapp, row.phone].some((value: unknown) => {
      const candidate = normalizeLeadNumber(value);
      return candidate && targets.some(target => candidate.length >= 8 && target.length >= 8 && candidate.slice(-8) === target.slice(-8));
    });

    let leadsFound: any[] = [];
    // Pagina todos os leads para localizar também registros antigos.
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data: leadRows, error: leadLookupError } = await db.from("leads")
        .select("id,phone,whatsapp,interactions")
        .range(offset, offset + 999);
      if (leadLookupError) {
        console.error("[WAHA] Não foi possível localizar lead para registrar interação:", leadLookupError.message);
        return false;
      }
      const rows = leadRows || [];
      leadsFound.push(...rows.filter(exactMatch));
      if (rows.length < 1000) break;
    }

    let lead = leadsFound.length === 1 ? leadsFound[0] : null;
    if (!lead && leadsFound.length === 0) {
      let suffixMatches: any[] = [];
      for (let offset = 0; offset < 10000; offset += 1000) {
        const { data: leadRows, error: leadLookupError } = await db.from("leads")
          .select("id,phone,whatsapp,interactions")
          .range(offset, offset + 999);
        if (leadLookupError) return false;
        const rows = leadRows || [];
        suffixMatches.push(...rows.filter(suffixMatch));
        if (rows.length < 1000) break;
      }
      // Só usa o sufixo curto se identificar um único lead, evitando atualizar homônimos telefônicos.
      if (suffixMatches.length === 1) lead = suffixMatches[0];
    }
    if (!lead) {
      console.warn("[WAHA] Não foi possível identificar um único lead para o telefone:", targets[0].slice(-4), "matches:", leadsFound.length);
      return false;
    }

    const now = new Date().toISOString();
    const existingInteractions = Array.isArray(lead.interactions) ? lead.interactions : [];
    const interaction = {
      id: `whatsapp-${crypto.randomUUID()}`,
      date: now,
      type: "whatsapp",
      content: `Mensagem enviada pelo WhatsApp: ${messageText.trim().slice(0, 500)}`,
    };
    const { error: interactionError } = await db.from("leads").update({
      last_interaction_at: now,
      interactions: [...existingInteractions, interaction],
    }).eq("id", lead.id);
    if (interactionError) {
      console.error("[WAHA] Falha ao atualizar interação do lead:", interactionError.message);
      return false;
    }
    console.info("[WAHA] Interação registrada no lead:", lead.id);
    return true;
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
        // Busca a imagem diretamente da WAHA para não enviar o código de pareamento a serviços de terceiros.
        let qrResponse: Response | null = null;
        // A sessão pode levar alguns segundos para gerar o QR; tenta novamente antes de responder.
        for (let attempt = 0; attempt < 8; attempt++) {
          qrResponse = await fetch(`${wahaUrl}/api/${session}/auth/qr?format=image`, {
            headers: { "X-Api-Key": wahaKey },
          }).catch(() => null);
          if (qrResponse?.ok) break;
          await qrResponse?.body?.cancel().catch(() => null);
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        let qrValue: string | null = null;
        if (qrResponse?.ok) {
          const contentType = qrResponse.headers.get("content-type") || "";
          if (contentType.startsWith("image/")) {
            const bytes = new Uint8Array(await qrResponse.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            qrValue = `data:${contentType};base64,${btoa(binary)}`;
          } else {
            const qrData = await qrResponse.json().catch(() => null);
            qrValue = qrData?.data || qrData?.value || qrData?.qr || null;
          }
        }
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
        const hookSecret = cleanWebhookSecret(Deno.env.get("WAHA_WEBHOOK_SECRET"));
        if (!hookUrl || !hookSecret) return json({ error: "Defina WAHA_WEBHOOK_URL e WAHA_WEBHOOK_SECRET nos secrets do Supabase." }, 503);
        const target = new URL(hookUrl);
        target.searchParams.delete("token");
        await callWaha(`/api/sessions/${encodeURIComponent(inst.provider_instance_name)}`, "PUT", { config: { webhooks: [{
          url: target.toString(),
          events: ["message", "message.any", "message.ack", "message.revoked", "message.revoke", "message.deleted", "message.delete", "state.change", "session.status"],
          customHeaders: [{ name: "X-WAHA-Webhook-Secret", value: hookSecret }],
        }] } });
        return json({ success: true });
      }
      case "check_number": {
        const inst = await getOwnedInstance();
        const digits = number.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) return json({ error: "Informe um número válido com DDD." }, 400);
        const normalized = digits.startsWith("55") ? digits : `55${digits}`;
        const params = new URLSearchParams({ phone: normalized, session: inst.provider_instance_name });
        const result = await callWaha("/api/contacts/check-exists?" + params.toString());
        return json({
          number: normalized,
          exists: result?.numberExists === true || result?.exists === true || result?.number_exists === true,
          chat_id: typeof result?.chatId === "string" ? result.chatId : null,
          result,
        });
      }
      case "send_text": {
        const inst = await getOwnedInstance({ recipient: number });
        if (!number || typeof body.text !== "string" || !body.text.trim()) return json({ error: "Número e texto são obrigatórios." }, 400);
        const chatId = await resolveChatId(inst.provider_instance_name, number);
        const replyTo = typeof body.reply_to === "string" && body.reply_to.trim() ? body.reply_to.trim() : undefined;
        const payload: Record<string, unknown> = { session: inst.provider_instance_name, chatId, text: body.text };
        if (replyTo) payload.reply_to = replyTo;
        const result = await callWaha("/api/sendText", "POST", payload);
        await persistOutbound(inst, chatId, String(body.text).trim(), "text", result, number, replyTo);
        const leadInteractionUpdated = await updateLeadInteractionForNumber(inst, number, chatId, String(body.text));
        return json({ ...result, lead_interaction_updated: leadInteractionUpdated });
      }
      case "send_media": {
        const inst = await getOwnedInstance({ recipient: number });
        if (!number || typeof body.media_url !== "string" || !body.media_url) return json({ error: "Número e URL da mídia são obrigatórios." }, 400);
        const chatId = await resolveChatId(inst.provider_instance_name, number);
        const mediaType = String(body.media_type || "document").toLowerCase();
        const mimetype = typeof body.media_mime === "string" ? body.media_mime : "application/octet-stream";
        const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim().slice(0, 180) : "arquivo";
        // Baixa o conteúdo no servidor e envia BASE64 à WAHA. Isso evita que o WhatsApp receba
        // uma URL como mensagem/anexo e garante que a WAHA envie os bytes reais do arquivo.
        let source: Response;
        let parsedMediaUrl: URL;
        try { parsedMediaUrl = new URL(body.media_url); } catch { return json({ error: "URL de mídia inválida." }, 400); }

        const maxMediaBytes = 50 * 1024 * 1024;
        const supabaseOrigin = new URL(supabaseUrl).origin;
        const wahaOrigin = new URL(wahaUrl).origin;
        const localWahaFile = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedMediaUrl.hostname)
          && parsedMediaUrl.pathname.startsWith("/api/files/");
        const wahaFileMatch = parsedMediaUrl.pathname.match(/^\/api\/files\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
        const isSupabaseChatMedia = parsedMediaUrl.origin === supabaseOrigin
          && (parsedMediaUrl.pathname.startsWith("/storage/v1/object/sign/chat-media/")
            || parsedMediaUrl.pathname.startsWith("/storage/v1/object/public/chat-media/"));
        const isWahaMedia = parsedMediaUrl.origin === wahaOrigin
          && !!wahaFileMatch
          && wahaFileMatch[1] === inst.provider_instance_name;

        if (localWahaFile) {
          if (!wahaFileMatch || wahaFileMatch[1] !== inst.provider_instance_name) {
            return json({ error: "Caminho da mídia inválido para esta instância." }, 403);
          }
          source = await fetch(`${wahaUrl}${parsedMediaUrl.pathname}`, { headers: { "X-Api-Key": wahaKey } });
        } else if (isSupabaseChatMedia) {
          source = await fetch(body.media_url);
        } else if (isWahaMedia) {
          source = await fetch(body.media_url, { headers: { "X-Api-Key": wahaKey } });
        } else {
          return json({ error: "A mídia precisa estar no armazenamento chat-media autorizado ou nos arquivos da sessão WAHA atual." }, 403);
        }

        if (!source.ok) return json({ error: `Não foi possível obter o arquivo para envio (HTTP ${source.status}).` }, 502);
        const declaredSize = Number(source.headers.get("content-length") || 0);
        if (Number.isFinite(declaredSize) && declaredSize > maxMediaBytes) {
          await source.body?.cancel().catch(() => null);
          return json({ error: "O arquivo excede o limite de 50 MB." }, 413);
        }

        // Enforce the limit while streaming; checking Blob.size after blob() would
        // already have buffered an arbitrarily large response in Edge Function memory.
        const reader = source.body?.getReader();
        if (!reader) return json({ error: "O arquivo está vazio ou não possui conteúdo." }, 400);
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxMediaBytes) {
              await reader.cancel().catch(() => null);
              return json({ error: "O arquivo excede o limite de 50 MB." }, 413);
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        if (!totalBytes) return json({ error: "O arquivo está vazio." }, 400);
        const fileBlob = new Blob(chunks, { type: source.headers.get("content-type") || "" });
        const actualMime = (!mimetype || mimetype === "application/octet-stream")
          ? (source.headers.get("content-type") || fileBlob.type || mimetype)
          : mimetype;
        const bytes = new Uint8Array(await fileBlob.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
        }
        const data = btoa(binary);
        const file = { mimetype: actualMime, filename, data };
        const payload: Record<string, unknown> = { session: inst.provider_instance_name, chatId, file };
        if (typeof body.caption === "string" && body.caption) payload.caption = body.caption;
        const endpoint = ["image", "photo", "sticker", "gif"].includes(mediaType) || actualMime.startsWith("image/")
          ? "/api/sendImage"
          : mediaType === "video" || actualMime.startsWith("video/")
            ? "/api/sendVideo"
            : "/api/sendFile";
        const result = await callWaha(endpoint, "POST", payload);
        let storagePath: string | undefined;
        try {
          const mediaUrl = new URL(body.media_url);
          const marker = "/storage/v1/object/sign/chat-media/";
          const markerIndex = mediaUrl.pathname.indexOf(marker);
          if (markerIndex >= 0) {
            const candidate = decodeURIComponent(mediaUrl.pathname.slice(markerIndex + marker.length));
            if (candidate.startsWith(`${user.id}/`) && !candidate.includes("..")) storagePath = candidate;
          }
        } catch { /* URL externa: não associar caminho de armazenamento */ }
        await persistOutbound(inst, chatId, typeof body.caption === "string" ? body.caption : "", mediaType, result, number, undefined, {
          url: body.media_url, mime: actualMime, filename, storagePath,
        });
        return json({ ...result, media_type: mediaType });
      }
      case "resolve_media": {
        const messageId = typeof body.message_id === "string" ? body.message_id : "";
        if (!messageId) return json({ error: "message_id é obrigatório." }, 400);
        const inst = await getOwnedInstance({ messageDbId: messageId });
        if (!messageId) return json({ error: "message_id é obrigatório." }, 400);
        const { data: message, error: messageError } = await db.from("whatsapp_messages")
          .select("id,instance_id,media_url,media_mime,media_filename,raw,message_type")
          .eq("id", messageId).eq("instance_id", inst.id).maybeSingle();
        if (messageError) throw messageError;
        if (!message || !message.media_url) return json({ error: "Mensagem ou mídia não encontrada." }, 404);
        const raw = message.raw && typeof message.raw === "object" && !Array.isArray(message.raw) ? message.raw as Record<string, unknown> : {};
        const existingPath = typeof raw.crm_media_storage_path === "string" &&
          (raw.crm_media_storage_path.startsWith(`archive/${inst.id}/`) || raw.crm_media_storage_path.startsWith(`${user.id}/`))
          ? raw.crm_media_storage_path : "";
        let storagePath = existingPath;
        if (!storagePath) {
          let parsed: URL;
          try { parsed = new URL(message.media_url); } catch { return json({ error: "URL da mídia inválida." }, 400); }
          const storageMarker = "/storage/v1/object/sign/chat-media/";
          const storageIndex = parsed.pathname.indexOf(storageMarker);
          if (storageIndex >= 0) {
            const candidate = decodeURIComponent(parsed.pathname.slice(storageIndex + storageMarker.length));
            if ((candidate.startsWith(`${user.id}/`) || candidate.startsWith(`archive/${inst.id}/`)) && !candidate.includes("..")) {
              storagePath = candidate;
              const { error: rawError } = await db.from("whatsapp_messages").update({
                raw: { ...raw, crm_media_storage_path: storagePath, crm_media_archived_at: new Date().toISOString() },
              }).eq("id", message.id).eq("instance_id", inst.id);
              if (rawError) throw rawError;
            }
          }
          if (!storagePath && (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) || !parsed.pathname.startsWith("/api/files/"))) {
            return json({ url: message.media_url, stored: false });
          }
          if (!storagePath) {
          const relative = parsed.pathname;
          const safePath = relative.match(/^\/api\/files\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
          if (!safePath) return json({ error: "Caminho da mídia inválido." }, 400);
          if (safePath[1] !== inst.provider_instance_name) return json({ error: "A mídia não pertence à instância WhatsApp desta conversa." }, 403);
          const remote = await fetch(`${wahaUrl}${relative}`, { headers: { "X-Api-Key": wahaKey } });
          if (!remote.ok) return json({ error: `A WAHA não conseguiu recuperar a mídia (HTTP ${remote.status}).` }, 502);
          const blob = await remote.blob();
          if (blob.size > 50 * 1024 * 1024) return json({ error: "A mídia excede o limite de 50 MB para recuperação." }, 413);
          const originalName = (message.media_filename || safePath[2]).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || safePath[2];
          storagePath = `archive/${inst.id}/${message.id}-${originalName}`;
          const { error: uploadError } = await db.storage.from("chat-media").upload(storagePath, blob, {
            contentType: message.media_mime || remote.headers.get("content-type") || blob.type || "application/octet-stream",
            upsert: true,
          });
          if (uploadError) throw uploadError;
          const { error: rawError } = await db.from("whatsapp_messages").update({
            raw: { ...raw, crm_media_storage_path: storagePath, crm_media_archived_at: new Date().toISOString() },
          }).eq("id", message.id).eq("instance_id", inst.id);
          if (rawError) throw rawError;
          }
        }
        const { data: signed, error: signError } = await db.storage.from("chat-media").createSignedUrl(storagePath, 60 * 60);
        if (signError || !signed?.signedUrl) throw signError || new Error("Não foi possível gerar link temporário para a mídia.");
        return json({ url: signed.signedUrl, stored: true, storage_path: storagePath });
      }
      case "get_chats": {
        const inst = await getOwnedInstance({ allowAnyAssigned: true });
        // Overview inclui última mensagem e dados de exibição; fallback para /chats em versões antigas.
        let rawChats: any;
        try {
          rawChats = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/chats/overview`);
        } catch {
          rawChats = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/chats`);
        }
        let chats = Array.isArray(rawChats) ? rawChats
          : Array.isArray(rawChats?.chats) ? rawChats.chats
          : Array.isArray(rawChats?.items) ? rawChats.items : [];
        if (inst.owner_id !== user.id) {
          const { data: assignedRows, error: assignedRowsError } = await db.from("whatsapp_chats")
            .select("wa_chat_id").eq("instance_id", inst.id).eq("assigned_to", user.id);
          if (assignedRowsError) throw assignedRowsError;
          const allowedIds = new Set((assignedRows || []).map((row: any) => String(row.wa_chat_id)));
          chats = chats.filter((chat: any) => {
            const rawId = chat?.id?._serialized || chat?.id || chat?.chatId || chat?.wa_chat_id;
            return typeof rawId === "string" && allowedIds.has(rawId);
          });
        }
        let synced = 0;
        for (const chat of chats) {
          const rawId = chat?.id?._serialized || chat?.id || chat?.chatId || chat?.wa_chat_id;
          const waChatId = typeof rawId === "string" ? rawId : "";
          if (!waChatId) continue;
          // Não tratar status, listas de transmissão ou canais como conversas individuais.
          if (waChatId === "status@broadcast" || waChatId.endsWith("@newsletter") || waChatId.endsWith("@broadcast")) continue;
          const number = waChatId.split("@")[0].replace(/\D/g, "");
          const last = chat?.lastMessage || chat?.last_message || {};
          const rawTime = last?.timestamp || chat?.timestamp || chat?.lastMessageAt || null;
          let lastMessageAt: string | null = null;
          if (typeof rawTime === "number" && rawTime > 0) {
            lastMessageAt = new Date(rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime).toISOString();
          } else if (typeof rawTime === "string" && rawTime) {
            const parsedTime = new Date(rawTime);
            if (!Number.isNaN(parsedTime.getTime())) lastMessageAt = parsedTime.toISOString();
          }
          const lastText = typeof last === "string" ? last : String(last?.body || last?.text || last?.caption || "");
          const lastMessageFromMe = last?.fromMe === true || last?.from_me === true || last?.key?.fromMe === true;
          const hasLastMedia = !!(last?.hasMedia || last?.media || last?.mimetype);
          // /chats pode retornar todos os contatos. Sincronizar somente conversas com histórico real.
          if (!lastMessageAt && !lastText.trim() && !hasLastMedia) continue;
          // Em algumas respostas da WAHA, uma conversa de grupo chega com o JID
          // do participante (@lid); o ID remoto da última mensagem ainda revela o @g.us.
          // A última mensagem pode ter sido associada incorretamente a outro chat; classifique pelo JID/metadados do chat.
          const isGroup = waChatId.endsWith("@g.us") || chat?.isGroup === true || chat?.is_group === true;
          const contactName = String(chat?.name || chat?.pushName || chat?.contact?.name || number || waChatId);
          const record = {
            instance_id: inst.id,
            wa_chat_id: waChatId,
            contact_number: number,
            contact_name: contactName,
            avatar_url: chat?.picture || chat?.profilePictureUrl || null,
            last_message: lastText || (hasLastMedia ? "[mídia]" : null),
            last_message_at: lastMessageAt,
            unread_count: Number(chat?.unreadCount ?? chat?.unread_count ?? 0),
            is_group: isGroup,
            archived: false,
            updated_at: new Date().toISOString(),
          };
          // WAHA pode apresentar o mesmo contato com JIDs @c.us e @lid.
          // Reaproveitar o registro por telefone para não criar uma segunda conversa.
          let existing: any = null;
          const exact = await db.from("whatsapp_chats").select("id,wa_chat_id,contact_number,contact_name,unread_count,last_message_at,last_message")
            .eq("instance_id", inst.id).eq("wa_chat_id", waChatId).maybeSingle();
          if (exact.error) throw exact.error;
          existing = exact.data;
          if (!existing && !isGroup && number.length >= 10) {
            const phoneKey = (value: unknown) => {
              let digits = String(value || "").split("@")[0].replace(/\D/g, "");
              if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
                if (digits.length === 13 && digits[4] === "9") digits = digits.slice(0, 4) + digits.slice(5);
              } else if (digits.length === 11 && digits[2] === "9") {
                digits = digits.slice(0, 2) + digits.slice(3);
              }
              return digits;
            };
            const byPhone = await db.from("whatsapp_chats").select("id,wa_chat_id,contact_number,contact_name,unread_count,last_message_at,last_message")
              .eq("instance_id", inst.id).eq("is_group", false).limit(500);
            if (byPhone.error) throw byPhone.error;
            const targetKey = phoneKey(number);
            existing = (byPhone.data || []).find((item: any) => phoneKey(item.contact_number) === targetKey) || null;
          }
          if (existing) {
            const previousMessageAt = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
            const currentMessageAt = record.last_message_at ? new Date(record.last_message_at).getTime() : 0;
            const hasNewInboundMessage = !lastMessageFromMe && (currentMessageAt > previousMessageAt || (currentMessageAt === previousMessageAt && String(record.last_message || "") !== String(existing.last_message || "")));
            const { error } = await db.from("whatsapp_chats").update({
              ...record,
              // Quando o identificador LID aparece, torná-lo canônico para que
              // o histórico remoto continue abrindo no JID correto.
              wa_chat_id: waChatId.endsWith("@lid") ? waChatId : existing.wa_chat_id,
              contact_number: existing.contact_number || number,
              // O nome salvo no CRM/agenda prevalece sobre o nome do perfil da própria conta WAHA.
              contact_name: (() => {
                const savedName = String(existing.contact_name || "").trim();
                const savedNumber = String(existing.contact_number || "").replace(/\D/g, "");
                const savedNameIsUseful = !!savedName &&
                  savedName.replace(/\D/g, "") !== savedNumber &&
                  !/^salvar contato$/i.test(savedName) &&
                  !/^\+?[\d\s().-]+$/.test(savedName) &&
                  !/^contato do whatsapp$/i.test(savedName);
                return savedNameIsUseful ? savedName : (contactName || savedName);
              })(),
              // Não ressuscitar avisos já dispensados só porque a WAHA repetiu unreadCount antigo.
              // Um novo inbound atualiza o contador; uma atividade de saída não o aumenta.
              unread_count: hasNewInboundMessage ? record.unread_count : Number(existing.unread_count || 0),
            }).eq("id", existing.id);
            if (!error) synced++;
            else throw error;
          } else {
            const { error } = await db.from("whatsapp_chats").upsert(record, { onConflict: "instance_id,wa_chat_id" });
            if (!error) synced++;
            else throw error;
          }
        }
        return json({ chats, synced });
      }
      case "get_contacts": {
        const inst = await getOwnedInstance();
        const contacts = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/contacts`);
        return json({ contacts });
      }
      case "edit_message": {
        const inst = await getOwnedInstance({ chatDbId: typeof body.chat_id === "string" ? body.chat_id.trim() : "" });
        const chatDbId = typeof body.chat_id === "string" ? body.chat_id.trim() : "";
        const messageDbId = typeof body.message_id === "string" ? body.message_id.trim() : "";
        const editedText = typeof body.text === "string" ? body.text.trim() : "";
        if (!chatDbId || !messageDbId || !editedText) {
          return json({ error: "Conversa, mensagem e texto editado são obrigatórios." }, 400);
        }
        const { data: chat, error: chatError } = await db.from("whatsapp_chats")
          .select("id,instance_id,wa_chat_id,last_message")
          .eq("id", chatDbId).eq("instance_id", inst.id).maybeSingle();
        if (chatError) throw chatError;
        if (!chat) return json({ error: "Conversa não encontrada nesta instância." }, 404);
        const { data: messageRow, error: messageError } = await db.from("whatsapp_messages")
          .select("id,chat_id,instance_id,wa_message_id,from_me,text,message_type,raw")
          .eq("id", messageDbId).eq("chat_id", chat.id).eq("instance_id", inst.id).maybeSingle();
        if (messageError) throw messageError;
        if (!messageRow) return json({ error: "Mensagem não encontrada." }, 404);
        if (!messageRow.from_me) return json({ error: "Só é possível editar mensagens enviadas por esta conta." }, 403);
        if (!messageRow.wa_message_id) return json({ error: "Esta mensagem não possui ID remoto para edição no WhatsApp." }, 409);
        if (messageRow.message_type !== "text" && messageRow.message_type !== "image" && messageRow.message_type !== "video" && messageRow.message_type !== "document") {
          return json({ error: "Este tipo de mensagem não permite edição de texto." }, 400);
        }
        const remotePath = `/api/${encodeURIComponent(inst.provider_instance_name)}/chats/${encodeURIComponent(chat.wa_chat_id)}/messages/${encodeURIComponent(messageRow.wa_message_id)}`;
        const remoteResult = await callWaha(remotePath, "PUT", { text: editedText });
        const { error: updateError } = await db.from("whatsapp_messages").update({
          text: editedText,
          raw: { ...(messageRow.raw && typeof messageRow.raw === "object" ? messageRow.raw : {}), crm_edited_at: new Date().toISOString(), crm_edit_response: remoteResult },
        }).eq("id", messageRow.id);
        if (updateError) throw updateError;
        if (chat.last_message === messageRow.text) {
          await db.from("whatsapp_chats").update({ last_message: editedText, updated_at: new Date().toISOString() }).eq("id", chat.id);
        }
        return json({ success: true, message_id: messageRow.id, text: editedText, remote: remoteResult });
      }
      case "get_messages": {
        const waChatId = typeof body.wa_chat_id === "string" ? body.wa_chat_id : "";
        const inst = await getOwnedInstance({ waChatId });
        if (!waChatId) return json({ error: "wa_chat_id é obrigatório." }, 400);
        const rawMessages = await callWaha(`/api/${encodeURIComponent(inst.provider_instance_name)}/chats/${encodeURIComponent(waChatId)}/messages?limit=100`);
        const messages = Array.isArray(rawMessages) ? rawMessages : Array.isArray(rawMessages?.messages) ? rawMessages.messages : [];
        const isLidChat = waChatId.endsWith("@lid");
        const number = isLidChat ? "" : waChatId.split("@")[0].replace(/\D/g, "");
        const { data: existingChat, error: exactChatError } = await db.from("whatsapp_chats")
          .select("id,wa_chat_id,contact_number,contact_name").eq("instance_id", inst.id).eq("wa_chat_id", waChatId).maybeSingle();
        if (exactChatError) throw exactChatError;
        let chat: any = existingChat;
        // If the UI still has a stale @c.us JID, reuse the existing phone/LID row rather
        // than creating a second conversation after WAHA resolves that phone to @lid.
        if (!chat && number.length >= 10 && !waChatId.endsWith("@g.us")) {
          const { data: phoneCandidates, error: phoneLookupError } = await db.from("whatsapp_chats")
            .select("id,wa_chat_id,contact_number,contact_name").eq("instance_id", inst.id)
            .eq("is_group", false).limit(500);
          if (phoneLookupError) throw phoneLookupError;
          const targetPhone = normalizeWhatsAppPhone(number);
          const matches = (phoneCandidates || []).filter((row: any) =>
            targetPhone && normalizeWhatsAppPhone(row.contact_number) === targetPhone
          );
          chat = matches.find((row: any) => String(row.wa_chat_id || "").endsWith("@lid")) || matches[0] || null;
        }
        if (!chat) {
          const { data: insertedChat, error: chatError } = await db.from("whatsapp_chats").insert({
            instance_id: inst.id,
            wa_chat_id: waChatId,
            contact_number: number,
            contact_name: number || waChatId,
            is_group: waChatId.endsWith("@g.us"),
            updated_at: new Date().toISOString(),
          }).select("id").single();
          if (chatError) throw chatError;
          chat = insertedChat;
        }
        let synced = 0;
        const remoteMessageIds = new Set<string>();
        const remoteTimestamps: string[] = [];
        // IDs excluídos pelo usuário/telefone são tombstones permanentes: a WAHA pode
        // devolver uma cópia antiga e não devemos ressuscitá-la via upsert.
        const deletedRemoteIds = new Set<string>();
        let remoteMessagesComplete = messages.length > 0;
        if (chat?.id) {
          for (const msg of messages) {
            const rawId = msg?.id?._serialized || msg?.id || msg?.key?.id || msg?.messageId;
            const waMessageId = typeof rawId === "string" ? rawId : "";
            if (!waMessageId) { remoteMessagesComplete = false; continue; }
            remoteMessageIds.add(waMessageId);

            // Alguns históricos WAHA misturam mensagens de grupo no retorno de um
            // chat @lid. Direciona cada mensagem pelo JID embutido no ID remoto.
            const messageGroupJid = waMessageId.match(/\d+@g\.us/i)?.[0] || "";
            let messageChatId = chat.id;
            if (messageGroupJid && messageGroupJid !== waChatId) {
              const { data: groupChat, error: groupLookupError } = await db.from("whatsapp_chats")
                .select("id").eq("instance_id", inst.id).eq("wa_chat_id", messageGroupJid).maybeSingle();
              if (groupLookupError) throw groupLookupError;
              if (groupChat?.id) {
                messageChatId = groupChat.id;
              } else {
                const { data: createdGroup, error: createGroupError } = await db.from("whatsapp_chats")
                  .upsert({
                    instance_id: inst.id,
                    wa_chat_id: messageGroupJid,
                    contact_number: messageGroupJid.split("@")[0],
                    contact_name: messageGroupJid,
                    is_group: true,
                    updated_at: new Date().toISOString(),
                  }, { onConflict: "instance_id,wa_chat_id" })
                  .select("id").single();
                if (createGroupError) throw createGroupError;
                messageChatId = createdGroup.id;
              }
            }

            const directJid = waMessageId.match(/\d+@c\.us/i)?.[0] || "";
            if (isLidChat && directJid && !chat.contact_number) {
              const directNumber = directJid.split("@")[0];
              const { error: enrichChatError } = await db.from("whatsapp_chats")
                .update({ contact_number: directNumber, contact_name: directNumber, updated_at: new Date().toISOString() })
                .eq("id", chat.id).eq("instance_id", inst.id);
              if (enrichChatError) throw enrichChatError;
              chat.contact_number = directNumber;
              chat.contact_name = directNumber;
            }

            const fromMe = msg?.fromMe === true || msg?.from_me === true || msg?.key?.fromMe === true;
            // WAHA pode devolver timestamps como segundos, milissegundos ou strings numéricas.
            // Também pode colocar o tempo em _data.t. Date(stringNumérica) não é confiável:
            // mensagens antigas acabavam recebendo "agora" e apareciam no lugar errado.
            const rawTime = msg?.timestamp ?? msg?.t ?? msg?.createdAt ?? msg?.messageTimestamp ??
              msg?._data?.messageTimestamp ?? msg?._data?.timestamp ?? msg?._data?.t ?? msg?.key?.timestamp ?? null;
            const parseWahaTime = (value: unknown): string | null => {
              if (typeof value === "number" && Number.isFinite(value) && value > 0) {
                const d = new Date(value < 10_000_000_000 ? value * 1000 : value);
                return Number.isNaN(d.getTime()) ? null : d.toISOString();
              }
              if (typeof value === "string" && value.trim()) {
                const numeric = Number(value.trim());
                if (Number.isFinite(numeric) && numeric > 0) {
                  const d = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
                  return Number.isNaN(d.getTime()) ? null : d.toISOString();
                }
                const d = new Date(value);
                return Number.isNaN(d.getTime()) ? null : d.toISOString();
              }
              return null;
            };
            const parsedSentAt = parseWahaTime(rawTime);
            const { data: existingMessage, error: existingMessageError } = await db.from("whatsapp_messages")
              .select("id,text,timestamp").eq("instance_id", inst.id).eq("wa_message_id", waMessageId).maybeSingle();
            if (existingMessageError) throw existingMessageError;
            // Não sobrescreve uma data real já salva com epoch quando a WAHA omite timestamp.
            const existingTime = existingMessage?.timestamp && Date.parse(existingMessage.timestamp) > 0
              ? new Date(existingMessage.timestamp).toISOString()
              : null;
            const sentAt = parsedSentAt || existingTime || new Date().toISOString();
            remoteTimestamps.push(sentAt);
            if (existingMessage?.text === "[crm_deleted]") {
              deletedRemoteIds.add(waMessageId);
              continue;
            }
            const rawType = String(msg?.type || msg?.media?.mimetype || "").toLowerCase();
            const isRevoked = rawType.includes("revok") || rawType.includes("protocol") || msg?.isRevoked === true || msg?._data?.isRevoked === true;
            const messageType = rawType.includes("image") ? "image" : rawType.includes("audio") || rawType.includes("ptt") ? "audio"
              : rawType.includes("video") ? "video" : msg?.hasMedia ? "document" : "text";
            const messageText = isRevoked ? "[message_revoke]" : String(msg?.body || msg?.text || "");
            const { error } = await db.from("whatsapp_messages").upsert({
              chat_id: messageChatId,
              instance_id: inst.id,
              wa_message_id: waMessageId,
              from_me: fromMe,
              sender: fromMe ? "me" : number,
              message_type: messageType,
              text: messageText,
              media_url: msg?.media?.url || msg?.mediaUrl || null,
              media_mime: msg?.media?.mimetype || null,
              media_filename: msg?.media?.filename || null,
              status: msg?.ack ? String(msg.ack) : "received",
              timestamp: sentAt,
              raw: msg,
              sent_by: fromMe ? inst.owner_id : null,
            }, { onConflict: "instance_id,wa_message_id" });
            if (!error) synced++;
          }
          // Reconcile the recent remote window: the old implementation only upserted
          // messages and therefore never removed records deleted on the phone. Only reconcile
          // when WAHA returned identifiable messages with valid timestamps, and never touch
          // messages older than the first item in the fetched remote window.
          if (remoteMessagesComplete && remoteTimestamps.length > 0) {
            const oldestRemote = remoteTimestamps.reduce((a, b) => a < b ? a : b);
            const { data: localWindow, error: localWindowError } = await db.from("whatsapp_messages")
              .select("id,wa_message_id,timestamp,text")
              .eq("chat_id", chat.id)
              .gte("timestamp", oldestRemote);
            if (localWindowError) throw localWindowError;
            const staleIds = (localWindow || [])
              .filter((row: any) => row.wa_message_id && row.text !== "[crm_deleted]" && !remoteMessageIds.has(String(row.wa_message_id)))
              .map((row: any) => row.id);
            if (staleIds.length > 0) {
              const { error: deleteError } = await db.from("whatsapp_messages").delete().in("id", staleIds);
              if (deleteError) throw deleteError;
            }
            const newestRemote = messages
              .map((msg: any) => {
                const id = msg?.id?._serialized || msg?.id || msg?.key?.id || msg?.messageId;
                const rawTime = msg?.timestamp ?? msg?.t ?? msg?.createdAt ?? msg?.messageTimestamp ?? msg?._data?.t ?? msg?._data?.timestamp;
                let parsed: number | null = null;
                if (typeof rawTime === "number" && rawTime > 0) parsed = rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime;
                else if (typeof rawTime === "string" && rawTime.trim()) {
                  const numeric = Number(rawTime);
                  parsed = Number.isFinite(numeric) && numeric > 0 ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : new Date(rawTime).getTime();
                }
                return { msg, id: String(id || ""), time: parsed || 0 };
              })
              .filter((item: any) => item.id && item.time > 0 && !deletedRemoteIds.has(item.id))
              .sort((a: any, b: any) => b.time - a.time)[0];
            if (newestRemote) {
              const latestText = String(newestRemote.msg?.body || newestRemote.msg?.text || "");
              const latestType = String(newestRemote.msg?.type || "").toLowerCase();
              await db.from("whatsapp_chats").update({
                last_message: latestType.includes("revok") || newestRemote.msg?.isRevoked === true
                  ? "[message_revoke]" : latestText || (newestRemote.msg?.hasMedia ? "[mídia]" : ""),
                last_message_at: new Date(newestRemote.time).toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", chat.id);
            }
          }
        }
        return json({ messages, synced });
      }
      case "get_profile_pic": {
        const chatId = typeof body.wa_chat_id === "string" ? body.wa_chat_id : "";
        const inst = await getOwnedInstance({ waChatId: chatId });
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
