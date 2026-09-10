export const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  conectando: 'Conectando',
};

export const StatusDot = ({ status }: { status?: string | null }) => {
  const s = (status ?? 'offline').toLowerCase();
  const emoji = s === 'online' ? '🟢' : s === 'conectando' ? '🟡' : '🔴';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden>{emoji}</span>
      <span>{STATUS_LABEL[s] ?? 'Offline'}</span>
    </span>
  );
};

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR') : '—';

export const fmtDuration = (seconds?: number | null) => {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};
