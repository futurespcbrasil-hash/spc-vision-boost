import { supabase } from '@/integrations/supabase/client';

export type TipoDocumento = 'CPF' | 'CNPJ';
export type TipoConsulta = 'SPC_MAXI' | 'INTERMEDIARIA_1' | 'AVANCADA_POSITIVO_PF' | 'AVANCADA_POSITIVO_PJ';

export interface ConsultaSPCPayload {
  tipoDocumento: TipoDocumento;
  documento: string;
  tipoConsulta: TipoConsulta;
}

export async function consultarSPC(payload: ConsultaSPCPayload): Promise<Record<string, any>> {
  const { data, error } = await supabase.functions.invoke('spc-consultar', { body: payload });
  if (error) throw error;
  return data as Record<string, any>;
}

export const TIPO_CONSULTA_OPTIONS: { value: TipoConsulta; label: string }[] = [
  { value: 'SPC_MAXI', label: 'SPC Maxi' },
  { value: 'INTERMEDIARIA_1', label: 'Intermediária 1' },
  { value: 'AVANCADA_POSITIVO_PF', label: 'Avançada Positivo PF' },
  { value: 'AVANCADA_POSITIVO_PJ', label: 'Avançada Positivo PJ' },
];

export function maskDocumento(value: string, tipo: TipoDocumento): string {
  const d = value.replace(/\D/g, '');
  if (tipo === 'CPF') {
    return d
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
