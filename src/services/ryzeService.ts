import { supabase } from '@/integrations/supabase/client';

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  console.log(`[ryzeService] Invocando ação '${action}'`, payload);
  const { data, error } = await supabase.functions.invoke('ryze-proxy', {
    body: { action, ...payload },
  });

  if (error) {
    console.error(`[ryzeService] Erro retornado pela Edge Function para '${action}':`, error);
    let errorMessage = error.message || 'Erro de comunicação com a API do WhatsApp';
    try {
      if ('context' in error && (error as any).context) {
        const ctx = await (error as any).context.json();
        if (ctx?.error) {
          errorMessage = typeof ctx.error === 'string' ? ctx.error : JSON.stringify(ctx.error);
        }
        if (ctx?.details?.message) {
          errorMessage += `: ${ctx.details.message}`;
        } else if (ctx?.details?.error) {
          errorMessage += `: ${typeof ctx.details.error === 'string' ? ctx.details.error : JSON.stringify(ctx.details.error)}`;
        }
      }
    } catch {
      // fallback
    }
    if (errorMessage.includes('non-2xx status code')) {
      errorMessage = 'Falha na Ryze API: Verifique se a chave RYZE_TOKEN_ACCOUNT está configurada nos Secrets do Supabase.';
    }
    throw new Error(errorMessage);
  }

  if (data?.error) {
    console.error(`[ryzeService] Resposta da Ryze API com erro para '${action}':`, data);
    let errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    if (data?.details?.message) {
      errorMessage += `: ${data.details.message}`;
    } else if (data?.details?.error) {
      errorMessage += `: ${typeof data.details.error === 'string' ? data.details.error : JSON.stringify(data.details.error)}`;
    }
    throw new Error(errorMessage);
  }

  console.log(`[ryzeService] Sucesso na ação '${action}':`, data);
  return data;
}

export const ryze = {
  createInstance: (name: string) => invoke('create_instance', { name }),
  connect: (instance_id: string) => invoke('connect', { instance_id }),
  disconnect: (instance_id: string) => invoke('disconnect', { instance_id }),
  deleteInstance: (instance_id: string) => invoke('delete_instance', { instance_id }),
  status: (instance_id: string) => invoke('status', { instance_id }),
  registerWebhook: (instance_id: string) => invoke('register_webhook', { instance_id }),
  sendText: (instance_id: string, number: string, text: string) =>
    invoke('send_text', { instance_id, number, text }),
  sendMedia: (instance_id: string, number: string, media_url: string, media_type: string, caption?: string) =>
    invoke('send_media', { instance_id, number, media_url, media_type, caption }),
  getChats: (instance_id: string) => invoke('get_chats', { instance_id }),
  getMessages: (instance_id: string, wa_chat_id: string) =>
    invoke('get_messages', { instance_id, wa_chat_id }),
  getContacts: (instance_id: string) => invoke('get_contacts', { instance_id }),
};

// Convenience helpers
export async function sendWhatsappMessage(instanceId: string, number: string, text: string) {
  return ryze.sendText(instanceId, number, text);
}
export async function getChats(instanceId: string) { return ryze.getChats(instanceId); }
export async function getMessages(instanceId: string, chatId: string) { return ryze.getMessages(instanceId, chatId); }
export async function getContacts(instanceId: string) { return ryze.getContacts(instanceId); }
export async function sendMedia(instanceId: string, number: string, url: string, type: string, caption?: string) {
  return ryze.sendMedia(instanceId, number, url, type, caption);
}
