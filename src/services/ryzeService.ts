import { supabase } from '@/integrations/supabase/client';

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('ryze-proxy', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data;
}

export const ryze = {
  createInstance: (name: string) => invoke('create_instance', { name }),
  connect: (instance_id: string) => invoke('connect', { instance_id }),
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

// Convenience helpers (as requested in the spec)
export async function sendWhatsappMessage(instanceId: string, number: string, text: string) {
  return ryze.sendText(instanceId, number, text);
}
export async function getChats(instanceId: string) { return ryze.getChats(instanceId); }
export async function getMessages(instanceId: string, chatId: string) { return ryze.getMessages(instanceId, chatId); }
export async function getContacts(instanceId: string) { return ryze.getContacts(instanceId); }
export async function sendMedia(instanceId: string, number: string, url: string, type: string, caption?: string) {
  return ryze.sendMedia(instanceId, number, url, type, caption);
}
