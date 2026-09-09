import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CODE_MESSAGES: Record<string, string> = {
  '1': 'IE não localizada no Sintegra para este CNPJ.',
  '2': 'CNPJ inválido.',
  '3': 'Token de acesso inválido.',
  '4': 'Não há pacote de créditos disponível.',
  '5': 'Créditos da API esgotados.',
  '6': 'Plugin da API não encontrado.',
  '7': 'Instabilidade temporária no SINTEGRA. Tente novamente.',
  '8': 'Erro interno na consulta.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const token = Deno.env.get('SINTEGRA_API_TOKEN');
    if (!token) return json({ ok: false, error: 'Token do Sintegra não configurado no servidor.' }, 500);

    let payload: { cnpj?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, error: 'Requisição inválida.' }, 400);
    }

    const cnpj = String(payload?.cnpj ?? '').replace(/\D/g, '');
    if (cnpj.length !== 14) return json({ ok: false, error: 'CNPJ inválido.' }, 400);

    const url = `https://www.sintegraws.com.br/api/v1/execute-api.php?token=${encodeURIComponent(token)}&cnpj=${cnpj}&plugin=ST`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      const aborted = (e as Error)?.name === 'AbortError';
      return json({ ok: false, error: aborted ? 'Tempo esgotado ao consultar o Sintegra. Tente novamente.' : 'Não foi possível conectar ao Sintegra.' }, 200);
    }
    clearTimeout(timer);

    if (!res.ok) return json({ ok: false, error: `Sintegra indisponível no momento (HTTP ${res.status}).` }, 200);

    const text = await res.text();
    if (!text.trim()) return json({ ok: false, error: 'O Sintegra retornou uma resposta vazia.' }, 200);

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ ok: false, error: 'Resposta inválida recebida do Sintegra.' }, 200);
    }

    const code = String(data?.code ?? data?.codigo ?? '');
    if (code && code !== '0') {
      return json({ ok: false, code, error: CODE_MESSAGES[code] || data?.message || 'Não foi possível concluir a consulta no Sintegra.' }, 200);
    }

    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || 'Erro interno na consulta.' }, 200);
  }
});
