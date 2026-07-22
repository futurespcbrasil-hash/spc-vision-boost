// Ryze webhook receiver — public endpoint. Ryze posts events here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RYZE_WEBHOOK_SECRET') || 'default-secret';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const instanceId = url.searchParams.get('instance');
  const secret = url.searchParams.get('secret');

  if (!instanceId || secret !== WEBHOOK_SECRET) {
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

    // Message received or sent
    if (eventName.includes('message') || data?.key || data?.messages || data?.messageId || data?.id) {
      const msgs = Array.isArray(data.messages) ? data.messages : [data];
      for (const m of msgs) {
        if (!m) continue;
        const remoteJid = m.chatJid || m.key?.remoteJid || m.remoteJid;
        if (!remoteJid) continue;

        const fromMe = m.fromMe !== undefined ? Boolean(m.fromMe) : !!m.key?.fromMe;
        const number = String(remoteJid).split('@')[0];
        const isGroup = String(remoteJid).includes('@g.us');
        const msgId = m.id || m.messageId || m.key?.id;
        if (!msgId) continue;

        const text = m.content || m.text || m.message?.conversation
          || m.message?.extendedTextMessage?.text
          || m.message?.imageMessage?.caption
          || m.message?.videoMessage?.caption
          || '';
        let messageType = m.type || m.messageType || 'text';
        let mediaMime: string | null = null;
        if (m.message?.imageMessage) { messageType = 'image'; mediaMime = m.message.imageMessage.mimetype; }
        else if (m.message?.videoMessage) { messageType = 'video'; mediaMime = m.message.videoMessage.mimetype; }
        else if (m.message?.audioMessage) { messageType = 'audio'; mediaMime = m.message.audioMessage.mimetype; }
        else if (m.message?.documentMessage) { messageType = 'document'; mediaMime = m.message.documentMessage.mimetype; }

        // upsert chat
        const { data: existing } = await admin.from('whatsapp_chats')
          .select('id, unread_count').eq('instance_id', instanceId).eq('wa_chat_id', remoteJid).maybeSingle();
        let chatId = existing?.id;

        const lastMsgText = text || `[${messageType}]`;
        if (!chatId) {
          const ins = await admin.from('whatsapp_chats').insert({
            instance_id: instanceId, wa_chat_id: remoteJid,
            contact_number: number, contact_name: m.pushName || m.senderJid?.split('@')[0] || number,
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
          sender: m.pushName || m.senderJid || number,
          message_type: messageType, text,
          media_mime: mediaMime,
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
