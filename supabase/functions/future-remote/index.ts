import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Backend do módulo Future Remote.
 *
 * Arquitetura:  CRM -> esta Edge Function -> MeshCentral -> Agente -> PC do cliente
 *
 * Credenciais do MeshCentral ficam SOMENTE aqui (variáveis de ambiente):
 *   MESH_SERVER_URL   ex.: https://192.168.0.105  ou  https://remote.futuresolucoes.com.br
 *   MESH_USER         usuário administrativo do MeshCentral
 *   MESH_PASS         senha do usuário
 *   MESH_LOGIN_TOKEN  (opcional) token 2FA/loginkey
 *
 * Integração feita pela API oficial de controle do MeshCentral
 * (WebSocket /control.ashx, o mesmo canal usado pelo MeshCtrl.js).
 * Nenhum endpoint REST inventado.
 */

const MESH_URL = (Deno.env.get('MESH_SERVER_URL') ?? '').replace(/\/+$/, '')
const MESH_USER = Deno.env.get('MESH_USER') ?? ''
const MESH_PASS = Deno.env.get('MESH_PASS') ?? ''
const MESH_TOKEN = Deno.env.get('MESH_LOGIN_TOKEN') ?? ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const meshConfigured = () => Boolean(MESH_URL && MESH_USER && MESH_PASS)

const b64 = (s: string) => btoa(s).replace(/\+/g, '@').replace(/\//g, '$')

/** Abre o canal de controle do MeshCentral e envia um comando, devolvendo a resposta. */
function meshCommand(command: Record<string, unknown>, responseAction: string, timeoutMs = 12000) {
  return new Promise<any>((resolve, reject) => {
    if (!meshConfigured()) return reject(new Error('mesh_not_configured'))
    const base = MESH_URL.replace(/^http/, 'ws')
    let url = `${base}/control.ashx?user=${b64(MESH_USER)}&pass=${b64(MESH_PASS)}`
    if (MESH_TOKEN) url += `&token=${b64(MESH_TOKEN)}`

    let settled = false
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { ws.close() } catch { /* ignore */ }
      reject(new Error('mesh_timeout'))
    }, timeoutMs)

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* ignore */ }
      fn()
    }

    ws.onopen = () => ws.send(JSON.stringify(command))
    ws.onerror = () => finish(() => reject(new Error('mesh_unreachable')))
    ws.onclose = () => finish(() => reject(new Error('mesh_closed')))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
        if (msg?.action === 'close' || msg?.action === 'userauth') {
          return finish(() => reject(new Error('mesh_auth_failed')))
        }
        if (msg?.action === responseAction) finish(() => resolve(msg))
      } catch { /* mensagens de outros eventos são ignoradas */ }
    }
  })
}

const flattenNodes = (nodes: Record<string, any[]> = {}) =>
  Object.values(nodes).flat().map((n: any) => ({
    mesh_device_id: n._id,
    device_name: n.name ?? 'Sem nome',
    operating_system: n.osdesc ?? null,
    status: n.conn && n.conn > 0 ? 'online' : 'offline',
    last_seen: n.lastconnect ? new Date(n.lastconnect * 1000).toISOString() : null,
    raw: n,
  }))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined
    if (!action) return json({ error: 'action_required' }, 400)

    // ---------- AÇÃO PÚBLICA (página /suporte, sem login) ----------
    if (action === 'validate_code') {
      const raw = String(body?.code ?? '').replace(/\D/g, '')
      if (raw.length !== 12) return json({ valid: false, reason: 'formato_invalido' }, 200)

      const { data: reqRow } = await admin
        .from('future_remote_requests')
        .select('*')
        .eq('code', raw)
        .maybeSingle()

      if (!reqRow) return json({ valid: false, reason: 'nao_encontrado' })
      if (['finalizado', 'cancelado'].includes(reqRow.status)) {
        return json({ valid: false, reason: 'encerrado' })
      }
      if (new Date(reqRow.expires_at).getTime() < Date.now()) {
        await admin.from('future_remote_requests')
          .update({ status: 'expirado' }).eq('id', reqRow.id)
        return json({ valid: false, reason: 'expirado' })
      }

      if (reqRow.status === 'aguardando') {
        await admin.from('future_remote_requests')
          .update({ status: 'codigo_validado', validated_at: new Date().toISOString() })
          .eq('id', reqRow.id)
      }

      return json({
        valid: true,
        request_id: reqRow.id,
        client_name: reqRow.client_name,
        agent_download_url: MESH_URL ? `${MESH_URL}/agentinvite` : null,
        mesh_configured: meshConfigured(),
      })
    }

    // ---------- AÇÕES INTERNAS (exigem login no CRM) ----------
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData } = await userClient.auth.getUser()
    if (!userData?.user) return json({ error: 'unauthorized' }, 401)

    switch (action) {
      case 'mesh_status': {
        if (!meshConfigured()) {
          return json({ connected: false, configured: false, message: 'Configuração pendente' })
        }
        try {
          const info = await meshCommand({ action: 'serverinfo' }, 'serverinfo')
          return json({ connected: true, configured: true, serverinfo: info?.serverinfo ?? null })
        } catch (e) {
          return json({
            connected: false,
            configured: true,
            message: 'MeshCentral não conectado',
            detail: (e as Error).message,
          })
        }
      }

      case 'sync_devices': {
        if (!meshConfigured()) return json({ error: 'mesh_not_configured', message: 'Configuração pendente' }, 400)
        const res = await meshCommand({ action: 'nodes' }, 'nodes')
        const devices = flattenNodes(res?.nodes)
        if (devices.length) {
          const { error } = await admin
            .from('future_remote_devices')
            .upsert(
              devices.map((d) => ({ ...d, updated_at: new Date().toISOString() })),
              { onConflict: 'mesh_device_id' },
            )
          if (error) return json({ error: 'db_error', detail: error.message }, 500)
        }
        return json({ total: devices.length, devices })
      }

      case 'remote_url': {
        if (!meshConfigured()) return json({ error: 'mesh_not_configured', message: 'Configuração pendente' }, 400)
        const nodeId = String(body?.mesh_device_id ?? '')
        if (!nodeId) return json({ error: 'mesh_device_id_required' }, 400)
        // URL real da interface de controle do MeshCentral para o nó informado.
        return json({ url: `${MESH_URL}/?viewmode=11&gotonode=${encodeURIComponent(nodeId)}` })
      }

      default:
        return json({ error: 'unknown_action' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message || 'unknown_error' }, 500)
  }
})
