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
    console.error('[Ryze API Error] Token de conta/instância não configurado. RYZE_TOKEN_ACCOUNT ausente.');
    return {
      ok: false,
      status: 400,
      data: { error: 'Configuração pendente: RYZE_TOKEN_ACCOUNT não foi definida nos Secrets do Supabase.' },
    };
  }

  const url = `${RYZE_BASE}${path}`;
  const method = opts.method || 'GET';
  const startTime = Date.now();

  console.log(`[Ryze API Request] ${method} ${url}`, {
    authenticated: Boolean(authToken),
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body.slice(0, 500) : opts.body) : undefined,
  });

  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: {
          'token': authToken,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
      });
      const durationMs = Date.now() - startTime;
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

      console.log(`[Ryze API Response] ${method} ${url} - Status ${res.status} (${durationMs}ms)`, {
        ok: res.ok,
        status: res.status,
        dataSummary: typeof data === 'object' ? JSON.stringify(data).slice(0, 600) : data,
      });

      if (!res.ok && res.status >= 500 && i < 2) {
        console.warn(`[Ryze API Retry] Tentativa #${i + 1} para ${url} (status ${res.status})`);
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      lastErr = e;
      console.error(`[Ryze API Network Error] ${method} ${url} (tentativa ${i + 1}):`, (e as Error)?.message || e);
      if (i < 2) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

function extractQrCode(d: any): string | null {
  if (!d) return null;
  const target = d.data || d.qrcode || d.code || d;
  const raw =
    (Array.isArray(target?.qrImages) ? target.qrImages[0] : null) ||
    target?.base64 ||
    target?.qrBase64 ||
    target?.qrCodeBase64 ||
    target?.qrImage ||
    target?.qrCode ||
    target?.qr ||
    target?.code ||
    (typeof target === 'string' ? target : null) ||
    d?.base64 ||
    d?.qrCodeBase64 ||
    d?.qrCode ||
    d?.qr ||
    d?.code;

  if (typeof raw === 'string' && raw.trim().length > 5) {
    const s = raw.trim();
    if (s.startsWith('data:image')) return s;
    if (s.startsWith('iVBORw0KGgo') || s.startsWith('/9j/')) return `data:image/png;base64,${s}`;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(s)}`;
  }
  return null;
}

function normalizeInstanceName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function getRemoteInstanceName(inst: any): string {
  // IMPORTANT: Ryze instance names are case-sensitive — never lowercase them here.
  const remoteId = String(inst?.ryze_instance_id || '').trim();
  return (remoteId && !/^[0-9a-f-]{30,}$/i.test(remoteId) ? remoteId : String(inst?.name || '').trim());
}

function parseRemoteInstance(item: any) {
  const numberJid = item?.connection?.numberJid || item?.numberJid || null;
  let phone = numberJid ? String(numberJid).split('@')[0] : (item?.number || item?.phone || null);
  if (phone?.includes(':')) phone = phone.split(':')[0];
  const rawState = item?.connection?.state || item?.status || item?.state || 'disconnected';
  const status = rawState === 'connected' || rawState === 'open'
    ? 'connected'
    : rawState === 'connecting' || rawState === 'qr' ? 'qr' : 'disconnected';
  return {
    name: item?.name,
    ryze_instance_id: item?.name || item?.instanceName || item?.id,
    token_instance: item?.token || item?.tokenInstance || item?.tokenInstancia || item?.apikey || null,
    status,
    phone,
  };
}

async function getInstance(instanceId: string) {
  const { data, error } = await admin.from('whatsapp_instances').select('*').eq('id', instanceId).maybeSingle();
  if (error || !data) throw new Error('Instância não encontrada');
  return data;
}

// Lists every instance of the Ryze account.
async function listRemoteInstances(): Promise<any[]> {
  const r = await ryzeFetch('/api/instance/list', { method: 'GET', token: TOKEN_ACCOUNT });
  if (!r.ok) return [];
  const list = r.data?.instances || r.data?.data || (Array.isArray(r.data) ? r.data : []);
  return Array.isArray(list) ? list : (list ? [list] : []);
}

async function findRemoteByName(name: string): Promise<any | null> {
  const wanted = normalizeInstanceName(name);
  const items = await listRemoteInstances();
  return items.find((i: any) => normalizeInstanceName(i?.name) === wanted) || null;
}

// Resolves the real remote name/token from the Ryze account (exact, case-insensitive match).
// NEVER falls back to another instance — that used to clone the phone/status of a different number.
async function resolveRemote(inst: any): Promise<{ name: string; token: string | null; remote: any }> {
  const fallback = { name: getRemoteInstanceName(inst), token: inst.token_instance || null, remote: null as any };
  try {
    const match = await findRemoteByName(getRemoteInstanceName(inst));
    if (!match) return fallback;

    const parsed = parseRemoteInstance(match);
    await admin.from('whatsapp_instances').update({
      ryze_instance_id: parsed.ryze_instance_id || inst.ryze_instance_id,
      token_instance: parsed.token_instance || inst.token_instance,
      status: parsed.status,
      phone: parsed.phone || inst.phone,
      last_status_at: new Date().toISOString(),
      ...(parsed.status === 'connected' ? { qr_code: null } : {}),
    }).eq('id', inst.id);

    return {
      name: String(parsed.ryze_instance_id || parsed.name || fallback.name),
      token: parsed.token_instance || inst.token_instance || null,
      remote: match,
    };
  } catch (_e) {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: authErr } = await userClient.auth.getUser(jwt);
    if (authErr || !userData?.user) return json({ error: 'Não autorizado' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if (!action) return json({ error: 'Ação obrigatória' }, 400);

    console.log(`[ryze-proxy Action] ${action} disparada por user: ${userId}`);

    // -------- CREATE INSTANCE (uses TokenAccount) --------
    if (action === 'create_instance') {
      const rawName = String(body.name || '').trim();
      if (!rawName) return json({ error: 'Nome da instância é obrigatório' }, 400);
      const name = normalizeInstanceName(rawName);

      // 1) Nome já usado localmente?
      const { data: locals } = await admin.from('whatsapp_instances').select('*');
      const localDup = (locals || []).find((i: any) => normalizeInstanceName(i.name) === name);
      if (localDup) return json({ error: `Já existe uma instância chamada "${localDup.name}". Escolha outro nome.` }, 409);

      // 2) Nome já existe na Ryze? Recupera exatamente ela (sem clonar outra instância).
      const existingRemote = await findRemoteByName(name);
      if (existingRemote) {
        const parsed = parseRemoteInstance(existingRemote);
        const recovered = await admin.from('whatsapp_instances').insert({
          owner_id: userId,
          name: parsed.name || rawName,
          ryze_instance_id: parsed.ryze_instance_id,
          token_instance: parsed.token_instance,
          status: parsed.status,
          phone: parsed.phone,
        }).select('*').single();
        return json({ instance: recovered.data, recovered: true });
      }

      // 3) Cria de fato na Ryze
      const r = await ryzeFetch('/api/instance/new', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      if (!r.ok) {
        const errorMsg = r.data?.error?.message || r.data?.message || r.data?.error || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data));
        return json({ error: `Erro ao criar instância no Ryze: ${errorMsg}`, details: r.data }, r.status);
      }

      const info = r.data.instance || r.data.data?.instance || r.data.data || r.data;
      const remoteName = String(info.name || info.instanceName || name);
      const instToken = info.token || info.tokenInstance || info.hash || null;

      const inserted = await admin.from('whatsapp_instances').insert({
        owner_id: userId,
        name: rawName,
        ryze_instance_id: remoteName,
        token_instance: instToken,
        status: 'qr',
        phone: null,
      }).select('*').single();

      if (inserted.error || !inserted.data) {
        // Rollback remoto para não deixar instância órfã na Ryze
        await ryzeFetch(`/api/instance/delete/${encodeURIComponent(remoteName)}`, { method: 'DELETE', token: TOKEN_ACCOUNT }).catch(() => null);
        return json({ error: `Erro ao salvar instância: ${inserted.error?.message}` }, 500);
      }

      // 4) Já devolve o QR Code para vincular um novo número
      let qr: string | null = null;
      try {
        let c = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}?history=7`, {
          method: 'GET', token: instToken || TOKEN_ACCOUNT,
        });
        if (!c.ok) {
          c = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}`, {
            method: 'GET', token: TOKEN_ACCOUNT,
          });
        }
        if (c.ok) {
          qr = extractQrCode(c.data);
          if (qr) await admin.from('whatsapp_instances').update({ qr_code: qr, last_status_at: new Date().toISOString() }).eq('id', inserted.data.id);
        }
      } catch (_e) { /* QR pode ser buscado depois pelo botão Conectar */ }

      return json({ instance: inserted.data, qr });
    }

    // -------- RECONCILE ACCOUNT INSTANCES --------
    if (action === 'sync_instances') {
      const r = await ryzeFetch('/api/instance/list', { method: 'GET', token: TOKEN_ACCOUNT });
      if (!r.ok) return json({ error: 'Não foi possível listar as instâncias da conta Ryze', details: r.data }, r.status);

      const rawList = r.data?.instances || r.data?.data || (Array.isArray(r.data) ? r.data : []);
      const remoteItems = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);
      const { data: localItems } = await admin.from('whatsapp_instances').select('*');
      const synced = [];
      const remoteNames = new Set<string>();

      for (const remote of remoteItems) {
        const parsed = parseRemoteInstance(remote);
        if (!parsed.name) continue;
        remoteNames.add(normalizeInstanceName(parsed.name));
        const local = (localItems || []).find((item: any) =>
          normalizeInstanceName(getRemoteInstanceName(item)) === normalizeInstanceName(parsed.name)
          || normalizeInstanceName(item.name) === normalizeInstanceName(parsed.name));
        const values: Record<string, unknown> = {
          ...parsed,
          last_status_at: new Date().toISOString(),
          ...(parsed.status === 'connected' ? { qr_code: null } : {}),
        };
        if (local) delete values.name; // preserva o nome amigável escolhido pelo usuário
        const result = local
          ? await admin.from('whatsapp_instances').update(values).eq('id', local.id).select('*').single()
          : await admin.from('whatsapp_instances').insert({ owner_id: userId, ...values }).select('*').single();
        if (result.data) synced.push(result.data);
      }

      // Remove localmente as instâncias que não existem mais na Ryze
      const orphans = (localItems || []).filter((item: any) =>
        !remoteNames.has(normalizeInstanceName(getRemoteInstanceName(item)))
        && !remoteNames.has(normalizeInstanceName(item.name)));
      for (const orphan of orphans) {
        await admin.from('whatsapp_instances').delete().eq('id', orphan.id);
      }

      return json({ instances: synced, total: synced.length, removed: orphans.length });
    }

    // Everything below needs an existing instance
    const instanceId = body.instance_id as string;
    if (!instanceId) return json({ error: 'instance_id é obrigatório' }, 400);
    const inst = await getInstance(instanceId);
    const resolved = await resolveRemote(inst);
    const remoteName = resolved.name;
    const instToken = resolved.token || inst.token_instance || null;

    // -------- CONNECT (fetch QR) --------
    if (action === 'connect') {
      // Already connected on Ryze? No QR needed.
      const remoteState = resolved.remote?.connection?.state || resolved.remote?.status;
      if (remoteState === 'connected' || remoteState === 'open') {
        const phone = parseRemoteInstance(resolved.remote).phone;
        return json({ qr: null, already_connected: true, status: 'connected', phone });
      }

      let r = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}?history=7`, {
        method: 'GET', token: instToken || TOKEN_ACCOUNT,
      });

      if (!r.ok) {
        r = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}`, {
          method: 'GET', token: instToken || TOKEN_ACCOUNT,
        });
      }

      if (!r.ok && instToken) {
        r = await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}`, {
          method: 'GET', token: TOKEN_ACCOUNT,
        });
      }

      if (!r.ok) {
        const errObj = r.data?.error || r.data;
        const msg = errObj?.message || (typeof errObj === 'string' ? errObj : JSON.stringify(errObj));
        return json({ error: `Erro ao obter QR Code da API Ryze: ${msg}`, details: r.data }, r.status);
      }

      const d = r.data;
      const qrImage = extractQrCode(d);
      await admin.from('whatsapp_instances').update({
        qr_code: qrImage, status: 'qr', last_status_at: new Date().toISOString(),
      }).eq('id', instanceId);
      return json({ qr: qrImage, raw: d });
    }

    // -------- STATUS --------
    if (action === 'status') {
      const r = await ryzeFetch(`/api/instance/list?instanceName=${encodeURIComponent(remoteName)}`, {
        method: 'GET', token: TOKEN_ACCOUNT,
      });

      if (!r.ok) {
        console.error('[ryze-proxy] Erro ao consultar status da instância', r.data);
        if (r.status === 404) {
          return json({ error: 'A Ryze API retornou 404 (Not Found). Verifique se a instância ainda existe no painel da Ryze ou se a URL RYZE_BASE_URL está correta.', details: r.data }, r.status);
        }
        return json({ error: 'Erro de comunicação com a Ryze API ao verificar status', details: r.data }, r.status);
      }

      const list = r.data.instances || r.data.data || r.data;
      const item = Array.isArray(list) ? list[0] : list;

      const parsed = parseRemoteInstance(item);
      const status = parsed.status;
      const phone = parsed.phone || inst.phone;

      await admin.from('whatsapp_instances').update({
        status, phone, token_instance: parsed.token_instance || inst.token_instance,
        ryze_instance_id: parsed.ryze_instance_id || inst.ryze_instance_id,
        last_status_at: new Date().toISOString(),
        ...(status === 'connected' ? { qr_code: null } : {}),
      }).eq('id', instanceId);
      return json({ status, phone, raw: item });
    }

    // -------- DISCONNECT / LOGOUT --------
    if (action === 'disconnect' || action === 'logout') {
      try {
        await ryzeFetch(`/api/instance/logout/${encodeURIComponent(remoteName)}`, {
          method: 'DELETE', token: instToken || TOKEN_ACCOUNT,
        });
      } catch {
        await ryzeFetch(`/api/instance/logout/${encodeURIComponent(remoteName)}`, {
          method: 'POST', token: instToken || TOKEN_ACCOUNT,
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
        await ryzeFetch(`/api/instance/delete/${encodeURIComponent(remoteName)}`, {
          method: 'DELETE', token: TOKEN_ACCOUNT,
        });
      } catch {}
      try {
        await ryzeFetch(`/api/instance/delete/${encodeURIComponent(remoteName)}`, {
          method: 'DELETE', token: TOKEN_ACCOUNT,
        });
      } catch {}

      await admin.from('whatsapp_instances').delete().eq('id', instanceId);
      return json({ ok: true });
    }

    // -------- REGISTER WEBHOOK --------
    if (action === 'register_webhook') {
      const webhookSecret = Deno.env.get('RYZE_WEBHOOK_SECRET');
      if (!webhookSecret) return json({ error: 'RYZE_WEBHOOK_SECRET não configurado' }, 500);
      const url = `${SUPABASE_URL}/functions/v1/ryze-webhook?instance=${instanceId}&secret=${webhookSecret}`;
      const r = await ryzeFetch(`/api/events/webhook/${encodeURIComponent(remoteName)}`, {
        method: 'POST', token: instToken || TOKEN_ACCOUNT,
        body: JSON.stringify({
          label: 'crm-webhook', enabled: true, url,
          events: ['message.exchange', 'message.status', 'group.flow', 'instance.state'],
          mediaBase64: false,
        }),
      });
      return json({ ok: r.ok, details: r.data });
    }

    // -------- SEND TEXT --------
    if (action === 'send_text') {
      const number = String(body.number || '').replace(/\D/g, '');
      const text = String(body.text || body.message || '');
      if (!number || !text) return json({ error: 'number e text/message são obrigatórios' }, 400);

      const r = await ryzeFetch(`/api/message/text/${encodeURIComponent(remoteName)}`, {
        method: 'POST', token: instToken || TOKEN_ACCOUNT,
        body: JSON.stringify({ number, message: text }),
      });
      if (!r.ok) {
        const errorDetails = r.data?.error?.message || r.data?.message || r.data;
        return json({ error: `Erro ao enviar mensagem via Ryze API: ${errorDetails}`, details: r.data }, r.status);
      }

      const md = r.data.data || r.data;
      const waMessageId = md?.messageId || md?.key?.id || md?.id || null;
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
        wa_message_id: waMessageId,
        from_me: true, message_type: 'text', text,
        status: 'sent', timestamp: new Date().toISOString(),
        sent_by: userId, raw: md,
      });

      return json({ ok: true, message_id: waMessageId });
    }

    // -------- SEND MEDIA --------
    if (action === 'send_media') {
      const number = String(body.number || '').replace(/\D/g, '');
      const mediaUrl = body.media_url || body.mediaUrl;
      const mediaType = body.media_type || body.mediaType || 'image'; // image|video|document|audio
      const caption = body.caption || body.message || '';
      if (!number || !mediaUrl) return json({ error: 'number e media_url (ou mediaUrl) são obrigatórios' }, 400);

      const r = await ryzeFetch(`/api/message/media/${encodeURIComponent(remoteName)}`, {
        method: 'POST', token: instToken || TOKEN_ACCOUNT,
        body: JSON.stringify({ number, mediaType, mediaUrl, message: caption }),
      });
      if (!r.ok) {
        const errorDetails = r.data?.error?.message || r.data?.message || r.data;
        return json({ error: `Erro ao enviar mídia via Ryze API: ${errorDetails}`, details: r.data }, r.status);
      }

      const md = r.data.data || r.data;
      const waMessageId = md?.messageId || md?.key?.id || md?.id || null;
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
        wa_message_id: waMessageId,
        from_me: true, message_type: mediaType, text: caption, media_url: mediaUrl,
        media_mime: body.media_mime || body.mimetype || null,
        status: 'sent', timestamp: new Date().toISOString(), sent_by: userId, raw: md,
      });
      return json({ ok: true, message_id: waMessageId });
    }

    // -------- GET CHATS (sync only REAL conversations, never the whole address book) --------
    if (action === 'get_chats') {
      // 1) Contacts are used ONLY to enrich names/avatars — they are NOT conversations.
      const r = await ryzeFetch(`/api/chat/contacts/${encodeURIComponent(remoteName)}`, {
        method: 'GET', token: instToken || TOKEN_ACCOUNT,
      });

      const arr = r.ok ? (r.data.contacts || r.data.data || (Array.isArray(r.data) ? r.data : [])) : [];
      const nameByNumber = new Map<string, { name: string | null; avatar: string | null }>();
      for (const c of arr) {
        const jid = c.jid || c.remoteJid || c.id;
        if (!jid) continue;
        const number = String(jid).split('@')[0];
        nameByNumber.set(number, {
          name: c.full_name || c.push_name || c.first_name || c.business_name || c.name || null,
          avatar: c.profilePicUrl || c.avatar_url || null,
        });
      }

      // 2) Remove "phantom" chats previously created from the address book (no messages at all).
      const { data: existingChats } = await admin.from('whatsapp_chats')
        .select('id, contact_number, contact_name, last_message_at').eq('instance_id', instanceId);
      const emptyIds = (existingChats || []).filter((c: any) => !c.last_message_at).map((c: any) => c.id);
      if (emptyIds.length) {
        await admin.from('whatsapp_messages').delete().in('chat_id', emptyIds);
        await admin.from('whatsapp_chats').delete().in('id', emptyIds);
      }

      // 3) Enrich the remaining real conversations with contact names/avatars.
      let enriched = 0;
      for (const c of (existingChats || [])) {
        if (!c.last_message_at) continue;
        const info = nameByNumber.get(c.contact_number);
        if (!info?.name) continue;
        if (c.contact_name && c.contact_name !== c.contact_number) continue;
        await admin.from('whatsapp_chats')
          .update({ contact_name: info.name, ...(info.avatar ? { avatar_url: info.avatar } : {}) })
          .eq('id', c.id);
        enriched++;
      }

      // 4) Ask Ryze to replay the last 7 days of history through the webhook,
      //    so recent conversations show up without importing every contact.
      await ryzeFetch(`/api/instance/connect/${encodeURIComponent(remoteName)}?history=7`, {
        method: 'GET', token: instToken || TOKEN_ACCOUNT,
      }).catch(() => null);

      const remaining = (existingChats || []).length - emptyIds.length;
      console.log(`[ryze-proxy] get_chats: ${remaining} conversas reais, ${emptyIds.length} vazias removidas, ${enriched} nomes atualizados`);
      return json({ synced: remaining, removed: emptyIds.length, enriched, contacts: nameByNumber.size });
    }


    // -------- GET MESSAGES (Fetch chat history from Ryze & sync into DB) --------
    if (action === 'get_messages') {
      const waChatId = body.wa_chat_id;
      if (!waChatId) return json({ error: 'wa_chat_id é obrigatório' }, 400);

      // Ryze Official Endpoint: POST /api/chat/history/:instance
      // Only the latest messages are needed — the rest arrives live via webhook.
      const count = Math.min(Number(body.count) || 50, 100);
      const r = await ryzeFetch(`/api/chat/history/${encodeURIComponent(remoteName)}`, {
        method: 'POST', token: instToken || TOKEN_ACCOUNT,
        body: JSON.stringify({ number: waChatId, count }),
      });


      if (!r.ok) {
        const errorDetails = r.data?.error?.message || r.data?.message || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data));
        console.error(`[ryze-proxy] Erro no get_messages para ${waChatId}:`, errorDetails);
        return json({ error: `Erro na Ryze API (get_messages): ${errorDetails}`, details: r.data }, r.status);
      }

      const arr = r.data.messages || r.data.data || (Array.isArray(r.data) ? r.data : []);
      const number = String(waChatId).split('@')[0];
      const isGroup = String(waChatId).includes('@g.us');

      // Ensure chat exists in DB
      let { data: chat } = await admin.from('whatsapp_chats').select('*')
        .eq('instance_id', instanceId).eq('wa_chat_id', waChatId).maybeSingle();

      if (!chat) {
        const ins = await admin.from('whatsapp_chats').insert({
          instance_id: instanceId,
          wa_chat_id: waChatId,
          contact_number: number,
          contact_name: number,
          is_group: isGroup,
        }).select('*').single();
        chat = ins.data;
      }

      let latestMessage: any = null;
      let syncedCount = 0;

      if (chat) {
        for (const m of arr) {
          const msgId = m.id || m.key?.id;
          if (!msgId) continue;
          const text = m.content || m.text || m.message?.conversation || m.message?.extendedTextMessage?.text || '';
          const fromMe = m.fromMe !== undefined ? Boolean(m.fromMe) : !!m.key?.fromMe;
          const messageType = m.type || 'text';
          const timestamp = m.timestamp
            ? (typeof m.timestamp === 'number' ? new Date(m.timestamp * 1000).toISOString() : new Date(m.timestamp).toISOString())
            : new Date().toISOString();

          if (!latestMessage || new Date(timestamp) > new Date(latestMessage.timestamp)) {
            latestMessage = { text, timestamp };
          }

          await admin.from('whatsapp_messages').upsert({
            chat_id: chat.id,
            instance_id: instanceId,
            wa_message_id: msgId,
            from_me: fromMe,
            sender: m.senderJid || (fromMe ? 'Me' : chat.contact_name),
            message_type: messageType,
            text,
            status: fromMe ? 'sent' : 'delivered',
            timestamp,
            raw: m,
          }, { onConflict: 'instance_id,wa_message_id' });

          syncedCount++;
        }

        if (latestMessage) {
          await admin.from('whatsapp_chats').update({
            last_message: latestMessage.text,
            last_message_at: latestMessage.timestamp,
          }).eq('id', chat.id);
        }
      }

      console.log(`[ryze-proxy] get_messages finalizado para ${waChatId}. Total sincronizado: ${syncedCount}`);
      return json({ synced: syncedCount });
    }

    // -------- GET CONTACTS --------
    if (action === 'get_contacts') {
      // Ryze Official Endpoint: GET /api/chat/contacts/:instance
      const r = await ryzeFetch(`/api/chat/contacts/${encodeURIComponent(remoteName)}`, {
        method: 'GET', token: instToken || TOKEN_ACCOUNT,
      });

      if (!r.ok) {
        const errorDetails = r.data?.error?.message || r.data?.message || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data));
        console.error('[ryze-proxy] Erro no get_contacts:', errorDetails);
        return json({ error: `Erro na Ryze API (get_contacts): ${errorDetails}`, details: r.data }, r.status);
      }

      const arr = r.data.contacts || r.data.data || (Array.isArray(r.data) ? r.data : []);
      let syncedCount = 0;

      for (const c of arr) {
        const jid = c.jid || c.remoteJid || c.id;
        if (!jid) continue;
        const number = String(jid).split('@')[0];
        const contactName = c.full_name || c.push_name || c.first_name || c.business_name || c.name || null;

        await admin.from('whatsapp_contacts').upsert({
          instance_id: instanceId,
          wa_number: number,
          name: contactName,
          push_name: c.push_name || c.pushName || null,
          avatar_url: c.profilePicUrl || c.avatar_url || null,
          is_group: String(jid).includes('@g.us'),
          raw: c,
        }, { onConflict: 'instance_id,wa_number' });

        syncedCount++;
      }

      return json({ synced: syncedCount, total: r.data.total || syncedCount });
    }

    // -------- GET PROFILE PICTURE (uma vez por conversa) --------
    if (action === 'get_profile_pic') {
      // Ryze Official Endpoint: GET /api/profile/getAccount/:instance?number=5511988887777
      const rawJid = String(body.wa_chat_id || body.number || '').trim();
      if (!rawJid) return json({ error: 'wa_chat_id ou number obrigatório' }, 400);
      const number = rawJid.split('@')[0].replace(/\D/g, '');
      if (!number) return json({ error: 'Número inválido' }, 400);

      // Se já temos avatar salvo, não repetimos o GET na Ryze.
      const { data: existing } = await admin
        .from('whatsapp_chats')
        .select('id, avatar_url')
        .eq('instance_id', instanceId)
        .eq('wa_chat_id', rawJid)
        .maybeSingle();

      if (existing?.avatar_url) {
        return json({ avatar_url: existing.avatar_url, cached: true });
      }

      const r = await ryzeFetch(
        `/api/profile/getAccount/${encodeURIComponent(remoteName)}?number=${encodeURIComponent(number)}`,
        { method: 'GET', token: instToken || TOKEN_ACCOUNT },
      );

      if (!r.ok) {
        const errorDetails = r.data?.error?.message || r.data?.message || JSON.stringify(r.data);
        console.warn('[ryze-proxy] get_profile_pic falhou:', errorDetails);
        return json({ avatar_url: null, error_details: errorDetails });
      }

      const d = r.data?.data || r.data || {};
      const avatar =
        d.profilePicUrl || d.picture || d.profile_pic_url || d.imgUrl ||
        d.profilePictureUrl || d.avatar_url || r.data?.profilePicUrl || 
        r.data?.data?.profilePicUrl || r.data?.data?.avatarUrl || 
        r.data?.data?.imgUrl || r.data?.data?.picture || d.imageUrl || 
        r.data?.imageUrl || d.photo || d.url || null;
      const displayName = d.name || d.pushName || d.verifiedName || d.business_name || null;

      if (avatar) {
        if (existing?.id) {
          await admin.from('whatsapp_chats')
            .update({ avatar_url: avatar })
            .eq('id', existing.id);
        }
        await admin.from('whatsapp_contacts').upsert({
          instance_id: instanceId,
          wa_number: number,
          name: displayName,
          avatar_url: avatar,
          is_group: rawJid.includes('@g.us'),
          raw: d,
        }, { onConflict: 'instance_id,wa_number' });
      }

      return json({ avatar_url: avatar, name: displayName, cached: false });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error('ryze-proxy erro geral:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
