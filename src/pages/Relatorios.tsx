import { useState, useRef } from 'react';
import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES } from '@/data/spcData';
import { FileDown, BarChart3, Users, Calendar, TrendingUp, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const CHART_COLORS = [
  'hsl(211, 85%, 42%)', 'hsl(152, 60%, 40%)', 'hsl(38, 92%, 50%)',
  'hsl(270, 50%, 45%)', 'hsl(0, 65%, 55%)', 'hsl(199, 80%, 45%)',
  'hsl(30, 80%, 50%)', 'hsl(190, 70%, 40%)', 'hsl(220, 15%, 60%)',
];

const Relatorios = () => {
  const { leads, schedule } = useAppState();
  const chartsRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // Data for charts
  const funnelData = KANBAN_STAGES.map((stage, i) => ({
    name: stage.label,
    leads: leads.filter(l => l.status === stage.key).length,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const typeData = [
    { name: 'PF', value: leads.filter(l => l.type === 'PF').length },
    { name: 'PJ', value: leads.filter(l => l.type === 'PJ').length },
  ];

  const originData = leads.reduce((acc, l) => {
    const origin = l.origin || 'Sem origem';
    acc[origin] = (acc[origin] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const originChartData = Object.entries(originData).map(([name, value]) => ({ name, value }));

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = schedule.filter(e => e.date === todayStr);
  const doneEvents = schedule.filter(e => e.done);
  const pendingEvents = schedule.filter(e => !e.done);

  const wonLeads = leads.filter(l => l.status === 'venda_ganha').length;
  const lostLeads = leads.filter(l => l.status === 'venda_perdida').length;
  const conversionRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0';

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const now = new Date();
      
      // Header
      pdf.setFillColor(26, 62, 107);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.text('Relatório Completo - SPC Vendas', 14, 18);
      pdf.setFontSize(10);
      pdf.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 28);

      // KPIs
      pdf.setTextColor(0, 0, 0);
      let y = 45;
      pdf.setFontSize(14);
      pdf.text('Indicadores Gerais', 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [['Métrica', 'Valor']],
        body: [
          ['Total de Leads', String(leads.length)],
          ['Vendas Ganhas', String(wonLeads)],
          ['Vendas Perdidas', String(lostLeads)],
          ['Taxa de Conversão', `${conversionRate}%`],
          ['Eventos Agenda (Total)', String(schedule.length)],
          ['Eventos Concluídos', String(doneEvents.length)],
          ['Eventos Pendentes', String(pendingEvents.length)],
          ['Compromissos Hoje', String(todayEvents.length)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [26, 62, 107] },
      });

      y = (pdf as any).lastAutoTable.finalY + 15;

      // Funil
      pdf.setFontSize(14);
      pdf.text('Funil de Vendas', 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [['Etapa', 'Quantidade de Leads']],
        body: funnelData.map(d => [d.name, String(d.leads)]),
        theme: 'striped',
        headStyles: { fillColor: [26, 62, 107] },
      });

      y = (pdf as any).lastAutoTable.finalY + 15;

      // Leads table
      if (y > 230) { pdf.addPage(); y = 20; }
      pdf.setFontSize(14);
      pdf.text('Lista de Leads', 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [['Nome', 'Empresa', 'Tipo', 'Produto', 'Status', 'Origem']],
        body: leads.map(l => [
          l.name, l.company, l.type, l.product,
          KANBAN_STAGES.find(s => s.key === l.status)?.label || l.status,
          l.origin || '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [26, 62, 107] },
        styles: { fontSize: 8 },
      });

      y = (pdf as any).lastAutoTable.finalY + 15;

      // Agenda
      if (y > 230) { pdf.addPage(); y = 20; }
      pdf.setFontSize(14);
      pdf.text('Agenda de Compromissos', 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [['Lead', 'Data', 'Hora', 'Nota', 'Status']],
        body: schedule.map(e => [
          e.leadName, e.date, e.time, e.note || '—', e.done ? 'Concluído' : 'Pendente',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [26, 62, 107] },
        styles: { fontSize: 8 },
      });

      // Capture charts as image
      if (chartsRef.current) {
        const canvas = await html2canvas(chartsRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text('Gráficos', 14, 20);
        const imgWidth = pageWidth - 28;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 14, 30, imgWidth, Math.min(imgHeight, 240));
      }

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`SPC Brasil © ${now.getFullYear()} — Página ${i}/${totalPages}`, 14, pdf.internal.pageSize.getHeight() - 10);
      }

      pdf.save(`relatorio-spc-${todayStr}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão completa para o gestor avaliar a operação</p>
        </div>
        <button
          onClick={generatePDF}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          <FileDown size={16} />
          {generating ? 'Gerando...' : 'Exportar PDF Completo'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2"><Users size={16} /> Leads</div>
          <div className="text-2xl font-bold text-foreground">{leads.length}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2"><TrendingUp size={16} /> Conversão</div>
          <div className="text-2xl font-bold text-success">{conversionRate}%</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2"><BarChart3 size={16} /> Vendas Ganhas</div>
          <div className="text-2xl font-bold text-foreground">{wonLeads}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2"><Calendar size={16} /> Compromissos Hoje</div>
          <div className="text-2xl font-bold text-foreground">{todayEvents.length}</div>
        </div>
      </div>

      {/* Charts */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded-xl">
        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><BarChart3 size={16} /> Funil de Vendas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="leads" fill="hsl(211, 85%, 42%)" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><PieChart size={16} /> Tipo de Lead</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RPieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </RPieChart>
          </ResponsiveContainer>
        </div>

        {originChartData.length > 0 && (
          <div className="stat-card lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">📊 Leads por Origem</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={originChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Agenda summary */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">📅 Resumo da Agenda</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-foreground">{schedule.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">{doneEvents.length}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">{pendingEvents.length}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Relatorios;
