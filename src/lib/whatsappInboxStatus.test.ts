import { describe, expect, it } from 'vitest';
import {
  deriveWhatsAppInboxStates,
  matchesWhatsAppInboxFilter,
  type WhatsAppInboxChat,
} from './whatsappInboxStatus';

const directChat = (id: string, inbox_state?: WhatsAppInboxChat['inbox_state']): WhatsAppInboxChat => ({
  id,
  wa_chat_id: '5548999999999@c.us',
  inbox_state,
});

describe('WhatsApp inbox lifecycle filters', () => {
  it('marks only bot sessions awaiting a menu choice as waiting', () => {
    const states = deriveWhatsAppInboxStates(
      [{ id: 'waiting', is_group: false }, { id: 'unread', is_group: false }, { id: 'unassigned', is_group: false }],
      [{ chat_id: 'waiting', status: 'awaiting_choice' }, { chat_id: 'unread', status: 'routed' }],
      [],
    );

    expect(states).toEqual({ waiting: 'waiting', unread: 'open', unassigned: 'open' });
    expect(matchesWhatsAppInboxFilter(directChat('waiting', states.waiting), 'aguardando')).toBe(true);
    expect(matchesWhatsAppInboxFilter(directChat('unread', states.unread), 'aguardando')).toBe(false);
    expect(matchesWhatsAppInboxFilter(directChat('unassigned', states.unassigned), 'aguardando')).toBe(false);
  });

  it('marks a conversation resolved only when its latest service session is closed', () => {
    const states = deriveWhatsAppInboxStates(
      [{ id: 'closed', is_group: false }, { id: 'reopened', is_group: false }],
      [],
      [
        { chat_id: 'closed', started_at: '2026-10-28T10:00:00Z', closed_at: '2026-10-28T10:30:00Z' },
        { chat_id: 'reopened', started_at: '2026-10-27T10:00:00Z', closed_at: '2026-10-27T10:30:00Z' },
        { chat_id: 'reopened', started_at: '2026-10-28T10:00:00Z', closed_at: null },
      ],
    );

    expect(states).toEqual({ closed: 'resolved', reopened: 'open' });
    expect(matchesWhatsAppInboxFilter(directChat('closed', states.closed), 'resolvidos')).toBe(true);
    expect(matchesWhatsAppInboxFilter(directChat('reopened', states.reopened), 'resolvidos')).toBe(false);
  });

  it('keeps groups in the group filter, separate from lifecycle tabs', () => {
    const group: WhatsAppInboxChat = { id: 'group', wa_chat_id: '120@g.us', is_group: true, inbox_state: 'resolved' };

    expect(matchesWhatsAppInboxFilter(group, 'grupos')).toBe(true);
    expect(matchesWhatsAppInboxFilter(group, 'todos')).toBe(false);
    expect(matchesWhatsAppInboxFilter(group, 'resolvidos')).toBe(false);
  });
});
