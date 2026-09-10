// Consulta de dados fiscais/estaduais (Inscrição Estadual) via CNPJá
// Docs: https://cnpja.com/api  -> GET https://api.cnpja.com/office/{taxId}?registrations=BR
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const token = Deno.env.get('CNPJA_API_TOKEN');
    if (!token) return json({ ok: false, error: 'Token da CNPJá não configurado no servidor.' }, 500);

    let payload: { cnpj?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, error: 'Requisição inválida.' }, 400);
    }

    const cnpj = String(payload?.cnpj ?? '').replace(/\D/g, '');
    if (cnpj.length !== 14) return json({ ok: false, error: 'CNPJ inválido.' }, 400);

    const url = `https://api.cnpja.com/office/${cnpj}?registrations=BR&simples=true`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: token, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = (e as Error)?.name === 'AbortError';
      return json({
        ok: false,
        error: aborted
          ? 'Tempo esgotado ao consultar os dados fiscais. Tente novamente.'
          : 'Não foi possível conectar ao serviço de consulta.',
      });
    }
    clearTimeout(timer);

    if (res.status === 404) return json({ ok: false, error: 'CNPJ não localizado na base da Receita Federal.' });
    if (res.status === 400) return json({ ok: false, error: 'CNPJ inválido.' });
    if (res.status === 401 || res.status === 403) return json({ ok: false, error: 'Token de acesso inválido.' });
    if (res.status === 429) return json({ ok: false, error: 'Limite de consultas atingido. Tente novamente em instantes.' });
    if (!res.ok) return json({ ok: false, error: `Serviço indisponível no momento (HTTP ${res.status}).` });

    const text = await res.text();
    if (!text.trim()) return json({ ok: false, error: 'O serviço retornou uma resposta vazia.' });

    let d: any;
    try {
      d = JSON.parse(text);
    } catch {
      return json({ ok: false, error: 'Resposta inválida recebida do serviço de consulta.' });
    }

    const regs: any[] = Array.isArray(d?.registrations) ? d.registrations : [];
    // IE principal: prioriza habilitada e do mesmo estado do endereço
    const uf = d?.address?.state ?? null;
    const principal =
      regs.find((r) => r?.enabled && r?.state === uf) ??
      regs.find((r) => r?.enabled) ??
      regs.find((r) => r?.state === uf) ??
      regs[0] ??
      null;

    const data = {
      cnpj: d?.taxId ?? cnpj,
      nome_empresarial: d?.company?.name ?? null,
      nome_fantasia: d?.alias ?? null,
      uf,
      municipio: d?.address?.city ?? (d?.address?.municipality != null ? String(d.address.municipality) : null),
      cep: d?.address?.zip ?? null,
      logradouro: d?.address?.street ?? null,
      numero: d?.address?.number ?? null,
      bairro: d?.address?.district ?? null,
      complemento: d?.address?.details ?? null,

      inscricao_estadual: principal?.number ?? null,
      situacao_ie: principal ? (principal.enabled ? 'Ativa' : (principal?.status?.text ?? 'Inativa')) : null,
      contribuinte_icms: regs.length > 0 ? (regs.some((r) => r?.enabled) ? 'Sim' : 'Não') : null,
      tipo_inscricao: principal?.type?.text ?? null,
      regime_tributacao: d?.company?.simples?.optant
        ? 'Simples Nacional'
        : d?.company?.simei?.optant
          ? 'MEI / SIMEI'
          : d?.company?.size?.text
            ? `Regime normal (${d.company.size.text})`
            : null,
      natureza_juridica: d?.company?.nature?.text ?? null,

      situacao_cadastral: d?.status?.text ?? null,
      data_situacao_cadastral: d?.statusDate ?? null,
      data_inicio_atividade: d?.founded ?? null,

      cnae_principal: d?.mainActivity?.id ? String(d.mainActivity.id) : null,
      cnae_principal_descricao: d?.mainActivity?.text ?? null,

      outras_ies: regs
        .filter((r) => r !== principal)
        .map((r) => ({
          inscricao_estadual: r?.number ?? null,
          uf: r?.state ?? null,
          situacao_ie: r?.enabled ? 'Ativa' : (r?.status?.text ?? 'Inativa'),
          tipo: r?.type?.text ?? null,
        })),
    };

    if (!principal) {
      return json({ ok: true, data, aviso: 'IE não localizada para este CNPJ.' });
    }

    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'Erro interno na consulta.' });
  }
});
