import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getDocumentProxy, extractText } from 'https://esm.sh/unpdf@0.12.1?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const digits = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\.PDF$/i, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const SUFFIX = /\b(LTDA|ME|EPP|EIRELI|S ?A|MEI|SS|LTDA ME|CIA)\b/g;
const core = (s: string) => norm(s).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
const validDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null;
const dateISO = (s: string | null) => {
  if (!s) return null;
  const m = s.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (!m) return null;
  return validDate(`${m[3]}-${m[2]}-${m[1]}`);
};
function money(s: string | null) {
  if (!s) return null;
  const m = s.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/);
  if (!m) return null;
  const n = Number(m[1].includes(',') ? m[1].replace(/\./g, '').replace(',', '.') : m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
async function extractPdfText(data: Uint8Array) {
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: true });
  return typeof result.text === 'string' ? result.text : '';
}
function parseBoleto(text: string) {
  const lines = text.split(/\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  const labelOnly = /^(?:pagador(?:\/sacado)?|sacado|sacador\/avalista|benefici[aá]rio|cedente|cpf\/cnpj|cnpj\/cpf|cpf|cnpj|endereço|endere[cç]o|vencimento|valor do documento|recibo do pagador|ficha de compensa[cç][aã]o)\s*:?\s*$/i;
  const validName = (s: string) => {
    const v = s.replace(/\s+(?:CPF|CNPJ|CPF\/CNPJ|documento|endereço|endere[cç]o).*/i, '').trim();
    return v.length >= 3 && v.length <= 200 && !labelOnly.test(v) &&
      !/^(?:sacador\/avalista|benefici[aá]rio|cedente|recibo do pagador|ficha de compensa[cç][aã]o)$/i.test(v) &&
      !/^(?:\d{2}[./-])/.test(v) && !/^\d[\d./-]{8,}$/.test(v) ? v : null;
  };

  // Prioritize the "Recibo do Pagador" block, which explicitly names the payer.
  // Some PDF extractors flatten columns and make the main form's labels appear before the values.
  let nome: string | null = null;
  const receiptName = all.match(/recibo\s+do\s+pagador[\s\S]{0,240}?\bpagador\b\s*:?\s*([A-ZÀ-Ý][A-ZÀ-Ý0-9 .&,'/-]{2,100}?)(?=\s+(?:ag[eê]ncia|nosso\s*n[uú]mero|n[uú]mero\s+do\s+documento|CNPJ\/CPF\s+Pagador|CPF\/CNPJ\s+Pagador|benefici[aá]rio|endereço|autentica[cç][aã]o)|\n|$)/i);
  if (receiptName?.[1]) nome = validName(receiptName[1]);
  if (!nome) {
    const explicitPayer = all.match(/(?:nome\s*(?:do)?\s*pagador|pagador|sacado)\s*:?\s*([A-ZÀ-Ý][A-ZÀ-Ý0-9 .&,'/-]{2,100}?)(?=\s+(?:CPF|CNPJ|CPF\/CNPJ|CNPJ\/CPF|endereço|vencimento|valor|sacador\/avalista|benefici[aá]rio|cedente)|\n|$)/i);
    if (explicitPayer?.[1]) nome = validName(explicitPayer[1]);
  }
  // Never accept a field label such as "Sacador/Avalista" as the customer's name.
  if (nome && /^(?:sacador\/avalista|benefici[aá]rio|cedente|pagador|sacado|recibo do pagador)$/i.test(nome)) nome = null;

  // Prefer the explicitly labelled payer document from the receipt block, not the beneficiary CNPJ.
  let cpfCnpj: string | null = null;
  const payerDocPatterns = [
    /(?:CNPJ\/CPF|CPF\/CNPJ)\s+Pagador\s*:?\s*([\d./-]{11,24})/i,
    /(?:CPF|CNPJ)\s+do\s+Pagador\s*:?\s*([\d./-]{11,24})/i,
    /Pagador[\s\S]{0,180}?(?:CPF\/CNPJ|CNPJ\/CPF|CPF|CNPJ)\s*:?\s*([\d./-]{11,24})/i,
  ];
  for (const re of payerDocPatterns) {
    const m = all.match(re);
    if (m) {
      const d = digits(m[1]);
      if (d.length === 11 || d.length === 14) { cpfCnpj = d; break; }
    }
  }
  // Due date: use dates after an explicit due-date label and prefer the final date in that field block.
  let vencimento: string | null = null;
  const dueMatches = [...all.matchAll(/vencimento/ig)];
  for (const m of dueMatches) {
    const snippet = all.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 220);
    const dates = [...snippet.matchAll(/\b(\d{2}[./-]\d{2}[./-]\d{4})\b/g)].map(x => dateISO(x[1])).filter((x): x is string => !!x);
    if (dates.length) { vencimento = dates[dates.length - 1]; break; }
  }

  // Extract amount only from an explicit "Valor do Documento" / "Valor Cobrado" field.
  // Do not parse arbitrary numbers on the page (e.g. CNPJ fragments or phone numbers).
  let valor: number | null = null;
  const valueLabels = [...all.matchAll(/(?:\(?\s*=\s*\)?\s*)?valor\s+(?:do\s+documento|cobrado|nominal|a\s+pagar|total)/ig)];
  for (const m of valueLabels) {
    const pos = (m.index || 0) + m[0].length;
    const snippet = all.slice(pos, pos + 260);
    const amountMatch = snippet.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/);
    const candidate = amountMatch ? money(amountMatch[1]) : null;
    if (candidate !== null) { valor = candidate; break; }
  }

  const linhaMatch = all.match(/(?:\d{5}\.\d{5}\s*\d{5}\.\d{6}\s*\d{5}\.\d{6}\s*\d\s*\d{14}|\d{47,48})/);
  const barcodeMatch = all.match(/\b\d{44}\b/);
  const docLine = all.match(/(?:nosso\s*n[uú]mero|n[uú]mero\s*do\s*documento)\s*[:\-]?\s*([A-Z0-9./-]{3,30})/i);
  const bankLine = lines.find(l => /BANCO DO BRASIL|BRADESCO|ITA[ÚU]|SANTANDER|CAIXA ECONOMICA|SICREDI|SICOOB|BTG|INTER|BANRISUL|NUBANK/i.test(l));
  return { nome, cpfCnpj, valor, vencimento, linha: linhaMatch?.[0]?.replace(/\s+/g, ' ').trim() || null, barcode: barcodeMatch?.[0] || null, nossoNumero: docLine?.[1] || null, banco: bankLine?.slice(0, 100) || null };
}
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
    let parsed;
    try {
      parsed = parseBoleto(await extractPdfText(new Uint8Array(await file.arrayBuffer())));
    } catch (e) {
      console.error('Falha ao extrair texto do PDF', e);
      await sb.from('boleto_envios').update({ status: 'erro', erro: 'Não foi possível ler o texto deste PDF. Se for um documento escaneado, será necessária uma etapa de OCR.' }).eq('id', b.id);
      return json({ error: 'Não foi possível extrair texto do PDF. Documentos escaneados precisam de OCR.' }, 200);
    }
    const nome = parsed.nome;
    const cpfCnpj = parsed.cpfCnpj;
    const valor = parsed.valor;
    const venc = parsed.vencimento;
    if (!nome && !cpfCnpj && !valor && !venc) {
      const msg = 'O PDF não contém texto selecionável de boleto ou os campos não foram reconhecidos. Verifique o PDF; documentos escaneados precisam de OCR.';
      await sb.from('boleto_envios').update({ status: 'erro', erro: msg }).eq('id', b.id);
      return json({ error: msg }, 200);
    }

    const { data: clientes, error: clientesError } = await sb.from('boleto_clientes').select('id,nome,razao_social,cpf_cnpj,whatsapp').eq('user_id', u.user.id);
    if (clientesError) {
      console.error('Falha ao consultar clientes de boletos', clientesError);
      await sb.from('boleto_envios').update({ status: 'erro', erro: 'Não foi possível consultar os clientes cadastrados' }).eq('id', b.id);
      return json({ error: 'Não foi possível consultar os clientes cadastrados' }, 500);
    }
    const list = clientes || [];
    // Repair the placeholder client created by an earlier faulty extraction, but only
    // when this exact boleto is already linked to a client whose name is just a field label.
    if (b.client_id && nome && cpfCnpj) {
      const linked = list.find((c: any) => c.id === b.client_id);
      if (linked && /^(?:sacador\/avalista|benefici[aá]rio|cedente|pagador|sacado)$/i.test((linked.nome || '').trim())) {
        const { error: repairError } = await sb.from('boleto_clientes')
          .update({ nome, cpf_cnpj: cpfCnpj })
          .eq('id', linked.id)
          .eq('user_id', u.user.id);
        if (repairError) {
          console.error('Não foi possível corrigir o cadastro placeholder do boleto', repairError);
        } else {
          linked.nome = nome;
          linked.cpf_cnpj = cpfCnpj;
        }
      }
    }
    let match: any = null; let info = '';
    if (cpfCnpj) {
      const m = list.filter((c: any) => digits(c.cpf_cnpj) === cpfCnpj);
      if (m.length === 1) { match = m[0]; info = 'Identificado pelo CPF/CNPJ'; }
      else if (m.length > 1) info = 'Mais de um cliente com o mesmo CPF/CNPJ';
    }
    const byName = (label: string, src: string | null) => {
      if (match || !src) return;
      const k = core(src); if (!k) return;
      const m = list.filter((c: any) => core(c.nome || '') === k || (c.razao_social && core(c.razao_social) === k));
      if (m.length === 1) { match = m[0]; info = `Identificado pelo ${label} (confirme)`; }
      else if (m.length > 1) info = `Mais de um cliente possível pelo ${label}`;
    };
    if (!match && !info) byName('nome do pagador', nome);
    if (!match && !info && nome) {
      const { data: novo, error: novoError } = await sb.from('boleto_clientes').insert({ user_id: u.user.id, nome: nome.slice(0, 200), cpf_cnpj: cpfCnpj }).select('id,nome,razao_social,cpf_cnpj,whatsapp').single();
      if (novoError) {
        console.error('Falha ao cadastrar cliente extraído do boleto', novoError);
        await sb.from('boleto_envios').update({ status: 'erro', erro: 'Não foi possível cadastrar o cliente automaticamente. Confira o submenu Clientes.' }).eq('id', b.id);
        return json({ error: 'Não foi possível cadastrar o cliente automaticamente. Confira o submenu Clientes.' }, 500);
      }
      if (novo) { match = novo; info = 'Cliente novo cadastrado automaticamente'; }
    }
    if (!match && !info) info = 'Nenhum cliente encontrado no cadastro';
    const strong = match && (info === 'Identificado pelo CPF/CNPJ' || info === 'Cliente novo cadastrado automaticamente');
    const whatsapp = match?.whatsapp ? digits(match.whatsapp) : null;
    const pendencias: string[] = [];
    if (!valor) pendencias.push('valor não identificado');
    if (!venc) pendencias.push('vencimento não identificado');
    if (!match) pendencias.push('cliente não identificado');
    else if (!strong) pendencias.push('confirmar cliente');
    if (match && !whatsapp) pendencias.push('cliente sem WhatsApp');
    const status = pendencias.length === 0 ? 'pronto_envio' : 'aguardando_revisao';
    const { error: updateError } = await sb.from('boleto_envios').update({
      nome_extraido: nome, cpf_cnpj_extraido: cpfCnpj, valor, vencimento: venc,
      nosso_numero: parsed.nossoNumero, linha_digitavel: parsed.linha, codigo_barras: parsed.barcode,
      banco: parsed.banco, client_id: match?.id || null, whatsapp,
      match_info: [info, ...pendencias].filter(Boolean).join(' · '), status, erro: null,
    }).eq('id', b.id);
    if (updateError) {
      console.error('Falha ao salvar dados extraídos do boleto', updateError);
      return json({ error: 'Os dados foram lidos, mas não foi possível salvar o resultado. Tente novamente.' }, 500);
    }
    return json({ ok: true, status });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado' }, 500);
  }
});
