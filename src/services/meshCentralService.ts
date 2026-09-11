import { supabase } from '@/integrations/supabase/client';

/**
 * Camada de serviço do Future Remote.
 * O frontend nunca fala com o MeshCentral: tudo passa pela Edge Function
 * `future-remote`, onde ficam as credenciais (MESH_SERVER_URL, MESH_USER, MESH_PASS).
 */

async function invoke<T>(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('future-remote', {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  return data as T;
}

/** Testa a conexão com o servidor MeshCentral. */
export const meshStatus = () =>
  invoke<{ connected: boolean; configured: boolean; message?: string; serverinfo?: unknown }>('mesh_status');

/** Busca os computadores no MeshCentral e atualiza a tabela local. */
export const syncDevices = () =>
  invoke<{ total: number; devices: unknown[]; error?: string; message?: string }>('sync_devices');

/** Devolve a URL real de controle remoto do MeshCentral para o computador. */
export const getRemoteUrl = (meshDeviceId: string) =>
  invoke<{ url?: string; error?: string; message?: string }>('remote_url', { mesh_device_id: meshDeviceId });

/** Validação pública do código de atendimento (usada na página /suporte). */
export const validateCode = (code: string) =>
  invoke<{
    valid: boolean;
    reason?: string;
    request_id?: string;
    client_name?: string;
    agent_download_url?: string | null;
    mesh_configured?: boolean;
  }>('validate_code', { code });

/** Gera um código numérico aleatório de 12 dígitos (exibido em grupos de 3). */
export function generateCode() {
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join('');
}

export const formatCode = (code?: string | null) =>
  (code ?? '').replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ').trim();
