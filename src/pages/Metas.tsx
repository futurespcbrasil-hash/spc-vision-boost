import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Save, TrendingUp, DollarSign, Wallet, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const PONTO_ZERO = 40889.37;
const SALARIO_DEFAULT = 2800;
const MESES = [
  'ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO',
  'JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO',
  'OUTUBRO','NOVEMBRO','DEZEMBRO',
];

type Row = {
  id?: string;
  ordem: number;
  referencia: string;
  ponto_zero: number;
  faturamento: number | null;
  salario: number;
  dirty?: boolean;
};

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const calcRow = (r: Row) => {
  const fat = r.faturamento ?? 0;
  const crescimento = r.ponto_zero ? (fat - r.ponto_zero) / r.ponto_zero : 0;
  const comissao = crescimento * r.salario;
  const valorReceber = r.salario + comissao;
  return { crescimento, comissao, valorReceber };
};

const Metas = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('metas_faturamento')
        .select('*')
        .eq('user_id', user.id)
        .order('ordem');
      const base: Row[] = MESES.map((m, i) => {
        const found = data?.find(d => d.ordem === i);
        return found
          ? {
              id: found.id, ordem: i, referencia: m,
              ponto_zero: Number(found.ponto_zero),
              faturamento: found.faturamento != null ? Number(found.faturamento) : null,
              salario: Number(found.salario),
            }
          : { ordem: i, referencia: m, ponto_zero: PONTO_ZERO, faturamento: null, salario: SALARIO_DEFAULT };
      });
      setRows(base);
      setLoading(false);
    })();
  }, [user]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(r => r.map((x, idx) => idx === i ? { ...x, ...patch, dirty: true } : x));

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    const dirty = rows.filter(r => r.dirty);
    const payload = dirty.map(r => ({
      id: r.id, user_id: user.id, ordem: r.ordem, referencia: r.referencia,
      ponto_zero: PONTO_ZERO, faturamento: r.faturamento, salario: r.salario,
    }));
    const { error } = await supabase.from('metas_faturamento').upsert(payload, { onConflict: 'user_id,ordem' });
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      toast.success('Metas salvas');
      const { data } = await supabase.from('metas_faturamento').select('*').eq('user_id', user.id).order('ordem');
      setRows(rs => rs.map(r => {
        const f = data?.find(d => d.ordem === r.ordem);
        return f ? { ...r, id: f.id, dirty: false } : { ...r, dirty: false };
      }));
    }
    setSaving(false);
  };

  const totals = useMemo(() => {
    const filled = rows.filter(r => r.faturamento != null);
    const totFat = filled.reduce((s, r) => s + (r.faturamento ?? 0), 0);
    const totReceber = filled.reduce((s, r) => s + calcRow(r).valorReceber, 0);
    const totComissao = filled.reduce((s, r) => s + calcRow(r).comissao, 0);
    return { totFat, totReceber, totComissao, meses: filled.length };
  }, [rows]);

  const chartData = rows.map(r => {
    const c = calcRow(r);
    return {
      mes: r.referencia.slice(0,3),
      Faturamento: r.faturamento ?? 0,
      'Ponto Zero': r.ponto_zero,
      Comissão: c.comissao,
      'Valor a Receber': c.valorReceber,
      hasData: r.faturamento != null,
    };
  });

  const hasDirty = rows.some(r => r.dirty);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando metas...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 lg:pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="text-primary" /> Metas & Faturamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle de faturamento, comissão e valor a receber.
          </p>
        </div>
        <Button onClick={saveAll} disabled={!hasDirty || saving} className="gap-2">
          <Save size={16} /> {saving ? 'Salvando...' : hasDirty ? 'Salvar alterações' : 'Tudo salvo'}
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={12}/> Ponto Zero</div>
          <div className="text-lg font-bold text-foreground">{fmt(PONTO_ZERO)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign size={12}/> Faturamento total</div>
          <div className="text-lg font-bold text-foreground">{fmt(totals.totFat)}</div>
          <div className="text-[10px] text-muted-foreground">{totals.meses} mês(es) lançado(s)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp size={12}/> Comissão acumulada</div>
          <div className={`text-lg font-bold ${totals.totComissao >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(totals.totComissao)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet size={12}/> Valor a receber</div>
          <div className="text-lg font-bold text-primary">{fmt(totals.totReceber)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-2">Faturamento vs Ponto Zero</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="Ponto Zero" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-2">Comissão & Valor a Receber</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Comissão" fill="hsl(var(--accent))" />
                <Bar dataKey="Valor a Receber" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Lançamentos mensais</h3>
          {hasDirty && <span className="text-xs text-amber-600">⚠ Alterações não salvas — preview ativo</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Referência</th>
                <th className="p-2 text-right">Ponto Zero</th>
                <th className="p-2 text-right">Faturamento</th>
                <th className="p-2 text-right">Crescimento %</th>
                <th className="p-2 text-right">Salário</th>
                <th className="p-2 text-right">Comissão</th>
                <th className="p-2 text-right">Valor a Receber</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = calcRow(r);
                return (
                  <tr key={i} className={`border-t border-border ${r.dirty ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                    <td className="p-2 font-medium text-foreground">{r.referencia}</td>
                    <td className="p-2 text-right text-muted-foreground flex items-center justify-end gap-1">
                      <Lock size={10} /> {fmt(r.ponto_zero)}
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number" step="0.01"
                        value={r.faturamento ?? ''}
                        onChange={(e) => update(i, { faturamento: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="0,00"
                        className="h-8 text-right w-32 ml-auto"
                      />
                    </td>
                    <td className={`p-2 text-right font-semibold ${c.crescimento > 0 ? 'text-green-600' : c.crescimento < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {r.faturamento != null ? pct(c.crescimento) : '—'}
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number" step="0.01"
                        value={r.salario}
                        onChange={(e) => update(i, { salario: Number(e.target.value) || 0 })}
                        className="h-8 text-right w-24 ml-auto"
                      />
                    </td>
                    <td className={`p-2 text-right font-medium ${c.comissao > 0 ? 'text-green-600' : c.comissao < 0 ? 'text-destructive' : ''}`}>
                      {r.faturamento != null ? fmt(c.comissao) : '—'}
                    </td>
                    <td className="p-2 text-right font-bold text-primary">
                      {r.faturamento != null ? fmt(c.valorReceber) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 bg-muted/30">
        <h4 className="font-semibold text-foreground mb-2">Regras aplicadas</h4>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>O <b>Ponto Zero</b> é base fixa de cálculo da comissão ({fmt(PONTO_ZERO)}).</li>
          <li>Crescimento % = (Faturamento − Ponto Zero) / Ponto Zero.</li>
          <li>Crescimento positivo aumenta a comissão pelo % aplicado sobre o salário vigente.</li>
          <li>Crescimento 0%: comissão permanece igual à anterior.</li>
          <li>Queda: percentual negativo é descontado apenas da comissão, sem reduzir o salário.</li>
          <li>Valor a Receber = Salário fixo + Comissão vigente.</li>
        </ol>
      </Card>
    </div>
  );
};

export default Metas;
