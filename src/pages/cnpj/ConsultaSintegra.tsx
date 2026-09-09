import { useState } from 'react';
import { Search, Loader2, Building2, MapPin, FileText, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { maskCNPJ, onlyDigits, isValidCNPJLength } from '@/lib/cnpjUtils';

const Campo = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex flex-col">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground break-words">
      {value || <span className="italic text-muted-foreground">Não informado</span>}
    </span>
  </div>
);

const val = (v: unknown) => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

const ConsultaSintegra = () => {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const consultar = async () => {
    const doc = onlyDigits(cnpj);
    if (!isValidCNPJLength(doc)) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    setLoading(true);
    setResult(null);
    setErro(null);
    setAviso(null);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-sintegra', { body: { cnpj: doc } });
      if (error) throw error;

      if (!data?.ok) {
        setErro(data?.error || 'Não foi possível concluir a consulta dos dados fiscais.');
      } else {
        setResult(data.data);
        if (data.aviso) setAviso(data.aviso);
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const d = data?.ok ? data.data : null;
        await supabase.from('cnpj_consultas').insert({
          user_id: userData.user.id,
          cnpj: doc,
          razao_social: val(d?.nome_empresarial),
          nome_fantasia: val(d?.nome_fantasia),
          situacao: val(d?.situacao_cadastral),
          cep: val(d?.cep),
          logradouro: val(d?.logradouro),
          numero: val(d?.numero),
          complemento: val(d?.complemento),
          bairro: val(d?.bairro),
          cidade: val(d?.municipio),
          uf: val(d?.uf),
          socios: [] as any,
          status: data?.ok ? 'encontrado' : 'erro',
          erro: data?.ok ? null : (data?.error ?? null),
        });
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro ao consultar o Sintegra.');
    } finally {
      setLoading(false);
    }
  };

  const outrasIes: any[] = Array.isArray(result?.outras_ies) ? result.outras_ies : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta Sintegra</h1>
        <p className="text-sm text-muted-foreground">
          Consulte dados fiscais/estaduais da empresa: Inscrição Estadual, situação da IE, contribuinte de ICMS e regime tributário.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search size={18} /> Consulta por CNPJ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cnpj-sintegra">CNPJ</Label>
              <Input
                id="cnpj-sintegra"
                value={cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && !loading && consultar()}
              />
            </div>
            <Button onClick={consultar} disabled={loading} className="sm:w-56">
              {loading
                ? <><Loader2 className="animate-spin mr-2" size={16} /> Consultando dados fiscais...</>
                : <><Search size={16} className="mr-2" /> Consultar Sintegra</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {erro && (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">{erro}</CardContent>
        </Card>
      )}

      {aviso && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="py-4 text-sm text-yellow-700">{aviso}</CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Inscrição Estadual</div>
                <div className="text-2xl font-bold text-primary break-words">
                  {val(result.inscricao_estadual) || 'Não informada'}
                </div>
              </div>
              <Campo label="Situação IE" value={val(result.situacao_ie)} />
              <Campo label="Contribuinte ICMS" value={val(result.contribuinte_icms)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Building2 size={18} /> Empresa</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="CNPJ" value={maskCNPJ(String(result.cnpj || cnpj))} />
              <Campo label="Nome Empresarial" value={val(result.nome_empresarial)} />
              <Campo label="Nome Fantasia" value={val(result.nome_fantasia)} />
              <Campo label="Situação do CNPJ" value={val(result.situacao_cadastral)} />
              <Campo label="Data da situação cadastral" value={val(result.data_situacao_cadastral)} />
              <Campo label="Data de início da atividade" value={val(result.data_inicio_atividade)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><BadgeCheck size={18} /> Dados fiscais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Inscrição Estadual" value={val(result.inscricao_estadual)} />
              <Campo label="Situação da IE" value={val(result.situacao_ie)} />
              <Campo label="Contribuinte ICMS" value={val(result.contribuinte_icms)} />
              <Campo label="Regime de Tributação" value={val(result.regime_tributacao) || val(result.regime_apuracao)} />
              <Campo label="Tipo de Inscrição" value={val(result.tipo_inscricao)} />
              <Campo label="Natureza Jurídica" value={val(result.natureza_juridica)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MapPin size={18} /> Endereço</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="CEP" value={val(result.cep)} />
              <Campo label="Endereço" value={val(result.logradouro)} />
              <Campo label="Número" value={val(result.numero)} />
              <Campo label="Complemento" value={val(result.complemento)} />
              <Campo label="Bairro" value={val(result.bairro)} />
              <Campo label="Município / UF" value={[val(result.municipio), val(result.uf)].filter(Boolean).join(' / ')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText size={18} /> CNAE</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="CNAE principal" value={val(result.cnae_principal) || val(result.atividade_principal_codigo)} />
              <Campo label="Descrição" value={val(result.cnae_principal_descricao) || val(result.atividade_principal)} />
            </CardContent>
          </Card>

          {outrasIes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Outras inscrições estaduais</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inscrição Estadual</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outrasIes.map((ie, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{val(ie?.inscricao_estadual) || '—'}</TableCell>
                        <TableCell>{val(ie?.uf) || '—'}</TableCell>
                        <TableCell>{val(ie?.situacao_ie) || val(ie?.situacao) || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsultaSintegra;
