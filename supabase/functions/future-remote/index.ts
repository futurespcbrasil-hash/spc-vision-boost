
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import WebSocket from 'npm:ws@8.18.0'

const MESH_URL = (Deno.env.get('MESH_SERVER_URL') ?? '').replace(/\/+$/, '')
const MESH_USER = Deno.env.get('MESH_USER') ?? ''
const MESH_PASS = Deno.env.get('MESH_PASS') ?? ''
const MESH_TOKEN = Deno.env.get('MESH_LOGIN_TOKEN') ?? ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const meshConfigured = () =>
  Boolean(MESH_URL && MESH_USER && MESH_PASS)

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function meshCommand(
  command: Record<string, unknown>,
  responseAction: string,
  timeoutMs = 12000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!meshConfigured()) {
      reject(new Error('mesh_not_configured'))
      return
    }

    const base = MESH_URL.replace(/^http/, 'ws')
    const url = `${base}/control.ashx`

    const credentials = [
      base64Utf8(MESH_USER),
      base64Utf8(MESH_PASS),
    ]

    if (MESH_TOKEN) credentials.push(base64Utf8(MESH_TOKEN))

    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
      try {
        ws.close()
      } catch {
        // Socket já encerrado
      }
    }

    const ws = new WebSocket(url, {
      headers: {
        'x-meshauth': credentials.join(','),
      },
      handshakeTimeout: timeoutMs,
    })

    timer = setTimeout(() => {
      finish(() => reject(new Error('mesh_timeout')))
    }, timeoutMs)

    ws.on('open', () => {
      try {
        ws.send(JSON.stringify(command), (error) => {
          if (error) {
            finish(() => reject(new Error('mesh_send_failed')))
          }
        })
      } catch {
        finish(() => reject(new Error('mesh_send_failed')))
      }
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg?.action === 'close' || msg?.action === 'userauth') {
          const cause = String(msg?.cause ?? '')
          const reason = cause === 'noauth'
            ? 'mesh_auth_failed'
            : 'mesh_connection_closed'

          finish(() => reject(new Error(reason)))
          return
        }

        if (msg?.action === responseAction) {
          finish(() => resolve(msg))
        }
      } catch {
        // Ignora mensagens que não sejam JSON válido
      }
    })

    ws.on('error', () => {
      finish(() => reject(new Error('mesh_unreachable')))
    })

    ws.on('close', () => {
      if (!settled) {
        finish(() => reject(new Error('mesh_closed')))
      }
    })
  })
}

const flattenNodes = (nodes: Record<string, any[]> = {}) =>
  Object.values(nodes).flat().map((n: any) => ({
    mesh_device_id: n._id,
    device_name: n.name ?? 'Sem nome',
    operating_system: n.osdesc ?? null,
    status: n.conn && n.conn > 0 ? 'online' : 'offline',
    last_seen: n.lastconnect
      ? new Date(n.lastconnect * 1000).toISOString()
      : null,
    raw: n,
  }))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'supabase_configuration_missing' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined

    if (!action) return json({ error: 'action_required' }, 400)

    // Validação pública do código de suporte
    if (action === 'validate_code') {
      const raw = String(body?.code ?? '').replace(/\D/g, '')

      if (raw.length !== 12) {
        return json({ valid: false, reason: 'formato_invalido' })
      }

      const { data: reqRow, error } = await admin
        .from('future_remote_requests')
        .select('*')
        .eq('code', raw)
        .maybeSingle()

      if (error) {
        return json({ error: 'db_error' }, 500)
      }

      if (!reqRow) {
        return json({ valid: false, reason: 'nao_encontrado' })
      }

      if (['finalizado', 'cancelado'].includes(reqRow.status)) {
        return json({ valid: false, reason: 'encerrado' })
      }

      if (new Date(reqRow.expires_at).getTime() < Date.now()) {
        await admin
          .from('future_remote_requests')
          .update({ status: 'expirado' })
          .eq('id', reqRow.id)

        return json({ valid: false, reason: 'expirado' })
      }

      if (reqRow.status === 'aguardando') {
        await admin
          .from('future_remote_requests')
          .update({
            status: 'codigo_validado',
            validated_at: new Date().toISOString(),
          })
          .eq('id', reqRow.id)
      }

      return json({
        valid: true,
        request_id: reqRow.id,
        client_name: reqRow.client_name,
        agent_download_url: MESH_URL
          ? `${MESH_URL}/agentinvite`
          : null,
        mesh_configured: meshConfigured(),
      })
    }

    // Todas as outras ações exigem login no CRM
    const authHeader = req.headers.get('Authorization') ?? ''

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const { data: userData, error: authError } =
      await userClient.auth.getUser()

    if (authError || !userData?.user) {
      return json({ error: 'unauthorized' }, 401)
    }

    const isOwner =
      (userData.user.email ?? '').toLowerCase() ===
      'dalprapf1@gmail.com'

    const { data: roleRows, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)

    const isGestor =
      !roleError &&
      (roleRows ?? []).some((row) => row.role === 'gestor')

    if (!isOwner && !isGestor) {
      return json({
        error: 'forbidden',
        message: 'Acesso restrito ao proprietário e gestores.',
      }, 403)
    }

    switch (action) {
      case 'mesh_status': {
        if (!meshConfigured()) {
          return json({
            connected: false,
            configured: false,
            message: 'Configuração pendente',
          })
        }

        try {
          const info = await meshCommand(
            { action: 'serverinfo' },
            'serverinfo',
          )

          return json({
            connected: true,
            configured: true,
            serverinfo: info?.serverinfo ?? info,
          })
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
        if (!meshConfigured()) {
          return json({
            error: 'mesh_not_configured',
            message: 'Configuração pendente',
          }, 400)
        }

        try {
          const res = await meshCommand(
            { action: 'nodes' },
            'nodes',
          )

          const syncedDevices = flattenNodes(res?.nodes)
          const deviceIds = syncedDevices.map((device) => device.mesh_device_id).filter(Boolean)

          // Preserve customer labels when MeshCentral sync returns only technical device data.
          const [{ data: existingDevices, error: existingError }, { data: linkedRequests, error: requestsError }] = await Promise.all([
            deviceIds.length
              ? admin
                  .from('future_remote_devices')
                  .select('mesh_device_id, client_name, client_company')
                  .in('mesh_device_id', deviceIds)
              : Promise.resolve({ data: [], error: null } as any),
            deviceIds.length
              ? admin
                  .from('future_remote_requests')
                  .select('mesh_device_id, client_name, client_company, created_at')
                  .in('mesh_device_id', deviceIds)
                  .not('mesh_device_id', 'is', null)
                  .order('created_at', { ascending: false })
              : Promise.resolve({ data: [], error: null } as any),
          ])

          if (existingError || requestsError) {
            return json({
              error: 'db_error',
              detail: existingError?.message ?? requestsError?.message,
            }, 500)
          }

          const existingById = new Map(
            (existingDevices ?? []).map((device: any) => [device.mesh_device_id, device]),
          )
          const latestRequestById = new Map<string, any>()
          for (const request of linkedRequests ?? []) {
            if (request.mesh_device_id && !latestRequestById.has(request.mesh_device_id)) {
              latestRequestById.set(request.mesh_device_id, request)
            }
          }

          const devices = syncedDevices.map((device) => {
            const existing = existingById.get(device.mesh_device_id) as any
            const request = latestRequestById.get(device.mesh_device_id)
            return {
              ...device,
              client_name: request?.client_name ?? existing?.client_name ?? null,
              client_company: request?.client_company ?? existing?.client_company ?? null,
              updated_at: new Date().toISOString(),
            }
          })

          if (devices.length) {
            const { error } = await admin
              .from('future_remote_devices')
              .upsert(devices, { onConflict: 'mesh_device_id' })

            if (error) {
              return json({
                error: 'db_error',
                detail: error.message,
              }, 500)
            }
          }

          return json({ total: devices.length, devices })
        } catch (e) {
          return json({
            error: 'mesh_sync_failed',
            detail: (e as Error).message,
          }, 502)
        }
      }

      case 'remote_url': {
        if (!meshConfigured()) {
          return json({
            error: 'mesh_not_configured',
            message: 'Configuração pendente',
          }, 400)
        }

        const nodeId = String(body?.mesh_device_id ?? '')

        if (!nodeId) {
          return json({ error: 'mesh_device_id_required' }, 400)
        }

        return json({
          url: `${MESH_URL}/?viewmode=11&gotonode=${encodeURIComponent(nodeId)}`,
        })
      }

      default:
        return json({ error: 'unknown_action' }, 400)
    }
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
