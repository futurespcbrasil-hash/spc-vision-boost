import { supabase } from '@/integrations/supabase/client';

/**
 * Camada de serviço do Tactical RMM.
 *
 * Toda comunicação passa pela Edge Function `tactical-rmm` (server-side).
 * A API Key nunca é exposta no frontend, localStorage ou console.
 */

export type RmmAgent = {
  agent_id: string;
  hostname: string;
  operating_system?: string | null;
  status?: string | null;
  last_seen?: string | null;
  public_ip?: string | null;
  local_ips?: string | null;
  cpu_model?: string[] | string | null;
  total_ram?: number | null;
  description?: string | null;
  client_name?: string | null;
  [k: string]: unknown;
};

async function invoke<T>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('tactical-rmm', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as T;
}

/** FUNCIONAL — GET /core/version/ */
export async function testConnection() {
  return invoke<{ connected: boolean; version: unknown; message: string }>('test_connection');
}

/** FUNCIONAL — GET /agents/ */
export async function listAgents() {
  const res = await invoke<{ agents: RmmAgent[] }>('list_agents');
  return res.agents ?? [];
}

/** FUNCIONAL — GET /agents/{agent_id}/ */
export async function getAgent(agentId: string) {
  const res = await invoke<{ agent: RmmAgent }>('get_agent', { agent_id: agentId });
  return res.agent;
}

/** FUNCIONAL — GET /agents/{agent_id}/ (usa o campo status) */
export async function getAgentStatus(agentId: string) {
  const agent = await getAgent(agentId);
  return (agent?.status as string) ?? 'offline';
}

/** FUNCIONAL — alias de getAgent, retorna as informações completas do computador */
export async function getDeviceInfo(agentId: string) {
  return getAgent(agentId);
}

const normalizeStatus = (s?: string | null) => {
  const v = (s ?? '').toLowerCase();
  if (v === 'online') return 'online';
  if (v === 'overdue' || v === 'connecting') return 'conectando';
  return 'offline';
};

/**
 * FUNCIONAL (depende do servidor configurado) — sincroniza os agentes do
 * Tactical RMM com a tabela `remote_devices`, sem duplicar registros:
 * a chave única é (user_id, agent_id).
 */
export async function syncDevices(userId: string) {
  const agents = await listAgents();
  if (!agents.length) return { total: 0, sincronizados: 0 };

  const rows = agents.map((a) => ({
    user_id: userId,
    agent_id: a.agent_id,
    hostname: a.hostname,
    operating_system: (a.operating_system as string) ?? null,
    status: normalizeStatus(a.status as string),
    last_seen: (a.last_seen as string) ?? null,
    public_ip: (a.public_ip as string) ?? null,
    local_ips: (a.local_ips as string) ?? null,
    cpu_model: Array.isArray(a.cpu_model) ? a.cpu_model.join(', ') : ((a.cpu_model as string) ?? null),
    total_ram: (a.total_ram as number) ?? null,
    description: (a.description as string) ?? null,
    raw: a as unknown as Record<string, unknown>,
    last_synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('remote_devices')
    .upsert(rows as never, { onConflict: 'user_id,agent_id' });
  if (error) throw new Error(error.message);

  await supabase
    .from('remote_settings')
    .update({ last_sync_at: new Date().toISOString() } as never)
    .eq('user_id', userId);

  return { total: agents.length, sincronizados: rows.length };
}

/**
 * PREPARADA — depende do MeshCentral acoplado ao Tactical RMM.
 * Endpoint: POST /agents/{agent_id}/meshcentral/
 * Retorna as URLs de controle/terminal/arquivos quando o servidor estiver ativo.
 */
export async function prepareRemoteAccess(agentId: string) {
  return invoke<{ session: Record<string, string> }>('prepare_remote_access', { agent_id: agentId });
}

/** FUNCIONAL — registra uma sessão de acesso no histórico local. */
export async function registerSession(params: {
  userId: string;
  deviceId?: string | null;
  clientId?: string | null;
  deviceHostname?: string | null;
  operatorName?: string | null;
}) {
  const { data, error } = await supabase
    .from('remote_sessions')
    .insert({
      user_id: params.userId,
      device_id: params.deviceId ?? null,
      client_id: params.clientId ?? null,
      device_hostname: params.deviceHostname ?? null,
      operator_name: params.operatorName ?? null,
      status: 'ativa',
      started_at: new Date().toISOString(),
    } as never)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** FUNCIONAL — encerra uma sessão registrada e calcula a duração. */
export async function endSession(sessionId: string, startedAt: string) {
  const ended = new Date();
  const duration = Math.max(0, Math.round((ended.getTime() - new Date(startedAt).getTime()) / 1000));
  const { error } = await supabase
    .from('remote_sessions')
    .update({
      ended_at: ended.toISOString(),
      duration_seconds: duration,
      status: 'encerrada',
    } as never)
    .eq('id', sessionId);
  if (error) throw new Error(error.message);
}
