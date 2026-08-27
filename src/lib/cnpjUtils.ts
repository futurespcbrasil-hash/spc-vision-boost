export const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export const maskCNPJ = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

export const isValidCNPJLength = (v: string) => onlyDigits(v).length === 14;

/** Normaliza telefone brasileiro para o formato internacional (55 + DDD + número). */
export const normalizePhone = (raw: unknown): string | null => {
  let d = onlyDigits(raw);
  if (!d) return null;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return null;
};

export type SituacaoTone = 'ativa' | 'baixada' | 'inapta' | 'suspensa' | 'outra';

export const situacaoTone = (s?: string | null): SituacaoTone => {
  const v = (s ?? '').toUpperCase();
  if (v.includes('ATIVA')) return 'ativa';
  if (v.includes('BAIXADA')) return 'baixada';
  if (v.includes('INAPTA')) return 'inapta';
  if (v.includes('SUSPENSA')) return 'suspensa';
  return 'outra';
};

export const situacaoEmoji: Record<SituacaoTone, string> = {
  ativa: '🟢',
  baixada: '🔴',
  inapta: '🟠',
  suspensa: '🟡',
  outra: '⚪',
};

export const situacaoClass: Record<SituacaoTone, string> = {
  ativa: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  baixada: 'bg-destructive/10 text-destructive border-destructive/30',
  inapta: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  suspensa: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  outra: 'bg-muted text-muted-foreground border-border',
};

export interface Socio {
  nome?: string | null;
  qualificacao?: string | null;
  data_entrada?: string | null;
}

export interface CNPJResultado {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  telefone_2?: string | null;
  email?: string | null;
  socios?: Socio[];
  cnae?: string | null;
  porte?: string | null;
  status: 'pendente' | 'processando' | 'encontrado' | 'nao_encontrado' | 'erro';
  erro?: string | null;
}

export const enderecoCompleto = (r: CNPJResultado) =>
  [r.logradouro, r.numero, r.complemento, r.bairro].filter(Boolean).join(', ');

export const hojeArquivo = () => new Date().toISOString().slice(0, 10);
