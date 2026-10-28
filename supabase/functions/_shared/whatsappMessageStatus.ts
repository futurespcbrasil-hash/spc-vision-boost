export type WhatsAppDeliveryState = 'pending' | 'sent' | 'delivered' | 'read' | 'error';

const ACK_NAMES: Record<string, string> = {
  ERROR: '-1', PENDING: '0', SERVER: '1', DEVICE: '2', READ: '3', PLAYED: '4',
};

/** Converts WAHA's numeric ack or symbolic name to a canonical string. */
export const normalizeWhatsAppAck = (ack: unknown, ackName?: unknown): string | null => {
  const named = typeof ackName === 'string' ? ACK_NAMES[ackName.trim().toUpperCase()] : null;
  if (named) return named;
  const value = typeof ack === 'number' ? String(ack) : typeof ack === 'string' ? ack.trim().toUpperCase() : '';
  if (ACK_NAMES[value]) return ACK_NAMES[value];
  return ['-1', '0', '1', '2', '3', '4'].includes(value) ? value : null;
};

const canonicalStatus = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const status = value.trim().toLowerCase();
  if (status === 'deleted') return 'deleted';
  if (status === 'failed' || status === 'error') return '-1';
  if (status === 'pending' || status === 'queued') return '0';
  if (status === 'sent' || status === 'server') return '1';
  if (status === 'delivered' || status === 'device') return '2';
  if (status === 'read') return '3';
  if (status === 'played') return '4';
  return normalizeWhatsAppAck(status);
};

/** Merge ACKs without allowing delayed polling/events to downgrade a receipt. */
export const mergeWhatsAppAckStatus = (current: unknown, nextAck: unknown): string => {
  const oldStatus = canonicalStatus(current);
  if (oldStatus === 'deleted') return 'deleted';
  const incoming = typeof nextAck === 'string' ? canonicalStatus(nextAck) : normalizeWhatsAppAck(nextAck);
  if (!incoming) return oldStatus || (typeof current === 'string' && current ? current : '1');
  if (incoming === '-1') {
    const oldLevel = oldStatus === '4' || oldStatus === '3' ? 3 : oldStatus === '2' ? 2 : -1;
    return oldLevel >= 2 ? oldStatus! : '-1';
  }
  if (oldStatus === '-1') return incoming;
  const level = (status: string | null) => status === '4' || status === '3' ? 3
    : status === '2' ? 2 : status === '1' ? 1 : status === '0' ? 0 : -1;
  return level(incoming) >= level(oldStatus) ? incoming : oldStatus || '1';
};

export const getWhatsAppDeliveryState = (status: unknown): WhatsAppDeliveryState => {
  const normalized = canonicalStatus(status);
  if (normalized === '-1') return 'error';
  if (normalized === '0') return 'pending';
  if (normalized === '2') return 'delivered';
  if (normalized === '3' || normalized === '4') return 'read';
  // Legacy outgoing rows marked "received" mean the webhook inserted them
  // before the sender-side confirmation; show a neutral single check.
  return 'sent';
};

/** WAHA adds a participant suffix to group ACK IDs; try both exact and base IDs. */
export const getWhatsAppAckMessageIdCandidates = (value: unknown): string[] => {
  const full = typeof value === 'string' ? value.trim()
    : value && typeof value === 'object' && typeof (value as any)._serialized === 'string'
      ? (value as any)._serialized.trim() : '';
  if (!full) return [];
  const candidates = [full];
  const groupMarker = full.indexOf('@g.us_');
  const lastSeparator = full.lastIndexOf('_');
  if (groupMarker >= 0 && lastSeparator > groupMarker) {
    const participant = full.slice(lastSeparator + 1);
    if (participant.includes('@')) candidates.push(full.slice(0, lastSeparator));
  }
  return [...new Set(candidates)];
};
