import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getDocument } from 'https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.js?target=deno&external=canvas';

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
  const doc = await getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, string[]>();
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string' || !item.str.trim()) continue;
      const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2;
      const row = rows.get(y) || [];
      row.push(item.str.trim());
      rows.set(y, row);
    }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(' ')).join('\n'));
  }
  return pages.join('\n');
}
function parseBoleto(text: string) {
  const lines = text.split(/\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  let nome: string | null = null;
  const namePatterns = [
    /(?:nome\s*(?:do)?\s*pagador|pagador|sacado|nome\/raz[aã]o\s*social)\s*[:\-]?\s*([^\n]{3,100})/i,
  ];
  for (const re of namePatterns) {
    const m = all.match(re);
    if (m?.[1]) {
      const candidate = m[1].replace(/\s+(?:CPF|CNPJ|CPF\/CNPJ|documento|endereço|endere[cç]o).*/i, '').trim();
      if (candidate && !/^(CPF|CNPJ|BENEFICIARIO|BENEFICIÁRIO|CEDENTE)$/i.test(candidate)) nome = candidate.slice(0, 200);
      if (nome) break;
    }
  }
  if (!nome) {
    const idx = lines.findIndex(l => /^(?:pagador|sacado|pagador\/sacado)\s*:?$/i.test(l));
    if (idx >= 0 && lines[idx + 1] && !/CPF|CNPJ|BENEFICI|CEDENTE|VENCIMENTO/i.test(lines[idx + 1])) nome = lines[idx + 1].slice(0, 200);
  }
  let cpfCnpj: string | null = null;
  const docMatch = all.match(/(?:CPF\s*\/?\s*CNPJ|CPF|CNPJ)\s*[:\-]?\s*([\d.\/\-\s]{11,24})/i);
  if (docMatch) {
    const d = digits(docMatch[1]);
    if (d.length === 11 || d.length === 14) cpfCnpj = d;
  }
  const dateLine = lines.find(l => /data\s*(?:de\s*)?vencimento|vencimento/i.test(l));
  let vencimento = dateISO(dateLine || null);
  if (!vencimento) {
    const m = all.match(/(?:vencimento|vence\s*em)\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i);
    vencimento = dateISO(m?.[1] || null);
  }
  const valueLine = lines.find(l => /valor\s*(?:do\s*documento|cobrado|nominal|a\s*pagar|total)?\s*[:\-]?\s*R?\$?/i.test(l) && /\d+[,.]\d{2}/.test(l));
  let valor = money(valueLine || null);
  if (!valor) {
    const m = all.match(/(?:valor\s*(?:do\s*documento|cobrado|nominal|a\s*pagar|total))\s*[:\-]?\s*(?:R\$\s*)?([\d.]+,\d{2}|\d+\.\d{2})/i);
    valor = money(m?.[1] || null);
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
