
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

    // URL pública de download do agente. Mantém exatamente o mesmo destino usado pelo fluxo antigo.
    if (action === 'agent_download_url') {
      return json({
        agent_download_url: MESH_URL
          ? `${MESH_URL}/agentinvite`
          : null,
      })
    }

    // Validação pública do código de suporte (mantida para compatibilidade com registros antigos).
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
    const isAtendimento =
      !roleError &&
      (roleRows ?? []).some((row) => row.role === 'atendimento')
    const isVendedor =
      !roleError &&
      (roleRows ?? []).some((row) => row.role === 'vendedor')

    // Todos os perfis operacionais autorizados podem usar o Future Remote.
    // A permissão continua sendo validada no servidor, não apenas na interface.
    if (!isOwner && !isGestor && !isAtendimento && !isVendedor) {
      return json({
        error: 'forbidden',
        message: 'Acesso restrito aos perfis autorizados do CRM.',
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
        // Synchronizing the global MeshCentral inventory is administrative; operational
        // roles may open authorized remote sessions but must not manage the inventory.
        if (!isOwner && !isGestor) {
          return json({
            error: 'forbidden',
            message: 'Somente o administrador ou gestor pode sincronizar os computadores.',
          }, 403)
        }

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
                  .select('id, mesh_device_id, device_name, client_name, client_company')
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
          const normalizeName = (value: unknown) =>
            String(value ?? '').trim().toLocaleLowerCase('pt-BR')
          const { data: sameNameDevices, error: sameNameError } = await admin
            .from('future_remote_devices')
            .select('id, mesh_device_id, device_name, client_name, client_company')
          if (sameNameError) {
            return json({ error: 'db_error', detail: sameNameError.message }, 500)
          }
          const existingByName = new Map<string, any>()
          for (const row of sameNameDevices ?? []) {
            const key = normalizeName(row.device_name)
            if (key && !existingByName.has(key)) existingByName.set(key, row)
          }
          const latestRequestById = new Map<string, any>()
          for (const request of linkedRequests ?? []) {
            if (request.mesh_device_id && !latestRequestById.has(request.mesh_device_id)) {
              latestRequestById.set(request.mesh_device_id, request)
            }
          }

          const devices = syncedDevices.map((device) => {
            const existing = (existingById.get(device.mesh_device_id) ?? existingByName.get(normalizeName(device.device_name))) as any
            const request = latestRequestById.get(device.mesh_device_id)
            return {
              ...device,
              // Keep manual computer-catalog edits as the source of truth after the first association.
              client_name: existing?.client_name ?? request?.client_name ?? null,
              client_company: existing?.client_company ?? request?.client_company ?? null,
              updated_at: new Date().toISOString(),
            }
          })

          if (devices.length) {
            // A reinstall/re-enrollment can create a new Mesh node ID for the same computer name.
            // Remove stale CRM rows for those names before upserting the current Mesh inventory.
            const currentNames = [...new Set(devices.map((device) => normalizeName(device.device_name)).filter(Boolean))]
            for (const name of currentNames) {
              const current = devices.find((device) => normalizeName(device.device_name) === name)
              if (!current) continue
              const staleRows = (sameNameDevices ?? []).filter((row: any) =>
                normalizeName(row.device_name) === name && row.mesh_device_id !== current.mesh_device_id
              )
              for (const stale of staleRows) {
                const { error: deleteError } = await admin
                  .from('future_remote_devices')
                  .delete()
                  .eq('id', stale.id)
                if (deleteError) {
                  return json({ error: 'db_error', detail: deleteError.message }, 500)
                }
              }
            }

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

        const rawNodeId = String(body?.mesh_device_id ?? '').trim()
        // MeshCentral API IDs may be prefixed with "node//"; the browser gotonode
        // parameter expects the underlying base64 node identifier only.
        const nodeId = rawNodeId.startsWith('node//')
          ? rawNodeId.slice('node//'.length)
          : rawNodeId

        if (!nodeId) {
          return json({ error: 'mesh_device_id_required' }, 400)
        }

        // Do not allow a CRM user to open arbitrary MeshCentral nodes by guessing an ID.
        // The inventory is synced from MeshCentral and is the allowlist for remote access.
        const { data: registeredDevice, error: deviceError } = await admin
          .from('future_remote_devices')
          .select('mesh_device_id')
          .eq('mesh_device_id', rawNodeId)
          .maybeSingle()

        if (deviceError) {
          return json({ error: 'db_error', detail: 'Não foi possível validar o computador.' }, 500)
        }

        if (!registeredDevice) {
          return json({
            error: 'device_not_registered',
            message: 'Este computador não está cadastrado no Future Remote. Sincronize os computadores e tente novamente.',
          }, 404)
        }

        // This URL only selects the remote-control view. Authentication must be provided
        // by a dedicated, short-lived MeshCentral browser-login flow; never put the
        // backend API credential (MESH_LOGIN_TOKEN) into a browser URL.
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
