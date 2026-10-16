import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, DollarSign, Loader2, RefreshCw, Save, Users, Building2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
type Profile = { user_id: string; display_name?: string | null; email?: string | null };

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
};
const monthLabel = (value: string) => value ? value.split('-').reverse().join('/') : '—';

export default function ComissoesIndicacoesSistema() {
  const { role, canManageUsers } = useAuth();
  const [rows, setRows] = useState<Indicacao[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [valorMensal, setValorMensal] = useState('10.00');
  const [valorInput, setValorInput] = useState('10,00');
  const [competencia, setCompetencia] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [indicacoesResult, configResult, profilesResult] = await Promise.all([
      (supabase as any).from('atendimento_indicacoes').select('id,user_id,nome,razao_social,cnpj,responsavel,telefone,email,cidade,created_at').order('created_at', { ascending: false }),
      (supabase as any).from('atendimento_comissao_config').select('valor_mensal').eq('id', 1).maybeSingle(),
      // A relação correta é profiles.user_id -> auth.users.id; profiles.id não é o ID do usuário autenticado.
      (supabase as any).from('profiles').select('user_id,display_name,email'),
    ]);
    if (indicacoesResult.error) toast.error('Erro ao carregar indicações: ' + indicacoesResult.error.message);
    else setRows((indicacoesResult.data ?? []) as Indicacao[]);
    if (configResult.error) toast.error('Erro ao carregar o valor da comissão: ' + configResult.error.message);
    else if (configResult.data) {
      const value = Number(configResult.data.valor_mensal ?? 10);
      setValorMensal(value.toFixed(2));
      setValorInput(value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    if (profilesResult.error) {
      toast.error('Não foi possível carregar os nomes dos usuários: ' + profilesResult.error.message);
    } else if (profilesResult.data) {
      setProfiles(Object.fromEntries((profilesResult.data as Profile[]).map(p => [p.user_id, p])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getAttendantName = useCallback((userId: string) => {
    const profile = profiles[userId];
    return profile?.display_name?.trim() || profile?.email?.trim() || 'Nome não encontrado';
  }, [profiles]);

  const valor = Number(valorMensal);
  // Para uma competência passada, não incluir indicações que só foram cadastradas depois daquele mês.
  const competenciaRows = useMemo(
    () => rows.filter(row => !competencia || row.created_at.slice(0, 7) <= competencia),
    [rows, competencia],
  );
  const porAtendimento = useMemo(() => {
    const grouped = new Map<string, { userId: string; nome: string; quantidade: number; total: number }>();
    competenciaRows.forEach(row => {
      const current = grouped.get(row.user_id) ?? { userId: row.user_id, nome: getAttendantName(row.user_id), quantidade: 0, total: 0 };
      current.quantidade += 1;
      current.total += valor;
      grouped.set(row.user_id, current);
    });
    return [...grouped.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [competenciaRows, getAttendantName, valor]);

  const totalMensal = competenciaRows.length * valor;

  const saveConfig = async () => {
    const parsed = Number(valorInput.replace(/\\./g, '').replace(',', '.'));
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

  const exportPdf = () => {
    if (!competenciaRows.length) {
      toast.error('Não há indicações para exportar nesta competência.');
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      // Cabeçalho corporativo, preparado para ser repetido nas páginas.
      const drawHeader = () => {
        doc.setFillColor(35, 28, 84);
        doc.rect(0, 0, pageWidth, 37, 'F');
        doc.setFillColor(119, 75, 190);
        doc.rect(0, 35, pageWidth, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('FUTURE SOLUÇÕES', 14, 15);
        doc.setFontSize(12);
        doc.text('RELATÓRIO DE COMISSÕES', 14, 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Indicações — Sistema de Notas | Atendimento', 14, 31);
        doc.setFontSize(10);
        doc.text('Competência: ' + monthLabel(competencia), pageWidth - 14, 17, { align: 'right' });
        doc.text('Emitido em: ' + new Date().toLocaleDateString('pt-BR'), pageWidth - 14, 25, { align: 'right' });
      };
      drawHeader();

      doc.setTextColor(48, 48, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('RESUMO DA COMPETÊNCIA', 14, 47);
      autoTable(doc, {
        startY: 51,
        head: [['Clientes considerados', 'Atendimentos com indicações', 'Comissão por cliente / mês', 'Total mensal previsto']],
        body: [[String(competenciaRows.length), String(porAtendimento.length), currency(valor), currency(totalMensal)]],
        theme: 'grid',
        margin: { left: 14, right: 14 },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [48, 48, 60], lineColor: [225, 225, 235] },
        headStyles: { fillColor: [239, 235, 250], textColor: [49, 36, 95], fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'bold', minCellHeight: 10 },
      });

      let y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(48, 48, 60);
      doc.text('COMISSÃO POR USUÁRIO DE ATENDIMENTO', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Usuário de Atendimento', 'Clientes indicados', 'Comissão mensal']],
        body: porAtendimento.map(item => [item.nome, String(item.quantidade), currency(item.total)]),
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: [48, 48, 60], lineColor: [230, 228, 238] },
        headStyles: { fillColor: [49, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 247, 252] },
        columnStyles: { 1: { halign: 'right', cellWidth: 45 }, 2: { halign: 'right', cellWidth: 48 } },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
      if (y > pageHeight - 35) { doc.addPage(); drawHeader(); y = 47; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(48, 48, 60);
      doc.text('DETALHAMENTO DOS CLIENTES INDICADOS', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Cliente / Razão social', 'CNPJ', 'Indicado por', 'Responsável do cliente', 'Telefone / e-mail', 'Cidade', 'Data da indicação', 'Comissão mensal']],
        body: competenciaRows.map(row => [
          [row.nome, row.razao_social || ''].filter(Boolean).join('\\n'),
          row.cnpj || '—',
          getAttendantName(row.user_id),
          row.responsavel || '—',
          [row.telefone, row.email].filter(Boolean).join('\\n') || '—',
          row.cidade || '—',
          formatDate(row.created_at),
          currency(valor),
        ]),
        theme: 'striped',
        margin: { left: 10, right: 10, top: 43, bottom: 17 },
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak', textColor: [48, 48, 60], lineColor: [230, 228, 238], valign: 'middle' },
        headStyles: { fillColor: [49, 39, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
        alternateRowStyles: { fillColor: [248, 247, 252] },
        columnStyles: {
          0: { cellWidth: 43 }, 1: { cellWidth: 27 }, 2: { cellWidth: 31 },
          3: { cellWidth: 29 }, 4: { cellWidth: 42 }, 5: { cellWidth: 25 },
          6: { cellWidth: 26 }, 7: { cellWidth: 27, halign: 'right' },
        },
        didDrawPage: () => {
          if (doc.getNumberOfPages() > 1) drawHeader();
          doc.setDrawColor(225, 225, 235);
          doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(110, 110, 125);
          doc.text('Future Soluções • Relatório de uso interno', 10, pageHeight - 6);
          doc.text('Página ' + doc.getCurrentPageInfo().pageNumber, pageWidth - 10, pageHeight - 6, { align: 'right' });
        },
      });

      const safeMonth = competencia || currentMonth();
      doc.save('Future-Solucoes-Comissoes-Atendimento-' + safeMonth + '.pdf');
      toast.success('Relatório PDF gerado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar relatório de comissões em PDF:', error);
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  if (role !== 'gestor' && !canManageUsers) return <div className="p-6"><Card><CardContent className="py-10 text-center">Acesso restrito ao perfil Gestor.</CardContent></Card></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indicações — Sistema de Notas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe os clientes indicados pelo Atendimento e o valor mensal previsto de comissão.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={loading || exporting || competenciaRows.length === 0}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
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
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Clientes indicados ({monthLabel(competencia)})</p><p className="text-2xl font-bold">{competenciaRows.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Atendimentos com indicações</p><p className="text-2xl font-bold">{porAtendimento.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><DollarSign className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Total mensal previsto</p><p className="text-2xl font-bold">{currency(totalMensal)}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-lg">Resumo por Atendimento</CardTitle><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><Label htmlFor="competencia" className="whitespace-nowrap">Competência</Label><Input id="competencia" type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="w-44" /></div></div></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Competência selecionada: {monthLabel(competencia)}. O resumo considera as indicações registradas até o mês selecionado e aplica o valor mensal configurado.</p>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : porAtendimento.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma indicação cadastrada para esta competência.</p> :
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuário de Atendimento</TableHead><TableHead className="text-right">Clientes indicados</TableHead><TableHead className="text-right">Comissão mensal</TableHead></TableRow></TableHeader><TableBody>{porAtendimento.map(item => <TableRow key={item.userId}><TableCell className="font-medium">{item.nome}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right font-semibold">{currency(item.total)}</TableCell></TableRow>)}</TableBody></Table></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Todas as indicações da competência</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : competenciaRows.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente indicado cadastrado para esta competência.</p> :
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>CNPJ</TableHead><TableHead>Responsável pela indicação</TableHead><TableHead>Contato</TableHead><TableHead>Cidade</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Comissão mensal</TableHead></TableRow></TableHeader><TableBody>{competenciaRows.map(row => <TableRow key={row.id}><TableCell><div className="font-medium">{row.nome}</div><div className="text-xs text-muted-foreground">{row.razao_social || '—'}</div></TableCell><TableCell className="whitespace-nowrap">{row.cnpj || '—'}</TableCell><TableCell>{getAttendantName(row.user_id)}</TableCell><TableCell><div>{row.telefone || '—'}</div><div className="text-xs text-muted-foreground">{row.email || ''}</div></TableCell><TableCell>{row.cidade || '—'}</TableCell><TableCell className="whitespace-nowrap">{formatDate(row.created_at)}</TableCell><TableCell className="text-right font-semibold">{currency(valor)}</TableCell></TableRow>)}</TableBody></Table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
