export type WhatsAppInboxState = 'waiting' | 'resolved' | 'open';
export type WhatsAppInboxFilter = 'todos' | 'grupos' | 'aguardando' | 'resolvidos';

export interface WhatsAppFlowSessionState {
  chat_id: string;
  status: string | null;
}

export interface WhatsAppServiceSessionState {
  chat_id: string;
  started_at: string | null;
  closed_at: string | null;
}

export interface WhatsAppInboxChat {
  id: string;
  wa_chat_id: string;
  is_group?: boolean;
  inbox_state?: WhatsAppInboxState;
}

/**
 * Waiting means the bot is actively waiting for a menu choice.
 * Resolved means the latest service cycle was explicitly closed.
 * Unread count and assignment alone do not determine lifecycle state.
 */
export const deriveWhatsAppInboxStates = (
  chats: Pick<WhatsAppInboxChat, 'id' | 'is_group'>[],
  flowSessions: WhatsAppFlowSessionState[],
  serviceSessions: WhatsAppServiceSessionState[],
): Record<string, WhatsAppInboxState> => {
  const awaitingChoice = new Set(
    flowSessions.filter(session => session.status === 'awaiting_choice').map(session => session.chat_id),
  );
  const latestServiceByChat = new Map<string, WhatsAppServiceSessionState>();
  for (const session of serviceSessions) {
    const previous = latestServiceByChat.get(session.chat_id);
    const timestamp = Date.parse(session.started_at || '');
    const previousTimestamp = Date.parse(previous?.started_at || '');
    if (!previous || (Number.isFinite(timestamp) && timestamp >= previousTimestamp)) {
      latestServiceByChat.set(session.chat_id, session);
    }
  }

  return Object.fromEntries(chats.map(chat => {
    if (!chat.is_group && awaitingChoice.has(chat.id)) return [chat.id, 'waiting'];
    const latest = latestServiceByChat.get(chat.id);
    return [chat.id, !chat.is_group && latest?.closed_at ? 'resolved' : 'open'];
  }));
};

export const matchesWhatsAppInboxFilter = (
  chat: WhatsAppInboxChat,
  filter: WhatsAppInboxFilter,
): boolean => {
  const isGroup = !!chat.is_group || chat.wa_chat_id.includes('@g.us');
  if (filter === 'grupos') return isGroup;
  if (isGroup) return false;
  if (filter === 'aguardando') return chat.inbox_state === 'waiting';
  if (filter === 'resolvidos') return chat.inbox_state === 'resolved';
  return true;
};
