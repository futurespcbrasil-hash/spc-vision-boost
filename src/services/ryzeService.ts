import { supabase } from '@/integrations/supabase/client';

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('waha-proxy', {
    body: { action, ...payload },
  });

  if (error) {
    let errorMessage = error.message || 'Erro de comunicação com o WhatsApp';
    try {
      if ('context' in error && (error as any).context) {
        const ctx = await (error as any).context.json();
        if (ctx?.error) errorMessage = typeof ctx.error === 'string' ? ctx.error : JSON.stringify(ctx.error);
        if (ctx?.details?.message) errorMessage += `: ${ctx.details.message}`;
      }
    } catch { /* mantém a mensagem original */ }
    throw new Error(errorMessage);
  }

  if (data?.error) {
    const message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new Error(message);
  }
  return data;
}

// Mantém a interface utilizada pelas telas atuais para reduzir mudanças arriscadas.
// O transporte agora é WAHA; nenhuma chamada do navegador acessa a chave da API.
export const ryze = {
  syncInstances: () => invoke('sync_instances'),
  createInstance: (name: string) => invoke('create_instance', { name }),
  connect: (instance_id: string) => invoke('connect', { instance_id }),
  disconnect: (instance_id: string) => invoke('disconnect', { instance_id }),
  deleteInstance: (instance_id: string) => invoke('delete_instance', { instance_id }),
  status: (instance_id: string) => invoke('status', { instance_id }),
  registerWebhook: (instance_id: string) => invoke('register_webhook', { instance_id }),
  sendText: (instance_id: string, number: string, text: string) =>
    invoke('send_text', { instance_id, number, text }),
  sendMedia: (instance_id: string, number: string, media_url: string, media_type: string, caption?: string, media_mime?: string) =>
    invoke('send_media', { instance_id, number, media_url, media_type, caption, media_mime }),
  getChats: (instance_id: string) => invoke('get_chats', { instance_id }),
  getMessages: (instance_id: string, wa_chat_id: string) =>
    invoke('get_messages', { instance_id, wa_chat_id }),
  getContacts: (instance_id: string) => invoke('get_contacts', { instance_id }),
  getProfilePic: (instance_id: string, wa_chat_id: string) =>
    invoke('get_profile_pic', { instance_id, wa_chat_id }),
};

export async function sendWhatsappMessage(instanceId: string, number: string, text: string) {
  return ryze.sendText(instanceId, number, text);
}
export async function getChats(instanceId: string) { return ryze.getChats(instanceId); }
export async function getMessages(instanceId: string, chatId: string) { return ryze.getMessages(instanceId, chatId); }
export async function getContacts(instanceId: string) { return ryze.getContacts(instanceId); }
export async function sendMedia(instanceId: string, number: string, url: string, type: string, caption?: string) {
  return ryze.sendMedia(instanceId, number, url, type, caption);
}
