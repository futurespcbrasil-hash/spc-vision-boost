import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Handshake, CheckCircle2, TrendingUp, AlertTriangle, DollarSign, Activity, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['hsl(262,70%,50%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(280,50%,55%)', 'hsl(199,80%,45%)'];

interface VendorPerformance {
  name: string;
  email: string;
  user_id: string;
  total: number;
  contato: number;
  negociacao: number;
  vendas: number;
  taxa: string;
}

const GestorDashboard = () => {
  const { profile } = useAuth();
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [leadsRes, eventsRes, profilesRes] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('schedule_events').select('*'),
        supabase.from('profiles').select('*'),
      ]);
      setAllLeads(leadsRes.data || []);
      setAllEvents(eventsRes.data || []);
      setProfiles(profilesRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const totalLeads = allLeads.length;
  const emNegociacao = allLeads.filter(l => l.status === 'em_negociacao').length;
  const vendasFechadas = allLeads.filter(l => l.status === 'venda_ganha').length;
  const taxaConversao = totalLeads > 0 ? ((vendasFechadas / totalLeads) * 100).toFixed(1) : '0';

  // Performance by vendor
  const vendorMap = new Map<string, VendorPerformance>();
  allLeads.forEach(lead => {
    const uid = lead.user_id || 'sem_usuario';
    if (!vendorMap.has(uid)) {
      const p = profiles.find(pr => pr.user_id === uid);
      vendorMap.set(uid, {
        name: p?.display_name || 'Sem vendedor',
        email: p?.email || '',
        user_id: uid,
        total: 0, contato: 0, negociacao: 0, vendas: 0, taxa: '0',
      });
    }
    const v = vendorMap.get(uid)!;
    v.total++;
    if (['contato_realizado', 'comparacao_enviada', 'em_negociacao', 'fechamento', 'venda_ganha'].includes(lead.status)) v.contato++;
    if (lead.status === 'em_negociacao' || lead.status === 'fechamento') v.negociacao++;
    if (lead.status === 'venda_ganha') v.vendas++;
  });
  const vendorPerf = Array.from(vendorMap.values()).map(v => ({
    ...v,
    taxa: v.total > 0 ? ((v.vendas / v.total) * 100).toFixed(1) : '0',
  }));

  // Funnel data
  const funnelData = [
    { name: 'Lead Novo', value: allLeads.filter(l => l.status === 'lead_novo').length },
    { name: 'Contato', value: allLeads.filter(l => l.status === 'contato_realizado').length },
    { name: 'Comparação', value: allLeads.filter(l => l.status === 'comparacao_enviada').length },
    { name: 'Negociação', value: emNegociacao },
    { name: 'Fechamento', value: allLeads.filter(l => l.status === 'fechamento').length },
    { name: 'Venda', value: vendasFechadas },
  ];

  // Alerts
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysStr = twoDaysAgo.toISOString();
  const leadsWithoutContact = allLeads.filter(l => l.status === 'lead_novo' && l.updated_at < twoDaysStr);
  const stuckNegotiations = allLeads.filter(l => l.status === 'em_negociacao' && l.updated_at < twoDaysStr);
  const forgottenLeads = allLeads.filter(l => ['lead_novo', 'contato_realizado'].includes(l.status) && l.updated_at < twoDaysStr);

  // Revenue forecast (mock based on negotiation leads)
  const potentialRevenue = (emNegociacao + allLeads.filter(l => l.status === 'fechamento').length) * 500;

  // Activity log
  const recentLeads = [...allLeads].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);

  // Insights
  const insights: string[] = [];
  if (parseFloat(taxaConversao) < 10) insights.push('A taxa de conversão está abaixo de 10% — considere revisar a abordagem comercial');
  if (leadsWithoutContact.length > 3) insights.push(`${leadsWithoutContact.length} leads estão sem contato há mais de 2 dias`);
  const bestVendor = vendorPerf.reduce((best, v) => parseFloat(v.taxa) > parseFloat(best.taxa) ? v : best, vendorPerf[0]);
  if (bestVendor && parseFloat(bestVendor.taxa) > 0) insights.push(`${bestVendor.name} está com o melhor desempenho (${bestVendor.taxa}% de conversão)`);
  if (funnelData[3].value > funnelData[4].value * 2) insights.push('Leads estão parando na etapa de negociação');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Gestor</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe o desempenho da equipe e identifique oportunidades de crescimento</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Leads Totais" value={totalLeads} desc="Total de oportunidades geradas pela equipe" color="text-primary" />
        <StatCard icon={Handshake} label="Em Negociação" value={emNegociacao} desc="Leads em fase ativa de fechamento" color="text-accent" />
        <StatCard icon={CheckCircle2} label="Vendas Fechadas" value={vendasFechadas} desc="Negócios concluídos com sucesso" color="text-success" />
        <StatCard icon={TrendingUp} label="Taxa de Conversão" value={`${taxaConversao}%`} desc="Percentual de leads convertidos em vendas" color="text-warning" />
      </div>

      {/* Team Performance Table */}
      <div className="stat-card">
        <h3 className="font-semibold text-foreground mb-1">👥 Desempenho da equipe</h3>
        <p className="text-xs text-muted-foreground mb-4">Veja quem está performando melhor e onde melhorar</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Nome</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Leads</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Contatos</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Negociação</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Vendas</th>
                <th className="text-center py-2 text-muted-foreground font-medium">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {vendorPerf.map(v => (
                <tr key={v.user_id} className="border-b border-border/50 hover:bg-muted/50 transition">
                  <td className="py-2.5 font-medium text-foreground">{v.name || v.email}</td>
                  <td className="py-2.5 text-center text-foreground">{v.total}</td>
                  <td className="py-2.5 text-center text-foreground">{v.contato}</td>
                  <td className="py-2.5 text-center text-foreground">{v.negociacao}</td>
                  <td className="py-2.5 text-center text-foreground">{v.vendas}</td>
                  <td className="py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${parseFloat(v.taxa) >= 20 ? 'bg-success/10 text-success' : parseFloat(v.taxa) >= 10 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {v.taxa}%
                    </span>
                  </td>
                </tr>
              ))}
              {vendorPerf.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhum dado disponível</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Chart */}
        <div className="stat-card">
          <h3 className="font-semibold text-foreground mb-1">📈 Visão geral do funil</h3>
          <p className="text-xs text-muted-foreground mb-4">Entenda em qual etapa os leads estão travando</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(262,70%,50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Forecast */}
        <div className="stat-card flex flex-col">
          <h3 className="font-semibold text-foreground mb-1">💰 Previsão de faturamento</h3>
          <p className="text-xs text-muted-foreground mb-4">Baseado nos leads em negociação</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DollarSign size={40} className="text-success mx-auto mb-2" />
              <div className="text-3xl font-bold text-foreground">R$ {potentialRevenue.toLocaleString('pt-BR')}</div>
              <p className="text-sm text-muted-foreground mt-1">Potencial de fechamento atual</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(leadsWithoutContact.length > 0 || stuckNegotiations.length > 0 || forgottenLeads.length > 0) && (
        <div className="stat-card border-warning/30">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" /> Atenção necessária
          </h3>
          <div className="space-y-2">
            {leadsWithoutContact.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5">
                <span className="text-warning text-sm">⚠️</span>
                <span className="text-sm text-foreground">{leadsWithoutContact.length} leads sem contato há mais de 2 dias</span>
              </div>
            )}
            {stuckNegotiations.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5">
                <span className="text-warning text-sm">⚠️</span>
                <span className="text-sm text-foreground">{stuckNegotiations.length} negociações paradas</span>
              </div>
            )}
            {forgottenLeads.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5">
                <span className="text-destructive text-sm">🚨</span>
                <span className="text-sm text-foreground">{forgottenLeads.length} leads esquecidos — isso pode impactar suas vendas</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="stat-card">
        <h3 className="font-semibold text-foreground mb-1">📋 Atividades da equipe</h3>
        <p className="text-xs text-muted-foreground mb-3">Acompanhe tudo o que está sendo feito em tempo real</p>
        <div className="space-y-2">
          {recentLeads.map(lead => {
            const p = profiles.find(pr => pr.user_id === lead.user_id);
            const vendorName = p?.display_name || 'Vendedor';
            const statusLabel: Record<string, string> = {
              lead_novo: 'criou um novo lead',
              contato_realizado: 'realizou contato com cliente',
              comparacao_enviada: 'enviou comparação',
              em_negociacao: 'moveu lead para negociação',
              fechamento: 'avançou para fechamento',
              venda_ganha: 'fechou uma venda',
              venda_perdida: 'perdeu uma venda',
            };
            return (
              <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition">
                <Activity size={14} className="text-primary shrink-0" />
                <span className="text-sm text-foreground">
                  <strong>{vendorName}</strong> {statusLabel[lead.status] || `atualizou lead`}
                </span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{lead.name}</span>
              </div>
            );
          })}
          {recentLeads.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-primary" /> 🎯 Insights do sistema
          </h3>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5">
                <span className="text-primary text-sm">💡</span>
                <span className="text-sm text-foreground">{insight}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">Dados atualizados em tempo real • Oportunidades identificadas automaticamente</p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, desc, color }: { icon: any; label: string; value: any; desc: string; color: string }) => (
  <div className="stat-card">
    <div className="flex items-center justify-between mb-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <Icon size={20} className={color} />
    </div>
    <div className="text-3xl font-bold text-foreground">{value}</div>
    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
  </div>
);

export default GestorDashboard;
