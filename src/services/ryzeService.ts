import { supabase } from '@/integrations/supabase/client';

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('waha-proxy', {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || 'Erro de comunicação com a WAHA';
    try {
      const context = (error as any).context;
      if (context) {
        const body = await context.clone().json();
        if (body?.error) message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
      }
    } catch { /* usa a mensagem original */ }
    if (message.includes('non-2xx status code')) {
      message = 'Falha ao conectar com a WAHA. Confira os secrets WAHA_API_URL e WAHA_API_KEY no Supabase.';
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export const waha = {
  syncInstances: () => invoke('sync_instances'),
  createInstance: (name: string) => invoke('create_instance', { name }),
  connect: (instance_id: string) => invoke('connect', { instance_id }),
  disconnect: (instance_id: string) => invoke('disconnect', { instance_id }),
  deleteInstance: (instance_id: string) => invoke('delete_instance', { instance_id }),
  status: (instance_id: string) => invoke('status', { instance_id }),
  registerWebhook: (instance_id: string) => invoke('register_webhook', { instance_id }),
  sendText: (instance_id: string, number: string, text: string) =>
    invoke('send_text', { instance_id, number, text }),
  sendMedia: (instance_id: string, number: string, media_url: string, media_type: string, caption?: string, media_mime?: string, filename?: string) =>
    invoke('send_media', { instance_id, number, media_url, media_type, caption, media_mime, filename }),
  getChats: (instance_id: string) => invoke('get_chats', { instance_id }),
  getMessages: (instance_id: string, wa_chat_id: string) =>
    invoke('get_messages', { instance_id, wa_chat_id }),
  getContacts: (instance_id: string) => invoke('get_contacts', { instance_id }),
  getProfilePic: (instance_id: string, wa_chat_id: string) =>
    invoke('get_profile_pic', { instance_id, wa_chat_id }),
};

export async function sendWhatsappMessage(instanceId: string, number: string, text: string) {
  return waha.sendText(instanceId, number, text);
}
export async function getChats(instanceId: string) { return waha.getChats(instanceId); }
export async function getMessages(instanceId: string, chatId: string) { return waha.getMessages(instanceId, chatId); }
export async function getContacts(instanceId: string) { return waha.getContacts(instanceId); }
export async function sendMedia(instanceId: string, number: string, url: string, type: string, caption?: string) {
  return waha.sendMedia(instanceId, number, url, type, caption);
}
