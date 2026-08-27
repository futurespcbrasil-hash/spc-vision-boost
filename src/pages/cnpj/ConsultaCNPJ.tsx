import { useState } from 'react';
import { Search, Loader2, Building2, MapPin, Phone, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  maskCNPJ, onlyDigits, isValidCNPJLength, situacaoTone, situacaoEmoji, situacaoClass,
  type CNPJResultado,
} from '@/lib/cnpjUtils';

const Campo = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex flex-col">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground break-words">
      {value || <span className="italic text-muted-foreground">Não informado</span>}
    </span>
  </div>
);

const ConsultaCNPJ = () => {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CNPJResultado | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  const consultar = async () => {
    const doc = onlyDigits(cnpj);
    if (!isValidCNPJLength(doc)) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    setLoading(true);
    setResult(null);
    setNotFound(null);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', { body: { cnpj: doc } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const r: CNPJResultado | undefined = data?.results?.[0];
      if (!r) throw new Error('Resposta inválida da consulta.');

      if (r.status !== 'encontrado') {
        setNotFound(r.erro || 'CNPJ não encontrado.');
      } else {
        setResult(r);
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from('cnpj_consultas').insert({
            user_id: userData.user.id,
            cnpj: r.cnpj,
            razao_social: r.razao_social,
            nome_fantasia: r.nome_fantasia,
            situacao: r.situacao,
            cep: r.cep,
            logradouro: r.logradouro,
            numero: r.numero,
            complemento: r.complemento,
            bairro: r.bairro,
            cidade: r.cidade,
            uf: r.uf,
            telefone: r.telefone,
            telefone_2: r.telefone_2,
            email: r.email,
            socios: (r.socios ?? []) as any,
            status: 'encontrado',
          });
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao consultar CNPJ.');
    } finally {
      setLoading(false);
    }
  };

  const tone = situacaoTone(result?.situacao);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta CNPJ</h1>
        <p className="text-sm text-muted-foreground">Consulte dados cadastrais públicos de empresas pela Receita Federal (BrasilAPI).</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Search size={18} /> Consulta individual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpj}
                placeholder="Digite o CNPJ"
                onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && consultar()}
              />
            </div>
            <Button onClick={consultar} disabled={loading} className="sm:w-48">
              {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Consultando CNPJ...</> : <><Search size={16} className="mr-2" /> Consultar CNPJ</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-sm text-destructive">{notFound}</CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Building2 size={18} /> Empresa</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="CNPJ" value={maskCNPJ(result.cnpj)} />
              <Campo label="Razão Social" value={result.razao_social} />
              <Campo label="Nome Fantasia" value={result.nome_fantasia} />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">Situação cadastral</span>
                <span className={`mt-1 inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${situacaoClass[tone]}`}>
                  {situacaoEmoji[tone]} {result.situacao || 'Não informada'}
                </span>
              </div>
              <Campo label="Atividade principal" value={result.cnae} />
              <Campo label="Porte" value={result.porte} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MapPin size={18} /> Endereço</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="CEP" value={result.cep} />
              <Campo label="Logradouro" value={result.logradouro} />
              <Campo label="Número" value={result.numero} />
              <Campo label="Complemento" value={result.complemento} />
              <Campo label="Bairro" value={result.bairro} />
              <Campo label="Cidade / UF" value={[result.cidade, result.uf].filter(Boolean).join(' / ')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Phone size={18} /> Contato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Telefone" value={result.telefone} />
              <Campo label="Telefone secundário" value={result.telefone_2} />
              <Campo label="E-mail" value={result.email} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users size={18} /> Sócios</CardTitle>
            </CardHeader>
            <CardContent>
              {result.socios && result.socios.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Qualificação</TableHead>
                        <TableHead>Data de entrada</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.socios.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.nome || '—'}</TableCell>
                          <TableCell>{s.qualificacao || '—'}</TableCell>
                          <TableCell>{s.data_entrada ? new Date(s.data_entrada).toLocaleDateString('pt-BR') : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum sócio informado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ConsultaCNPJ;
