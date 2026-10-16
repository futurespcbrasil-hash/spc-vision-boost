import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, DollarSign, Loader2, RefreshCw, Save, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Indicacao = {
  id: string; user_id: string; nome: string; razao_social: string | null; cnpj: string | null;
  responsavel: string | null; telefone: string | null; email: string | null; cidade: string | null; created_at: string;
};
type Profile = { id: string; display_name?: string | null; email?: string | null };

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function ComissoesIndicacoesSistema() {
  const { role, canManageUsers } = useAuth();
  const [rows, setRows] = useState<Indicacao[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [valorMensal, setValorMensal] = useState('10.00');
  const [valorInput, setValorInput] = useState('10,00');
  const [competencia, setCompetencia] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [indicacoesResult, configResult, profilesResult] = await Promise.all([
      (supabase as any).from('atendimento_indicacoes').select('id,user_id,nome,razao_social,cnpj,responsavel,telefone,email,cidade,created_at').order('created_at', { ascending: false }),
      (supabase as any).from('atendimento_comissao_config').select('valor_mensal').eq('id', 1).maybeSingle(),
      (supabase as any).from('profiles').select('id,display_name,email'),
    ]);
    if (indicacoesResult.error) toast.error('Erro ao carregar indicações: ' + indicacoesResult.error.message);
    else setRows((indicacoesResult.data ?? []) as Indicacao[]);
    if (configResult.error) toast.error('Erro ao carregar o valor da comissão: ' + configResult.error.message);
    else if (configResult.data) {
      const value = Number(configResult.data.valor_mensal ?? 10);
      setValorMensal(value.toFixed(2));
      setValorInput(value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    if (!profilesResult.error && profilesResult.data) {
      setProfiles(Object.fromEntries((profilesResult.data as Profile[]).map(p => [p.id, p])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const valor = Number(valorMensal);
  const totalMensal = rows.length * valor;
  const porAtendimento = useMemo(() => {
    const grouped = new Map<string, { userId: string; nome: string; quantidade: number; total: number }>();
    rows.forEach(row => {
      const profile = profiles[row.user_id];
      const nome = profile?.display_name || profile?.email || 'Usuário de Atendimento';
      const current = grouped.get(row.user_id) ?? { userId: row.user_id, nome, quantidade: 0, total: 0 };
      current.quantidade += 1;
      current.total += valor;
      grouped.set(row.user_id, current);
    });
    return [...grouped.values()].sort((a, b) => b.total - a.total);
  }, [rows, profiles, valor]);

  const saveConfig = async () => {
    const parsed = Number(valorInput.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
      toast.error('Informe um valor mensal válido.');
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('atendimento_comissao_config').upsert({
      id: 1, valor_mensal: parsed, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar o valor: ' + error.message); return; }
    setValorMensal(parsed.toFixed(2));
    setValorInput(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    toast.success('Valor mensal da comissão atualizado.');
  };

  if (role !== 'gestor' && !canManageUsers) return <div className="p-6"><Card><CardContent className="py-10 text-center">Acesso restrito ao perfil Gestor.</CardContent></Card></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indicações — Sistema de Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe os clientes indicados pelo Atendimento e o valor mensal previsto de comissão.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="h-5 w-5" />Configuração da comissão mensal</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="comissao-valor">Valor por cliente indicado / mês (R$)</Label>
            <Input id="comissao-valor" inputMode="decimal" value={valorInput} onChange={e => setValorInput(e.target.value)} className="sm:w-56" />
          </div>
          <Button onClick={() => void saveConfig()} disabled={saving || loading}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar valor</Button>
          <p className="text-xs text-muted-foreground sm:pb-2">O padrão inicial é R$ 10,00 por cliente a cada mês.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Clientes indicados</p><p className="text-2xl font-bold">{rows.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Atendimentos com indicações</p><p className="text-2xl font-bold">{porAtendimento.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><DollarSign className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Total mensal previsto</p><p className="text-2xl font-bold">{currency(totalMensal)}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-lg">Resumo por Atendimento</CardTitle><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><Label htmlFor="competencia" className="whitespace-nowrap">Competência</Label><Input id="competencia" type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="w-44" /></div></div></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Competência selecionada: {competencia ? competencia.split('-').reverse().join('/') : '—'}. O cálculo considera as indicações cadastradas, usando o valor mensal atual configurado acima.</p>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : porAtendimento.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma indicação cadastrada até o momento.</p> :
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuário de Atendimento</TableHead><TableHead className="text-right">Clientes indicados</TableHead><TableHead className="text-right">Comissão mensal</TableHead></TableRow></TableHeader><TableBody>{porAtendimento.map(item => <TableRow key={item.userId}><TableCell className="font-medium">{item.nome}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right font-semibold">{currency(item.total)}</TableCell></TableRow>)}</TableBody></Table></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Todas as indicações</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente indicado cadastrado.</p> :
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>CNPJ</TableHead><TableHead>Responsável pela indicação</TableHead><TableHead>Contato</TableHead><TableHead>Cidade</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Comissão mensal</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><div className="font-medium">{row.nome}</div><div className="text-xs text-muted-foreground">{row.razao_social || '—'}</div></TableCell><TableCell className="whitespace-nowrap">{row.cnpj || '—'}</TableCell><TableCell>{profiles[row.user_id]?.display_name || profiles[row.user_id]?.email || 'Usuário de Atendimento'}</TableCell><TableCell><div>{row.telefone || '—'}</div><div className="text-xs text-muted-foreground">{row.email || ''}</div></TableCell><TableCell>{row.cidade || '—'}</TableCell><TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleDateString('pt-BR')}</TableCell><TableCell className="text-right font-semibold">{currency(valor)}</TableCell></TableRow>)}</TableBody></Table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
