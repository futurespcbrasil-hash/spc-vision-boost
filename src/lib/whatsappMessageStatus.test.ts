import { describe, expect, it } from 'vitest';
import {
  getWhatsAppAckMessageIdCandidates,
  getWhatsAppDeliveryState,
  mergeWhatsAppAckStatus,
  normalizeWhatsAppAck,
} from '../../supabase/functions/_shared/whatsappMessageStatus';

describe('WhatsApp delivery receipts', () => {
  it('normalizes numeric and named WAHA acknowledgements, including zero', () => {
    expect(normalizeWhatsAppAck(0)).toBe('0');
    expect(normalizeWhatsAppAck('3')).toBe('3');
    expect(normalizeWhatsAppAck(undefined, 'READ')).toBe('3');
    expect(normalizeWhatsAppAck(-1, 'ERROR')).toBe('-1');
    expect(normalizeWhatsAppAck(9)).toBeNull();
  });

  it('maps sent, delivered, and read acknowledgements to WhatsApp-style ticks', () => {
    expect(getWhatsAppDeliveryState('0')).toBe('pending');
    expect(getWhatsAppDeliveryState('1')).toBe('sent');
    expect(getWhatsAppDeliveryState('2')).toBe('delivered');
    expect(getWhatsAppDeliveryState('3')).toBe('read');
    expect(getWhatsAppDeliveryState('4')).toBe('read');
    expect(getWhatsAppDeliveryState('read')).toBe('read');
  });

  it('never downgrades a read or delivered message when polling is stale', () => {
    expect(mergeWhatsAppAckStatus('3', '1')).toBe('3');
    expect(mergeWhatsAppAckStatus('4', '2')).toBe('4');
    expect(mergeWhatsAppAckStatus('2', '0')).toBe('2');
    expect(mergeWhatsAppAckStatus('1', null)).toBe('1');
    expect(mergeWhatsAppAckStatus('sent', '3')).toBe('3');
  });

  it('handles WAHA group ACK IDs that include a participant suffix', () => {
    expect(getWhatsAppAckMessageIdCandidates(
      'true_11111111111@g.us_4CC5EDD64BC22EBA6D639F2AF571346C_9999@lid',
    )).toEqual([
      'true_11111111111@g.us_4CC5EDD64BC22EBA6D639F2AF571346C_9999@lid',
      'true_11111111111@g.us_4CC5EDD64BC22EBA6D639F2AF571346C',
    ]);
  });
});
