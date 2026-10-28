export interface MessageReconciliationItem {
  id: string;
  wa_message_id?: string | null;
  from_me: boolean;
  text: string | null;
  timestamp: string;
}

/** Remove duplicate local rows and duplicate provider messages from a rendered list. */
export const deduplicateMessages = <T extends MessageReconciliationItem>(items: T[]): T[] => {
  const localIds = new Set<string>();
  const remoteIds = new Set<string>();
  return items.filter(message => {
    if (localIds.has(message.id)) return false;
    if (message.wa_message_id && remoteIds.has(message.wa_message_id)) return false;
    localIds.add(message.id);
    if (message.wa_message_id) remoteIds.add(message.wa_message_id);
    return true;
  });
};

/** Match a temporary outgoing bubble only to a confirmed message in its time window. */
export const isConfirmedOptimisticMatch = (
  optimistic: MessageReconciliationItem,
  confirmed: MessageReconciliationItem,
): boolean => {
  if (!optimistic.id.startsWith('temp-') || !confirmed.from_me ||
      (confirmed.text || '').trim() !== (optimistic.text || '').trim()) return false;
  const optimisticAt = Date.parse(optimistic.timestamp || '');
  const confirmedAt = Date.parse(confirmed.timestamp || '');
  if (!Number.isFinite(optimisticAt) || !Number.isFinite(confirmedAt)) return false;
  const delta = confirmedAt - optimisticAt;
  return delta >= -1000 && delta < 120000;
};

/** Keep pending bubbles until the corresponding provider-confirmed message arrives. */
export const dropConfirmedTemps = <T extends MessageReconciliationItem>(list: T[], previous: T[]): T[] => {
  const uniqueList = deduplicateMessages(list);
  const temps = previous.filter(message => message.id.startsWith('temp-'));
  if (temps.length === 0) return uniqueList;
  const keep = temps.filter(temp => !uniqueList.some(message => isConfirmedOptimisticMatch(temp, message)));
  return deduplicateMessages([...uniqueList, ...keep]);
};
