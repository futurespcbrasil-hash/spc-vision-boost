// Ryze webhook receiver — public endpoint. Ryze posts events here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RYZE_WEBHOOK_SECRET');

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const instanceId = url.searchParams.get('instance');
  const secret = url.searchParams.get('secret');

  if (!WEBHOOK_SECRET || !instanceId || secret !== WEBHOOK_SECRET) {
    console.warn('[ryze-webhook] Acesso negado: instanceId ou secret inválido', { instanceId });
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch {}
  const eventName = payload?.event || payload?.type || 'unknown';
  console.log(`[ryze-webhook Event] ${eventName} para instância ${instanceId}`, JSON.stringify(payload).slice(0, 500));

  try {
    const data = payload.data || payload;

    // Instance state updates
    if (eventName.includes('instance') || eventName.includes('state')) {
      const rawStatus = data?.status || data?.state || data?.connection?.state;
      if (rawStatus) {
        const status = (rawStatus === 'connected' || rawStatus === 'open') ? 'connected' : (rawStatus === 'connecting' || rawStatus === 'qr' ? 'qr' : 'disconnected');
        console.log(`[ryze-webhook] Atualizando status da instância ${instanceId} para ${status}`);
        await admin.from('whatsapp_instances').update({
          status, last_status_at: new Date().toISOString(),
          ...(status === 'connected' ? { qr_code: null } : {}),
        }).eq('id', instanceId);
      }
    }

    // Delivery/read receipts use a separate payload from message.exchange.
    if (eventName === 'message.status') {
      const messageIds = Array.isArray(data?.messageIds) ? data.messageIds : [];
      const receiptStatus = data?.status;
      if (messageIds.length > 0 && receiptStatus) {
        await admin.from('whatsapp_messages')
          .update({ status: receiptStatus })
          .eq('instance_id', instanceId)
          .in('wa_message_id', messageIds);
      }
    }

    // Message received or sent
    if (eventName === 'message.exchange' || data?.key || data?.messages || data?.messageId) {
      // Ryze `message.exchange` keeps chat/sender at the top level and the payload
      // inside `data.message`, so never drop the outer object.
      const msgs = Array.isArray(data.messages) ? data.messages : [data];
      for (const m of msgs) {
        if (!m) continue;
        const inner = (m.message && typeof m.message === 'object') ? m.message : {};
        const remoteJid = m.chat?.jid || m.chatJid || m.key?.remoteJid || m.remoteJid
          || (m.direction === 'outgoing' ? m.recipient?.jid : m.sender?.jid);
        if (!remoteJid) continue;

        const fromMe = m.direction ? m.direction === 'outgoing' : (m.fromMe !== undefined ? Boolean(m.fromMe) : !!m.key?.fromMe);
        const number = String(remoteJid).split('@')[0];
        const isGroup = String(remoteJid).includes('@g.us') || m.chat?.type === 'group';
        const msgId = m.id || m.messageId || m.key?.id;
        if (!msgId) continue;

        const text = (typeof inner.content === 'string' ? inner.content : inner.content?.text)
          || (typeof m.content === 'string' ? m.content : m.content?.text)
          || inner.caption || m.text || inner.conversation
          || inner.extendedTextMessage?.text
          || inner.imageMessage?.caption
          || inner.videoMessage?.caption
          || '';
        let messageType = inner.type || m.media?.type || m.type || m.messageType || 'text';
        let mediaMime: string | null = inner.media?.mimetype || m.media?.mimetype || null;
        let mediaUrl: string | null = inner.media?.s3Url || inner.media?.url || m.media?.s3Url || m.media?.url || null;
        if (inner.imageMessage) { messageType = 'image'; mediaMime = inner.imageMessage.mimetype; }
        else if (inner.videoMessage) { messageType = 'video'; mediaMime = inner.videoMessage.mimetype; }
        else if (inner.audioMessage) { messageType = 'audio'; mediaMime = inner.audioMessage.mimetype; }
        else if (inner.documentMessage) { messageType = 'document'; mediaMime = inner.documentMessage.mimetype; }

        // upsert chat
        const { data: existing } = await admin.from('whatsapp_chats')
          .select('id, unread_count').eq('instance_id', instanceId).eq('wa_chat_id', remoteJid).maybeSingle();
        let chatId = existing?.id;

        const lastMsgText = text || `[${messageType}]`;
        if (!chatId) {
          const ins = await admin.from('whatsapp_chats').insert({
            instance_id: instanceId, wa_chat_id: remoteJid,
            contact_number: number, contact_name: m.chat?.name || m.sender?.name || m.pushName || m.senderJid?.split('@')[0] || number,
            is_group: isGroup,
            last_message: lastMsgText,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1,
          }).select('id').single();
          chatId = ins.data?.id;
        } else {
          await admin.from('whatsapp_chats').update({
            last_message: lastMsgText,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? (existing.unread_count || 0) : (existing.unread_count || 0) + 1,
          }).eq('id', chatId);
        }

        const msgTimestamp = m.timestamp
          ? (typeof m.timestamp === 'number' ? new Date(m.timestamp * 1000).toISOString() : new Date(m.timestamp).toISOString())
          : new Date().toISOString();

        await admin.from('whatsapp_messages').upsert({
          chat_id: chatId, instance_id: instanceId,
          wa_message_id: msgId, from_me: fromMe,
          sender: m.sender?.name || m.sender?.jid || m.pushName || m.senderJid || number,
          message_type: messageType, text,
          media_mime: mediaMime,
          media_url: mediaUrl,
          status: m.status || (fromMe ? 'sent' : 'delivered'),
          timestamp: msgTimestamp,
          raw: m,
        }, { onConflict: 'instance_id,wa_message_id' });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ryze-webhook Error]:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
