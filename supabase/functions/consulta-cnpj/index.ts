// Proxy seguro para a BrasilAPI - consulta de CNPJ
// Docs: https://brasilapi.com.br/docs#tag/CNPJ  -> GET /api/cnpj/v1/{cnpj}
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE = 'https://brasilapi.com.br/api/cnpj/v1/'
const MAX_LOTE = 25

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

function normalize(cnpj: string, data: any) {
  const socios = Array.isArray(data?.qsa)
    ? data.qsa.map((s: any) => ({
        nome: s?.nome_socio ?? s?.nome ?? null,
        qualificacao: s?.qualificacao_socio ?? s?.qual ?? null,
        data_entrada: s?.data_entrada_sociedade ?? null,
      }))
    : []

  return {
    cnpj,
    razao_social: data?.razao_social ?? null,
    nome_fantasia: data?.nome_fantasia ?? null,
    situacao: data?.descricao_situacao_cadastral ?? data?.situacao_cadastral ?? null,
    cep: data?.cep ? onlyDigits(data.cep) : null,
    logradouro: data?.logradouro ?? null,
    numero: data?.numero ?? null,
    complemento: data?.complemento ?? null,
    bairro: data?.bairro ?? null,
    cidade: data?.municipio ?? null,
    uf: data?.uf ?? null,
    telefone: data?.ddd_telefone_1 ?? null,
    telefone_2: data?.ddd_telefone_2 ?? null,
    email: data?.email ?? null,
    socios,
    cnae: data?.cnae_fiscal_descricao ?? null,
    porte: data?.porte ?? null,
    status: 'encontrado' as const,
    erro: null as string | null,
  }
}

async function consultar(cnpj: string, tentativa = 0): Promise<any> {
  try {
    const res = await fetch(BASE + cnpj, { headers: { Accept: 'application/json' } })

    if (res.status === 404) {
      return { cnpj, status: 'nao_encontrado', erro: 'CNPJ não encontrado na base da Receita Federal' }
    }

    if ((res.status === 429 || res.status >= 500) && tentativa < 3) {
      await sleep(1000 * Math.pow(2, tentativa))
      return consultar(cnpj, tentativa + 1)
    }

    if (!res.ok) {
      return { cnpj, status: 'erro', erro: `Falha na consulta (HTTP ${res.status})` }
    }

    return normalize(cnpj, await res.json())
  } catch (e) {
    if (tentativa < 2) {
      await sleep(800 * (tentativa + 1))
      return consultar(cnpj, tentativa + 1)
    }
    return { cnpj, status: 'erro', erro: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    // Autenticação: valida o JWT do usuário
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Não autenticado' }, 401)

    const body = await req.json().catch(() => ({}))
    const lista: string[] = Array.isArray(body?.cnpjs)
      ? body.cnpjs
      : body?.cnpj
        ? [body.cnpj]
        : []

    const cnpjs = [...new Set(lista.map(onlyDigits).filter((c) => c.length === 14))]

    if (cnpjs.length === 0) return json({ error: 'Informe ao menos um CNPJ válido (14 dígitos).' }, 400)
    if (cnpjs.length > MAX_LOTE) return json({ error: `Máximo de ${MAX_LOTE} CNPJs por requisição.` }, 400)

    const results: any[] = []
    for (const cnpj of cnpjs) {
      results.push(await consultar(cnpj))
      await sleep(180) // respeita o rate limit da BrasilAPI
    }

    return json({ results })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado' }, 500)
  }
})
