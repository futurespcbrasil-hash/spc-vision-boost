export const REQUEST_STATUS: Record<string, { label: string; className: string }> = {
  aguardando: { label: 'Aguardando', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  codigo_validado: { label: 'Código validado', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  computador_conectado: { label: 'Computador conectado', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  em_atendimento: { label: 'Em atendimento', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  finalizado: { label: 'Finalizado', className: 'bg-muted text-muted-foreground border-border' },
  expirado: { label: 'Expirado', className: 'bg-red-100 text-red-800 border-red-300' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-300' },
};

export const StatusBadge = ({ status }: { status?: string | null }) => {
  const s = REQUEST_STATUS[status ?? ''] ?? { label: status ?? '—', className: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
};

export const DeviceStatus = ({ status }: { status?: string | null }) => {
  const online = (status ?? '').toLowerCase() === 'online';
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden>{online ? '🟢' : '⚪'}</span>
      <span>{online ? 'Online' : 'Offline'}</span>
    </span>
  );
};

export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

export const fmtDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

/** Contador regressivo em texto (mm:ss) a partir de uma data de expiração. */
export const countdown = (expiresAt?: string | null, now = Date.now()) => {
  if (!expiresAt) return null;
  const diff = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (diff <= 0) return 'expirado';
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
