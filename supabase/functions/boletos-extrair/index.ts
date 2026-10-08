import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/\.PDF$/i, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const SUFFIX = /\b(LTDA|ME|EPP|EIRELI|S ?A|MEI|SS|LTDA ME|CIA)\b/g;
const core = (s: string) => norm(s).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const validDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Não autenticado' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);

    const { boleto_id } = await req.json();
    if (typeof boleto_id !== 'string') return json({ error: 'boleto_id obrigatório' }, 400);
    const { data: b, error: be } = await sb.from('boleto_envios').select('*').eq('id', boleto_id).maybeSingle();
    if (be || !b) return json({ error: 'Boleto não encontrado' }, 404);
    if (b.user_id !== u.user.id) return json({ error: 'Sem permissão' }, 403);

    await sb.from('boleto_envios').update({ status: 'processando', erro: null }).eq('id', b.id);

    const { data: file, error: fe } = await sb.storage.from('boletos').download(b.arquivo_path);
    if (fe || !file) {
      await sb.from('boleto_envios').update({ status: 'erro', erro: 'Arquivo não encontrado no armazenamento' }).eq('id', b.id);
      return json({ error: 'Arquivo não encontrado' }, 404);
    }
    const b64 = toBase64(await file.arrayBuffer());

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const prompt = `Você lê boletos bancários brasileiros (PDF com texto ou imagem escaneada). Extraia SOMENTE o que estiver escrito no documento. NUNCA invente: se não encontrar um campo, use null.
Retorne APENAS JSON com as chaves:
{"pagador_nome": string|null, "pagador_cpf_cnpj": string|null, "valor": number|null, "vencimento": "AAAA-MM-DD"|null, "nosso_numero": string|null, "linha_digitavel": string|null, "codigo_barras": string|null, "numero_documento": string|null, "data_emissao": "AAAA-MM-DD"|null, "banco": string|null, "legivel": boolean}
Atenção: "pagador" é o cliente que vai pagar (não o beneficiário/cedente). valor em reais como número (ex.: 1250.00).`;

    const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'file', file: { filename: b.arquivo_nome, file_data: `data:application/pdf;base64,${b64}` } },
        ] }],
      }),
    });
    if (!ai.ok) {
      const t = await ai.text();
      const msg = ai.status === 429 ? 'Limite de leituras atingido, tente novamente em instantes' : ai.status === 402 ? 'Créditos de IA esgotados' : `Falha na leitura (${ai.status})`;
      console.error('AI error', ai.status, t.slice(0, 300));
      await sb.from('boleto_envios').update({ status: 'erro', erro: msg }).eq('id', b.id);
      return json({ error: msg }, 200);
    }
    const aj = await ai.json();
    let ex: any = {};
    try {
      const c = String(aj.choices?.[0]?.message?.content || '{}').replace(/```json?/g, '').replace(/```/g, '').trim();
      ex = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch { ex = {}; }

    const doc = digits(ex.pagador_cpf_cnpj);
    const cpfCnpj = doc.length === 11 || doc.length === 14 ? doc : null;
    const valor = typeof ex.valor === 'number' && ex.valor > 0 ? Math.round(ex.valor * 100) / 100 : null;
    const venc = validDate(ex.vencimento);
    const nome = typeof ex.pagador_nome === 'string' && ex.pagador_nome.trim() ? ex.pagador_nome.trim() : null;

    // Identificação do cliente
    const { data: clientes } = await sb.from('boleto_clientes').select('id,nome,razao_social,cpf_cnpj,whatsapp').eq('user_id', u.user.id);
    const list = clientes || [];
    let match: any = null; let info = '';
    if (cpfCnpj) {
      const m = list.filter((c) => digits(c.cpf_cnpj) === cpfCnpj);
      if (m.length === 1) { match = m[0]; info = 'Identificado pelo CPF/CNPJ'; }
      else if (m.length > 1) info = 'Mais de um cliente com o mesmo CPF/CNPJ';
    }
    const byName = (label: string, src: string | null) => {
      if (match || !src) return;
      const k = core(src); if (!k) return;
      const m = list.filter((c) => core(c.nome) === k || (c.razao_social && core(c.razao_social) === k));
      if (m.length === 1) { match = m[0]; info = `Identificado pelo ${label} (confirme)`; }
      else if (m.length > 1) info = `Mais de um cliente possível pelo ${label}`;
    };
    if (!match && !info) byName('nome do pagador', nome);
    if (!match && !info) byName('nome do arquivo', b.arquivo_nome);
    if (!match && !info) info = 'Nenhum cliente encontrado no cadastro';

    const strong = match && info === 'Identificado pelo CPF/CNPJ';
    const whatsapp = match?.whatsapp ? digits(match.whatsapp) : null;
    const pendencias: string[] = [];
    if (!valor) pendencias.push('valor não identificado');
    if (!venc) pendencias.push('vencimento não identificado');
    if (!match) pendencias.push('cliente não identificado');
    else if (!strong) pendencias.push('confirmar cliente');
    if (match && !whatsapp) pendencias.push('cliente sem WhatsApp');
    if (ex.legivel === false) pendencias.push('documento pouco legível');

    const status = pendencias.length === 0 ? 'pronto_envio' : 'aguardando_revisao';
    await sb.from('boleto_envios').update({
      nome_extraido: nome, cpf_cnpj_extraido: cpfCnpj, valor, vencimento: venc,
      nosso_numero: ex.nosso_numero || null, linha_digitavel: ex.linha_digitavel || null,
      codigo_barras: ex.codigo_barras || null, numero_documento: ex.numero_documento || null,
      data_emissao: validDate(ex.data_emissao), banco: ex.banco || null,
      client_id: match?.id || null, whatsapp,
      match_info: [info, ...pendencias.filter((p) => p !== 'confirmar cliente')].join(' · '),
      status, erro: null,
    }).eq('id', b.id);

    return json({ ok: true, status });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Erro' }, 500);
  }
});
