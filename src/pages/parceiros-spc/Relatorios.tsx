import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileSpreadsheet, FileBarChart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

const PRODUTOS = ['SPC Brasil', 'Certificado Digital', 'Emissor de Notas', 'Outro'];

const Relatorios = () => {
  const [indicados, setIndicados] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [parceiroId, setParceiroId] = useState<string>('todos');
  const [produto, setProduto] = useState<string>('todos');

  useEffect(() => {
    (async () => {
      const [c, p, v] = await Promise.all([
        supabase.from('clientes_indicados').select('*').order('data_indicacao', { ascending: false }),
        supabase.from('parceiros_spc').select('id, razao_social, nome_fantasia, percentual_comissao'),
        supabase.from('vendas_indicadas').select('*').order('data_venda', { ascending: false }),
      ]);
      setIndicados(c.data ?? []);
      setParceiros(p.data ?? []);
      setVendas(v.data ?? []);
      setLoading(false);
    })();
  }, []);

  const parceiroMap = useMemo(() => Object.fromEntries(parceiros.map((p) => [p.id, p])), [parceiros]);
  const clienteMap = useMemo(() => Object.fromEntries(indicados.map((i) => [i.id, i])), [indicados]);

  // Cada linha do relatório = uma venda mensal
  const filtrados = useMemo(() => {
    return vendas.map((v) => {
      const cli = clienteMap[v.cliente_indicado_id];
      const p = cli ? parceiroMap[cli.parceiro_id] : null;
      const pct = p ? Number(p.percentual_comissao || 0) : 0;
      const valor = Number(v.valor || 0);
      return {
        id: v.id,
        cliente: cli,
        parceiro: p,
        parceiro_id: cli?.parceiro_id,
        produto_vendido: cli?.produto_vendido,
        data: v.data_venda,
        valor,
        comissao: +(valor * pct / 100).toFixed(2),
      };
    }).filter((r) => {
      if (!r.cliente) return false;
      if (dataIni && r.data < dataIni) return false;
      if (dataFim && r.data > dataFim) return false;
      if (parceiroId !== 'todos' && r.parceiro_id !== parceiroId) return false;
      if (produto !== 'todos' && r.produto_vendido !== produto) return false;
      return true;
    });
  }, [vendas, clienteMap, parceiroMap, dataIni, dataFim, parceiroId, produto]);

  const totalQtd = filtrados.length;
  const totalVenda = filtrados.reduce((s, r) => s + r.valor, 0);
  const totalComissao = filtrados.reduce((s, r) => s + r.comissao, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório - Parceiros SPC', 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${dataIni || '-'} a ${dataFim || '-'}`, 14, 26);
    doc.text(`Total: ${totalQtd} indicações | Vendas: ${fmt(totalVenda)} | Comissão: ${fmt(totalComissao)}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [['Cliente', 'Parceiro', 'Produto', 'Data', 'Valor', 'Comissão']],
      body: filtrados.map((r) => [
        r.cliente?.nome_fantasia || r.cliente?.razao_social || '-',
        r.parceiro ? (r.parceiro.nome_fantasia || r.parceiro.razao_social) : '-',
        r.produto_vendido || '-',
        fmtDate(r.data),
        fmt(r.valor),
        fmt(r.comissao),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [109, 40, 217] },
    });
    doc.save(`parceiros-spc-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportExcel = () => {
    const rows = filtrados.map((r) => ({
      Cliente: r.cliente?.nome_fantasia || r.cliente?.razao_social || '',
      CNPJ: r.cliente?.cnpj || '',
      Parceiro: r.parceiro ? (r.parceiro.nome_fantasia || r.parceiro.razao_social) : '',
      Produto: r.produto_vendido || '',
      Data: fmtDate(r.data),
      Valor: r.valor,
      Comissao: r.comissao,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    XLSX.writeFile(wb, `parceiros-spc-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileBarChart className="text-primary" /> Relatórios</h1>
        <p className="text-muted-foreground text-sm">Filtre e exporte os dados de parceiros e indicações</p>
      </div>

      <Card className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Data Inicial</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Data Final</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Parceiro</Label>
            <Select value={parceiroId} onValueChange={setParceiroId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {parceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_fantasia || p.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {PRODUTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">Indicações</div>
            <div className="text-2xl font-bold">{totalQtd}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">Valor Total Vendido</div>
            <div className="text-2xl font-bold text-primary">{fmt(totalVenda)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">Comissão Total</div>
            <div className="text-2xl font-bold text-green-600">{fmt(totalComissao)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={exportPDF} variant="outline"><FileText size={16} /> Exportar PDF</Button>
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet size={16} /> Exportar Excel</Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : filtrados.map((r) => {
                const p = parceiroMap[r.parceiro_id];
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.nome_fantasia || r.razao_social}</TableCell>
                    <TableCell>{p ? (p.nome_fantasia || p.razao_social) : '-'}</TableCell>
                    <TableCell>{r.produto_vendido || '-'}</TableCell>
                    <TableCell>{fmtDate(r.data_indicacao)}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.valor_venda))}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(Number(r.comissao_gerada))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default Relatorios;
