import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Handshake, Building2, DollarSign, TrendingUp } from 'lucide-react';

const fmt = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ParceirosDashboard = () => {
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [indicados, setIndicados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        supabase.from('parceiros_spc').select('*'),
        supabase.from('clientes_indicados').select('*'),
      ]);
      setParceiros(p.data ?? []);
      setIndicados(c.data ?? []);
      setLoading(false);
    })();
  }, []);

  const ativos = parceiros.filter((p) => p.status === 'ativo').length;
  const totalVendas = indicados.reduce((s, i) => s + Number(i.valor_venda || 0), 0);
  const totalComissao = indicados.reduce((s, i) => s + Number(i.comissao_gerada || 0), 0);

  const ranking = parceiros
    .map((p) => {
      const meus = indicados.filter((i) => i.parceiro_id === p.id);
      return {
        ...p,
        qtdClientes: meus.length,
        valorGerado: meus.reduce((s, i) => s + Number(i.valor_venda || 0), 0),
        comissaoGerada: meus.reduce((s, i) => s + Number(i.comissao_gerada || 0), 0),
      };
    })
    .sort((a, b) => b.valorGerado - a.valorGerado);

  const cards = [
    { label: 'Parceiros Ativos', value: ativos, icon: Handshake, color: 'text-primary' },
    { label: 'Clientes Indicados', value: indicados.length, icon: Building2, color: 'text-blue-500' },
    { label: 'Valor Total em Vendas', value: fmt(totalVendas), icon: DollarSign, color: 'text-green-500' },
    { label: 'Comissões Geradas', value: fmt(totalComissao), icon: TrendingUp, color: 'text-amber-500' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard - Parceiros SPC</h1>
        <p className="text-muted-foreground text-sm">Visão geral dos parceiros e clientes indicados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</div>
              <div className="text-2xl font-bold mt-1 text-foreground">{c.value}</div>
            </div>
            <c.icon className={`h-9 w-9 ${c.color}`} />
          </Card>
        ))}
      </div>

      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Ranking de Parceiros</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">Clientes Indicados</TableHead>
                <TableHead className="text-right">Valor Gerado</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : ranking.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum parceiro cadastrado</TableCell></TableRow>
              ) : ranking.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{p.nome_fantasia || p.razao_social}</TableCell>
                  <TableCell className="text-right">{p.qtdClientes}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.valorGerado)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(p.comissaoGerada)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ParceirosDashboard;
