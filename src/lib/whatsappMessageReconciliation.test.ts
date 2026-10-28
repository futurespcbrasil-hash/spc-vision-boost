import { describe, expect, it } from 'vitest';
import {
  deduplicateMessages,
  dropConfirmedTemps,
  isConfirmedOptimisticMatch,
  type MessageReconciliationItem,
} from './whatsappMessageReconciliation';

const message = (
  id: string,
  overrides: Partial<MessageReconciliationItem> = {},
): MessageReconciliationItem => ({
  id,
  wa_message_id: null,
  from_me: false,
  text: '',
  timestamp: '2026-10-28T11:00:00.000Z',
  ...overrides,
});

describe('WhatsApp message reconciliation', () => {
  it('deduplicates the same local row and the same provider message ID', () => {
    const first = message('local-1', { wa_message_id: 'waha-1' });
    const duplicateLocal = { ...first };
    const duplicateRemote = message('local-2', { wa_message_id: 'waha-1' });
    const unique = message('local-3', { wa_message_id: 'waha-2' });

    expect(deduplicateMessages([first, duplicateLocal, duplicateRemote, unique]))
      .toEqual([first, unique]);
  });

  it('does not collapse distinct messages that have the same text', () => {
    const first = message('local-1', { wa_message_id: 'waha-1', text: 'ok' });
    const second = message('local-2', { wa_message_id: 'waha-2', text: 'ok' });

    expect(deduplicateMessages([first, second])).toEqual([first, second]);
  });

  it('matches a pending outgoing bubble only to a sent message within its time window', () => {
    const pending = message('temp-123', {
      from_me: true,
      text: ' bom dia ',
      timestamp: '2026-10-28T11:00:00.000Z',
    });
    const confirmed = message('local-1', {
      from_me: true,
      wa_message_id: 'waha-1',
      text: 'bom dia',
      timestamp: '2026-10-28T11:00:01.000Z',
    });

    expect(isConfirmedOptimisticMatch(pending, confirmed)).toBe(true);
    expect(dropConfirmedTemps([confirmed], [pending])).toEqual([confirmed]);
  });

  it('keeps an older identical message and the current pending bubble', () => {
    const pending = message('temp-123', {
      from_me: true,
      text: 'ok',
      timestamp: '2026-10-28T11:00:00.000Z',
    });
    const oldMessage = message('local-1', {
      from_me: true,
      wa_message_id: 'waha-old',
      text: 'ok',
      timestamp: '2026-10-27T11:00:00.000Z',
    });

    expect(isConfirmedOptimisticMatch(pending, oldMessage)).toBe(false);
    expect(dropConfirmedTemps([oldMessage], [pending])).toEqual([oldMessage, pending]);
  });

  it('does not reconcile an incoming message or a message outside the allowed window', () => {
    const pending = message('temp-123', {
      from_me: true,
      text: 'ok',
      timestamp: '2026-10-28T11:00:00.000Z',
    });
    const incoming = message('local-1', { text: 'ok', timestamp: pending.timestamp });
    const tooLate = message('local-2', {
      from_me: true,
      text: 'ok',
      timestamp: '2026-10-28T11:02:00.000Z',
    });

    expect(isConfirmedOptimisticMatch(pending, incoming)).toBe(false);
    expect(isConfirmedOptimisticMatch(pending, tooLate)).toBe(false);
    expect(dropConfirmedTemps([incoming, tooLate], [pending]))
      .toEqual([incoming, tooLate, pending]);
  });
});
