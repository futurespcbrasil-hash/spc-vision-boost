import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Camada server-side de integração com o Tactical RMM.
 *
 * A API Key NUNCA sai do servidor. O frontend chama apenas esta função
 * informando uma ação ("action") e os parâmetros necessários.
 *
 * Endpoints REAIS da API do Tactical RMM utilizados (docs.tacticalrmm.com):
 *  - GET  /core/version/                      -> teste de conexão
 *  - GET  /agents/                            -> lista de agentes
 *  - GET  /agents/{agent_id}/                 -> detalhes de um agente
 *  - POST /agents/{agent_id}/meshcentral/     -> URLs de sessão MeshCentral
 *    (essa rota depende do MeshCentral acoplado ao Tactical RMM)
 */

const RMM_URL = (Deno.env.get('TACTICAL_RMM_URL') ?? '').replace(/\/+$/, '')
const RMM_KEY = Deno.env.get('TACTICAL_RMM_API_KEY') ?? ''

type Action =
  | 'test_connection'
  | 'list_agents'
  | 'get_agent'
  | 'get_agent_status'
  | 'prepare_remote_access'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function rmmFetch(path: string, init: RequestInit = {}) {
  if (!RMM_URL || !RMM_KEY) {
    throw new Error('missing_config')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${RMM_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'X-API-KEY': RMM_KEY,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    const text = await res.text()
    let data: unknown = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Valida o usuário autenticado (JWT enviado pelo cliente)
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body?.action as Action | undefined
    const agentId = typeof body?.agent_id === 'string' ? body.agent_id : undefined

    if (!action) return json({ error: 'action_required' }, 400)

    if (!RMM_URL || !RMM_KEY) {
      return json({
        error: 'missing_config',
        message: 'TACTICAL_RMM_URL e TACTICAL_RMM_API_KEY ainda não foram configurados no servidor.',
      }, 400)
    }

    switch (action) {
      case 'test_connection': {
        const r = await rmmFetch('/core/version/')
        return json({
          connected: r.ok,
          status: r.status,
          version: r.ok ? r.data : null,
          message: r.ok ? 'Conectado com sucesso' : 'Falha na conexão com o Tactical RMM',
        }, 200)
      }

      case 'list_agents': {
        const r = await rmmFetch('/agents/')
        if (!r.ok) return json({ error: 'rmm_error', status: r.status, detail: r.data }, 502)
        return json({ agents: r.data })
      }

      case 'get_agent':
      case 'get_agent_status': {
        if (!agentId) return json({ error: 'agent_id_required' }, 400)
        const r = await rmmFetch(`/agents/${encodeURIComponent(agentId)}/`)
        if (!r.ok) return json({ error: 'rmm_error', status: r.status, detail: r.data }, 502)
        return json({ agent: r.data })
      }

      case 'prepare_remote_access': {
        if (!agentId) return json({ error: 'agent_id_required' }, 400)
        // Depende do MeshCentral acoplado ao Tactical RMM.
        const r = await rmmFetch(`/agents/${encodeURIComponent(agentId)}/meshcentral/`, { method: 'POST' })
        if (!r.ok) {
          return json({
            error: 'meshcentral_unavailable',
            status: r.status,
            detail: r.data,
            message: 'Não foi possível obter a sessão do MeshCentral para este agente.',
          }, 502)
        }
        return json({ session: r.data })
      }

      default:
        return json({ error: 'unknown_action' }, 400)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    const status = msg === 'missing_config' ? 400 : 500
    return json({ error: msg }, status)
  }
})
