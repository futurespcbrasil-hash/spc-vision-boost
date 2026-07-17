// Edge function: SPC Brasil - consulta REST real
// Docs: WebService_Integracao_v4.3
// Endpoints:
//  - Homologação: https://treinamento.spcbrasil.com.br/spcconsulta/recurso/consulta/padrao
//  - Produção:    https://api.spcbrasil.com.br/spcconsulta/recurso/consulta/padrao
// Autenticação: Basic Auth (usuário/senha de WebService — diferente da senha WEB)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Mapa tipoConsulta -> codigoProduto (ajustável conforme contrato do cliente)
const PRODUTO_MAP: Record<string, string> = {
  SPC_PADRAO: '325',
  SPC_MAXI: '325',
  SPC_FULL: '325',
  SPC_BUSCA: '632',
  SCORE: '676',
  PJ: '679',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const {
      tipoDocumento = 'CPF',
      documento = '',
      tipoConsulta = 'SPC_MAXI',
      codigoProduto,
      codigoInsumoOpcional = [],
    } = body ?? {}

    const doc = String(documento).replace(/\D/g, '')
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Documento é obrigatório' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const usuario = Deno.env.get('SPC_USUARIO')
    const senha = Deno.env.get('SPC_SENHA')
    const ambiente = (Deno.env.get('SPC_AMBIENTE') ?? 'producao').toLowerCase()

    if (!usuario || !senha) {
      return new Response(
        JSON.stringify({
          error: 'Credenciais SPC não configuradas (SPC_USUARIO / SPC_SENHA).',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const baseUrl =
      ambiente === 'homologacao' || ambiente === 'treinamento'
        ? 'https://treinamento.spcbrasil.com.br/spcconsulta/recurso/consulta/padrao'
        : 'https://api.spcbrasil.com.br/spcconsulta/recurso/consulta/padrao'

    const produto = codigoProduto || PRODUTO_MAP[tipoConsulta] || '325'
    const tipoConsumidor = (tipoDocumento || '').toUpperCase() === 'CNPJ' ? 'J' : 'F'

    const payload = {
      codigoProduto: String(produto),
      tipoConsumidor,
      documentoConsumidor: doc,
      codigoInsumoOpcional: Array.isArray(codigoInsumoOpcional) ? codigoInsumoOpcional : [],
    }

    const authHeader = 'Basic ' + btoa(`${usuario}:${senha}`)

    const resp = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    })

    const text = await resp.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    if (!resp.ok) {
      console.error('SPC error', resp.status, text)
      return new Response(
        JSON.stringify({
          error: `SPC retornou HTTP ${resp.status}`,
          detalhe: data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: resp.status },
      )
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('spc-consultar exception', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
