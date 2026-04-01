import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES } from '@/data/spcData';
import { Users, Phone, Send, Handshake, CheckCircle2, FileText, Link2, Plus, Calendar, TrendingUp, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useRef, useEffect } from 'react';

const STAT_ICONS: Record<string, any> = {
  lead_novo: Users,
  em_negociacao: Handshake,
  fechamento: TrendingUp,
  venda_ganha: CheckCircle2,
};

const PIE_COLORS = ['hsl(211,85%,42%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(270,50%,45%)', 'hsl(199,80%,45%)'];

const Dashboard = () => {
  const { leads, schedule } = useAppState();

  const counts = KANBAN_STAGES.reduce((acc, s) => {
    acc[s.key] = leads.filter(l => l.status === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { label: 'Leads Novos', value: counts.lead_novo, icon: Users, color: 'text-primary' },
    { label: 'Em Negociação', value: counts.em_negociacao, icon: Handshake, color: 'text-accent' },
    { label: 'Fechamento', value: counts.fechamento, icon: TrendingUp, color: 'text-warning' },
    { label: 'Vendas Ganhas', value: counts.venda_ganha, icon: CheckCircle2, color: 'text-success' },
  ];

  const funnelData = KANBAN_STAGES.slice(0, 5).map(s => ({
    name: s.label.split(' ').slice(0, 2).join(' '),
    value: counts[s.key],
  }));

  const productData = [
    { name: 'SPC Maxi', value: leads.filter(l => l.product.includes('Maxi')).length },
    { name: 'Completo PJ', value: leads.filter(l => l.product.includes('Completo')).length },
    { name: 'Positivo PJ', value: leads.filter(l => l.product.includes('Positivo')).length },
  ].filter(d => d.value > 0);

  const upcomingEvents = schedule
    .filter(e => !e.done)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 5);

  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do seu funil de vendas</p>
        </div>
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition"
          >
            <Bell size={18} />
            {upcomingEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {upcomingEvents.length}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 animate-slide-in">
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">📅 Próximos Compromissos</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Nenhum compromisso pendente</p>
                ) : (
                  upcomingEvents.map(e => (
                    <div key={e.id} className="px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{e.leadName}</span>
                        <span className="text-[10px] text-muted-foreground">{e.date}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground">{e.note || 'Sem nota'}</span>
                        <span className="text-xs text-primary font-medium">{e.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Link to="/agenda" className="block text-center text-xs text-primary font-medium py-2 hover:bg-muted/50 transition rounded-b-xl">
                Ver agenda completa →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">{s.label}</span>
              <s.icon size={20} className={s.color} />
            </div>
            <div className="text-3xl font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-foreground mb-4">Leads por Etapa do Funil</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(211,85%,42%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-semibold text-foreground mb-4">Produto Mais Vendido</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={productData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                {productData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's schedule */}
      {upcomingEvents.length > 0 && (
        <div className="stat-card">
          <h3 className="font-semibold text-foreground mb-3">📅 Próximos Compromissos</h3>
          <div className="space-y-2">
            {upcomingEvents.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-primary">{e.date} {e.time}</span>
                <span className="text-sm text-foreground">{e.leadName}</span>
                <span className="text-sm text-muted-foreground">— {e.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating action button */}
      <Link
        to="/leads"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition z-40"
        title="Novo Lead"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
};

export default Dashboard;
