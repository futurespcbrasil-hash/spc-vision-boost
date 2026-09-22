import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, serviceRoleKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Sessão inválida' }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: 'Dados inválidos' }, 400); }

  const name = String(payload.name ?? '').trim();
  const document = String(payload.document ?? '').trim() || null;
  const personType = payload.person_type === 'pf' ? 'pf' : 'pj';
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = String(payload.phone ?? '').trim() || null;
  const password = String(payload.password ?? '');

  if (!name || !email || password.length < 6) return json({ error: 'Informe nome, e-mail e uma senha com pelo menos 6 caracteres.' }, 400);

  const { data: memberships, error: membershipError } = await admin.from('account_members').select('account_id').eq('user_id', user.id).eq('active', true);
  if (membershipError) return json({ error: membershipError.message }, 500);

  const ids = (memberships ?? []).map((m: any) => m.account_id);
  let ownerAccount: any = null;
  if (ids.length) {
    const { data } = await admin.from('accounts').select('id, account_type').in('id', ids).eq('account_type', 'dono_app').limit(1).maybeSingle();
    ownerAccount = data;
  }
  if (!ownerAccount) return json({ error: 'Apenas o Dono do App pode cadastrar revendas.' }, 403);

  const { data: existingAccount } = await admin.from('accounts').select('id').ilike('email', email).limit(1).maybeSingle();
  if (existingAccount) return json({ error: 'Já existe uma conta com este e-mail.' }, 409);

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name, account_type: 'revenda' },
  });
  if (createUserError || !createdUser.user) return json({ error: createUserError?.message ?? 'Não foi possível criar o usuário.' }, 400);

  const newUserId = createdUser.user.id;
  let accountId: string | null = null;

  try {
    const { data: account, error: accountError } = await admin.from('accounts').insert({
      account_type: 'revenda', parent_account_id: ownerAccount.id, name, document, person_type: personType,
      status: 'ativo', email, phone, created_by: user.id,
    }).select('id').single();
    if (accountError || !account) throw new Error(accountError?.message ?? 'Não foi possível criar a revenda.');
    accountId = account.id;

    const { error: profileError } = await admin.from('profiles').upsert({ id: newUserId, full_name: name, phone, active: true });
    if (profileError) throw new Error(profileError.message);

    const { error: memberError } = await admin.from('account_members').insert({ account_id: accountId, user_id: newUserId, role: 'administrador', active: true });
    if (memberError) throw new Error(memberError.message);

    return json({ success: true, account_id: accountId, user_id: newUserId, message: 'Revenda criada com acesso liberado.' }, 201);
  } catch (error) {
    if (accountId) await admin.from('accounts').delete().eq('id', accountId);
    await admin.auth.admin.deleteUser(newUserId);
    return json({ error: error instanceof Error ? error.message : 'Erro ao criar revenda.' }, 500);
  }
});
