// Ryze API proxy — all Ryze traffic goes through here. Frontend never talks to Ryze directly.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const RYZE_BASE = Deno.env.get('RYZE_BASE_URL') || 'https://ryzeapi.cloud';
const TOKEN_ACCOUNT = Deno.env.get('RYZE_TOKEN_ACCOUNT');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function ryzeFetch(path: string, opts: RequestInit & { token?: string } = {}) {
  const { token, headers, ...rest } = opts;
  const authToken = token || TOKEN_ACCOUNT;
  if (!authToken) {
    return {
      ok: false,
      status: 400,
      data: { error: 'Configuração pendente: RYZE_TOKEN_ACCOUNT não foi definida nos Secrets do Supabase.' },
    };
  }

  let lastErr: unknown;
  // retry up to 3x on 5xx/network
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${RYZE_BASE}${path}`, {
        ...rest,
        headers: {
          'token': authToken,
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok && res.status >= 500 && i < 2) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

function extractQrCode(d: any): string | null {
  if (!d) return null;
  const target = d.data || d.qrcode || d;
  const raw =
    (Array.isArray(target?.qrImages) ? target.qrImages[0] : null) ||
    target?.base64 ||
    target?.qrBase64 ||
    target?.qrImage ||
    target?.qrCode ||
    target?.qr ||
    target?.code ||
    d?.base64 ||
    d?.qrCode ||
    d?.qr ||
    d?.code;

  if (typeof raw === 'string' && raw.trim().length > 10) {
    const s = raw.trim();
    if (s.startsWith('data:image')) return s;
    if (s.startsWith('iVBORw0KGgo') || s.startsWith('/9j/')) return `data:image/png;base64,${s}`;
    return s;
  }
  return null;
}

async function getInstance(instanceId: string) {
  const { data, error } = await admin.from('whatsapp_instances').select('*').eq('id', instanceId).maybeSingle();
  if (error || !data) throw new Error('Instance not found');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: authErr } = await userClient.auth.getUser(jwt);
    if (authErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if (!action) return json({ error: 'action required' }, 400);

    // -------- CREATE INSTANCE (uses TokenAccount) --------
    if (action === 'create_instance') {
      const rawName = String(body.name || '').trim();
      if (!rawName) return json({ error: 'Nome da instância é obrigatório' }, 400);
      const name = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      let r = await ryzeFetch('/api/instance/new', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      if (!r.ok && r.status === 404) {
        r = await ryzeFetch('/api/instance/create', {
          method: 'POST',
          body: JSON.stringify({ instanceName: name, name }),
        });
      }

      if (!r.ok) {
        const errorMsg = r.data?.message || r.data?.error || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data));
        if (String(errorMsg).includes('already exists')) {
          return json({
            error: `A instância "${rawName}" já existe no Ryze. Exclua a instância antiga com o botão "Excluir" ou escolha outro nome (ex: ${rawName}-01).`,
            details: r.data,
          }, 400);
        }
        return json({ error: 'Erro ao criar instância no Ryze', details: r.data }, r.status);
      }

      const info = r.data.data || r.data;
      const inserted = await admin.from('whatsapp_instances').insert({
        owner_id: userId,
        name: rawName,
        ryze_instance_id: info.id || info.instanceId || info.instance_id || name,
        token_instance: info.token || info.hash || null,
        status: info.status || 'disconnected',
      }).select('*').single();
      return json({ instance: inserted.data });
    }

    // Everything below needs an existing instance
    const instanceId = body.instance_id as string;
    if (!instanceId) return json({ error: 'instance_id required' }, 400);
    const inst = await getInstance(instanceId);

    // -------- CONNECT (fetch QR) --------
    if (action === 'connect') {
      const sanitizedName = inst.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      let r = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(sanitizedName)}`, {
        method: 'GET', token: inst.token_instance,
      });

      if (!r.ok) {
        r = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(inst.name)}`, {
          method: 'GET', token: inst.token_instance,
        });
      }

      if (!r.ok) return json({ error: 'Erro da API Ryze ao obter QR Code', details: r.data }, r.status);

      const d = r.data;
      const qrImage = extractQrCode(d);
      await admin.from('whatsapp_instances').update({
        qr_code: qrImage, status: 'qr', last_status_at: new Date().toISOString(),
      }).eq('id', instanceId);
      return json({ qr: qrImage, raw: d });
    }

    // -------- STATUS --------
    if (action === 'status') {
      const r = await ryzeFetch(`/api/instance/list?instanceName=${encodeURIComponent(inst.name)}`, {
        method: 'GET', token: inst.token_instance,
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const list = r.data.data || r.data;
      const item = Array.isArray(list) ? list[0] : list;
      const status = item?.status || 'unknown';
      const phone = item?.number || item?.phone || inst.phone;
      await admin.from('whatsapp_instances').update({
        status, phone, last_status_at: new Date().toISOString(),
        ...(status === 'connected' ? { qr_code: null } : {}),
      }).eq('id', instanceId);
      return json({ status, phone, raw: item });
    }

    // -------- DISCONNECT / LOGOUT --------
    if (action === 'disconnect' || action === 'logout') {
      try {
        await ryzeFetch(`/api/instance/logout/${encodeURIComponent(inst.name)}`, {
          method: 'DELETE', token: inst.token_instance,
        });
      } catch {
        await ryzeFetch(`/api/instance/logout/${encodeURIComponent(inst.name)}`, {
          method: 'POST', token: inst.token_instance,
        }).catch(() => null);
      }
      await admin.from('whatsapp_instances').update({
        status: 'disconnected', qr_code: null, last_status_at: new Date().toISOString(),
      }).eq('id', instanceId);
      return json({ ok: true });
    }

    // -------- DELETE INSTANCE --------
    if (action === 'delete_instance') {
      try {
        await ryzeFetch(`/api/instance/delete/${encodeURIComponent(inst.name)}`, {
          method: 'DELETE', token: inst.token_instance,
        });
      } catch {
        await ryzeFetch(`/api/instance/${encodeURIComponent(inst.name)}`, {
          method: 'DELETE', token: inst.token_instance,
        }).catch(() => null);
      }
      await admin.from('whatsapp_instances').delete().eq('id', instanceId);
      return json({ ok: true });
    }

    // -------- REGISTER WEBHOOK --------
    if (action === 'register_webhook') {
      const webhookSecret = Deno.env.get('RYZE_WEBHOOK_SECRET')!;
      const url = `${SUPABASE_URL}/functions/v1/ryze-webhook?instance=${instanceId}&secret=${webhookSecret}`;
      const r = await ryzeFetch(`/api/events/webhook/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance,
        body: JSON.stringify({
          label: 'lovable-default', enabled: true, url,
          events: ['message.exchange', 'group.flow', 'instance.state'],
          mediaBase64: false,
        }),
      });
      return json({ ok: r.ok, details: r.data });
    }

    // -------- SEND TEXT --------
    if (action === 'send_text') {
      const number = String(body.number || '').replace(/\D/g, '');
      const text = String(body.text || '');
      if (!number || !text) return json({ error: 'number and text required' }, 400);
      const r = await ryzeFetch(`/api/message/text/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance,
        body: JSON.stringify({ number, text }),
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const md = r.data.data || r.data;
      const waChatId = `${number}@s.whatsapp.net`;

      // Upsert chat
      const { data: existingChat } = await admin.from('whatsapp_chats')
        .select('*').eq('instance_id', instanceId).eq('wa_chat_id', waChatId).maybeSingle();
      let chatId = existingChat?.id;
      if (!chatId) {
        const ins = await admin.from('whatsapp_chats').insert({
          instance_id: instanceId, wa_chat_id: waChatId,
          contact_number: number, contact_name: number,
          last_message: text, last_message_at: new Date().toISOString(),
          assigned_to: userId,
        }).select('id').single();
        chatId = ins.data?.id;
      } else {
        await admin.from('whatsapp_chats').update({
          last_message: text, last_message_at: new Date().toISOString(),
          ...(existingChat.assigned_to ? {} : { assigned_to: userId }),
        }).eq('id', chatId);
      }

      await admin.from('whatsapp_messages').insert({
        chat_id: chatId, instance_id: instanceId,
        wa_message_id: md?.key?.id || md?.id || null,
        from_me: true, message_type: 'text', text,
        status: 'sent', timestamp: new Date().toISOString(),
        sent_by: userId, raw: md,
      });

      return json({ ok: true, message_id: md?.key?.id || md?.id });
    }

    // -------- SEND MEDIA --------
    if (action === 'send_media') {
      const number = String(body.number || '').replace(/\D/g, '');
      const mediaUrl = body.media_url;
      const mediaType = body.media_type || 'image'; // image|video|document|audio
      const caption = body.caption || '';
      if (!number || !mediaUrl) return json({ error: 'number and media_url required' }, 400);
      const r = await ryzeFetch(`/api/message/media/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance,
        body: JSON.stringify({ number, mediatype: mediaType, media: mediaUrl, caption }),
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const md = r.data.data || r.data;
      const waChatId = `${number}@s.whatsapp.net`;
      const { data: existingChat } = await admin.from('whatsapp_chats')
        .select('id, assigned_to').eq('instance_id', instanceId).eq('wa_chat_id', waChatId).maybeSingle();
      let chatId = existingChat?.id;
      if (!chatId) {
        const ins = await admin.from('whatsapp_chats').insert({
          instance_id: instanceId, wa_chat_id: waChatId, contact_number: number,
          contact_name: number, last_message: `[${mediaType}] ${caption}`,
          last_message_at: new Date().toISOString(), assigned_to: userId,
        }).select('id').single();
        chatId = ins.data?.id;
      } else {
        await admin.from('whatsapp_chats').update({
          last_message: `[${mediaType}] ${caption}`, last_message_at: new Date().toISOString(),
          ...(existingChat.assigned_to ? {} : { assigned_to: userId }),
        }).eq('id', chatId);
      }
      await admin.from('whatsapp_messages').insert({
        chat_id: chatId, instance_id: instanceId,
        wa_message_id: md?.key?.id || md?.id || null,
        from_me: true, message_type: mediaType, text: caption, media_url: mediaUrl,
        status: 'sent', timestamp: new Date().toISOString(), sent_by: userId, raw: md,
      });
      return json({ ok: true });
    }

    // -------- GET CHATS (from Ryze, sync into db) --------
    if (action === 'get_chats') {
      const r = await ryzeFetch(`/api/chat/findChats/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance, body: JSON.stringify({}),
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const arr = Array.isArray(r.data) ? r.data : (r.data.data || r.data.chats || []);
      for (const c of arr) {
        const remoteJid = c.remoteJid || c.id || c.chatId;
        if (!remoteJid) continue;
        const number = String(remoteJid).split('@')[0];
        const isGroup = String(remoteJid).includes('@g.us');
        await admin.from('whatsapp_chats').upsert({
          instance_id: instanceId, wa_chat_id: remoteJid,
          contact_number: number, contact_name: c.name || c.pushName || number,
          is_group: isGroup, avatar_url: c.profilePicUrl || null,
          last_message: c.lastMessage?.text || c.lastMessage?.body || null,
          last_message_at: c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp * 1000).toISOString() : null,
        }, { onConflict: 'instance_id,wa_chat_id' });
      }
      return json({ synced: arr.length });
    }

    // -------- GET MESSAGES for a chat --------
    if (action === 'get_messages') {
      const waChatId = body.wa_chat_id;
      if (!waChatId) return json({ error: 'wa_chat_id required' }, 400);
      const r = await ryzeFetch(`/api/chat/findMessages/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance,
        body: JSON.stringify({ where: { key: { remoteJid: waChatId } }, limit: 200 }),
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const arr = Array.isArray(r.data) ? r.data : (r.data.data || r.data.messages || []);
      const { data: chat } = await admin.from('whatsapp_chats').select('id')
        .eq('instance_id', instanceId).eq('wa_chat_id', waChatId).maybeSingle();
      if (chat) {
        for (const m of arr) {
          const msgId = m.key?.id || m.id;
          if (!msgId) continue;
          const text = m.message?.conversation || m.message?.extendedTextMessage?.text || m.text || '';
          await admin.from('whatsapp_messages').upsert({
            chat_id: chat.id, instance_id: instanceId, wa_message_id: msgId,
            from_me: !!m.key?.fromMe, message_type: 'text', text,
            timestamp: m.messageTimestamp ? new Date(m.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
            raw: m,
          }, { onConflict: 'instance_id,wa_message_id' });
        }
      }
      return json({ synced: arr.length });
    }

    // -------- GET CONTACTS --------
    if (action === 'get_contacts') {
      const r = await ryzeFetch(`/api/chat/findContacts/${encodeURIComponent(inst.name)}`, {
        method: 'POST', token: inst.token_instance, body: JSON.stringify({}),
      });
      if (!r.ok) return json({ error: 'Ryze error', details: r.data }, r.status);
      const arr = Array.isArray(r.data) ? r.data : (r.data.data || r.data.contacts || []);
      for (const c of arr) {
        const jid = c.id || c.remoteJid;
        if (!jid) continue;
        const number = String(jid).split('@')[0];
        await admin.from('whatsapp_contacts').upsert({
          instance_id: instanceId, wa_number: number,
          name: c.name || c.pushName || null, push_name: c.pushName || null,
          avatar_url: c.profilePicUrl || null,
          is_group: String(jid).includes('@g.us'), raw: c,
        }, { onConflict: 'instance_id,wa_number' });
      }
      return json({ synced: arr.length });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error('ryze-proxy error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
