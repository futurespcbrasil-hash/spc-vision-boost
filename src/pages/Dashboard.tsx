import { useAppState } from '@/context/AppContext';
import { KANBAN_STAGES } from '@/data/spcData';
import { Users, Phone, Send, Handshake, CheckCircle2, FileText, Link2, Plus, Calendar, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';


import { useAuth } from '@/hooks/useAuth';

type AttendanceAgendaItem = {
  id: string;
  title: string;
  start: string;
  end?: string;
  detail?: string;
  source: 'Agenda Vision' | 'Google Calendar';
  googleEventId?: string | null;
};


const cleanAgendaObservation = (value?: string | null): string => {
  if (!value) return '';
  const withBreaks = String(value)
    .replace(/\\(?=<\/?(?:br|p|div|li|ul|ol|strong|b|span|html)\b)/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(?:p|div|li|ul|ol|strong|b|span|html)\s*>/gi, '\n')
    .replace(/<\s*(?:p|div|li|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  const decoded = typeof document !== 'undefined'
    ? (() => {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = withBreaks;
        return textarea.value;
      })()
    : withBreaks.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  return decoded
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};


const AttendanceDashboard = () => {
  const { user } = useAuth();
  const { schedule } = useAppState();
  const [indicationsCount, setIndicationsCount] = useState(0);
  const [monthlyCommission, setMonthlyCommission] = useState(10);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [appEvents, setAppEvents] = useState<any[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  const todayKey = (() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  })();
  const dayBounds = useMemo(() => {
    const parts = todayKey.split('-').map(Number);
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const end = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setMetricsLoading(false);
      return;
    }
    const loadMetrics = async () => {
      setMetricsLoading(true);
      const [indicationsResult, commissionResult] = await Promise.all([
        (supabase as any).from('atendimento_indicacoes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        (supabase as any).from('atendimento_comissao_config')
          .select('valor_mensal')
          .eq('id', 1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (indicationsResult.error) {
        console.error('Erro ao carregar indicadores de indicações:', indicationsResult.error);
      } else {
        setIndicationsCount(indicationsResult.count ?? 0);
      }
      if (commissionResult.error) {
        console.error('Erro ao carregar configuração de comissão:', commissionResult.error);
      } else if (commissionResult.data?.valor_mensal != null) {
        setMonthlyCommission(Number(commissionResult.data.valor_mensal) || 0);
      }
      setMetricsLoading(false);
    };
    void loadMetrics();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadTodayAgenda = async () => {
      if (!user?.id) {
        setCalendarLoading(false);
        return;
      }
      setCalendarLoading(true);
      const [sessionResult, appResult] = await Promise.all([
        supabase.auth.getSession(),
        (supabase as any).from('events')
          .select('id,title,description,start_datetime,end_datetime,google_event_id,status')
          .eq('user_id', user.id)
          .gte('start_datetime', dayBounds.start)
          .lt('start_datetime', dayBounds.end)
          .order('start_datetime', { ascending: true }),
      ]);
      if (cancelled) return;
      if (appResult.error) {
        console.error('Erro ao carregar eventos da agenda:', appResult.error);
      } else {
        setAppEvents(appResult.data ?? []);
      }

      const session = sessionResult.data.session;
      if (!session) {
        setCalendarStatus('disconnected');
        setCalendarLoading(false);
        return;
      }

      try {
        const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
        const headers = {
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        const statusResponse = await fetch(
          'https://' + projectId + '.supabase.co/functions/v1/google-calendar?action=status',
          { headers }
        );
        const statusData = await statusResponse.json();
        if (!statusResponse.ok || !statusData.connected) {
          if (!cancelled) {
            setGoogleEvents([]);
            setCalendarStatus(statusResponse.ok ? 'disconnected' : 'error');
          }
          return;
        }

        const eventsResponse = await fetch(
          'https://' + projectId + '.supabase.co/functions/v1/google-calendar?action=events&timeMin=' +
          encodeURIComponent(dayBounds.start) + '&timeMax=' + encodeURIComponent(dayBounds.end),
          { headers }
        );
        const eventsData = await eventsResponse.json();
        if (!eventsResponse.ok) throw new Error(eventsData.error || 'Falha ao consultar Google Calendar');
        if (!cancelled) {
          setGoogleEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
          setCalendarStatus('connected');
        }
      } catch (error) {
        console.error('Erro ao carregar Google Calendar na dashboard:', error);
        if (!cancelled) {
          setGoogleEvents([]);
          setCalendarStatus('error');
        }
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    };
    void loadTodayAgenda();
    return () => { cancelled = true; };
  }, [user?.id, dayBounds.start, dayBounds.end]);

  const todaySchedule = useMemo(() => {
    const items: AttendanceAgendaItem[] = [];
    const appGoogleIds = new Set<string>();

    appEvents.forEach((event) => {
      if (event.google_event_id) appGoogleIds.add(String(event.google_event_id));
      items.push({
        id: 'app:' + event.id,
        title: event.title || 'Compromisso sem título',
        start: event.start_datetime,
        end: event.end_datetime,
        detail: cleanAgendaObservation(event.description || ''),
        source: 'Agenda Vision',
        googleEventId: event.google_event_id,
      });
    });

    schedule.filter((event) => event.date === todayKey && (!user?.id || event.userId === user.id)).forEach((event) => {
      const start = event.date + 'T' + (event.time || '00:00') + ':00';
      items.push({
        id: 'schedule:' + event.id,
        title: event.leadName || 'Compromisso',
        start,
        detail: cleanAgendaObservation(event.note || ''),
        source: 'Agenda Vision',
      });
    });

    googleEvents.forEach((event) => {
      const googleId = String(event.google_event_id || event.id || '');
      if (googleId && appGoogleIds.has(googleId)) return;
      const startValue = event.start?.dateTime || event.start?.date || event.start;
      if (!startValue) return;
      items.push({
        id: 'google:' + (event.id || googleId || startValue),
        title: event.summary || 'Compromisso sem título',
        start: startValue,
        end: event.end?.dateTime || event.end?.date || event.end,
        detail: cleanAgendaObservation([event.description, event.location].filter(Boolean).join('\n')),
        source: 'Google Calendar',
        googleEventId: googleId || null,
      });
    });

    return items
      .filter((item) => {
        const start = item.start.includes('T') ? new Date(item.start) : new Date(item.start + 'T00:00:00');
        const localKey = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-');
        return !Number.isNaN(start.getTime()) && localKey === todayKey;
      })
      .sort((a, b) => new Date(a.start.includes('T') ? a.start : a.start + 'T00:00:00').getTime() -
        new Date(b.start.includes('T') ? b.start : b.start + 'T00:00:00').getTime());
  }, [appEvents, googleEvents, schedule, todayKey, user?.id]);

  const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatTime = (value: string) => {
    if (!value.includes('T')) return 'Dia inteiro';
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  const nextAppointment = todaySchedule.find((event) => {
    const start = new Date(event.start.includes('T') ? event.start : event.start + 'T00:00:00');
    return start.getTime() >= Date.now();
  });

  return (
    <div className="space-y-7 animate-fade-in relative pb-20">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Suas indicações, comissões e compromissos de hoje.</p>
        </div>
        <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/indicacoes/clientes" className="stat-card block transition hover:border-primary/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Clientes indicados</span>
            <Users size={21} className="text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground">{metricsLoading ? '—' : indicationsCount}</div>
          <p className="mt-2 text-xs text-muted-foreground">Total de clientes cadastrados por você</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Ver indicações <Link2 size={13} /></span>
        </Link>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Comissão mensal estimada</span>
            <TrendingUp size={21} className="text-success" />
          </div>
          <div className="text-3xl font-bold text-foreground">{metricsLoading ? '—' : currency(indicationsCount * monthlyCommission)}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {metricsLoading ? 'Calculando com os dados registrados' : currency(monthlyCommission) + ' por cliente indicado/mês'}
          </p>
        </div>

        <Link to="/agenda" className="stat-card block transition hover:border-primary/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Agendamentos de hoje</span>
            <Calendar size={21} className="text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground">{calendarLoading ? '—' : todaySchedule.length}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {calendarLoading ? 'Consultando Agenda e Google Calendar…' : nextAppointment ? 'Próximo: ' + formatTime(nextAppointment.start) + ' · ' + nextAppointment.title : 'Nenhum próximo compromisso encontrado'}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Abrir agenda <Calendar size={13} /></span>
        </Link>
      </div>

      <section className="stat-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground">Agenda de hoje</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {calendarStatus === 'connected' ? 'Google Calendar conectado' : calendarStatus === 'error' ? 'Não foi possível atualizar o Google Calendar; exibindo os eventos locais disponíveis.' : 'Exibindo os eventos locais disponíveis.'}
            </p>
          </div>
          <Link to="/agenda" className="text-sm font-medium text-primary hover:underline">Ver agenda completa →</Link>
        </div>

        {calendarLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground"><Calendar size={17} className="animate-pulse" /> Carregando compromissos…</div>
        ) : todaySchedule.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar size={28} className="mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Nenhum agendamento encontrado para hoje</p>
            <p className="text-xs text-muted-foreground mt-1">Os compromissos aparecerão aqui quando estiverem cadastrados na Agenda ou no Google Calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySchedule.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                <div className="min-w-[62px] rounded-md bg-background px-2 py-1 text-center text-sm font-semibold text-primary">{formatTime(event.start)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground break-words">{event.title}</p>
                  {event.detail && <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line break-words">{event.detail}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{event.source}</p>
                </div>
              </div>
            ))}
            {todaySchedule.length > 8 && <p className="pt-1 text-center text-xs text-muted-foreground">Mais {todaySchedule.length - 8} compromisso(s) na agenda.</p>}
          </div>
        )}
      </section>

      <Link to="/leads" className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_30px_-8px_hsl(var(--primary)/0.55)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_-8px_hsl(var(--primary)/0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25" title="Novo Lead">
        <Plus size={24} />
      </Link>
    </div>
  );
};


const STAT_ICONS: Record<string, any> = {
  lead_novo: Users,
  em_negociacao: Handshake,
  fechamento: TrendingUp,
  venda_ganha: CheckCircle2,
};

const PIE_COLORS = ['hsl(262,70%,50%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(280,50%,55%)', 'hsl(199,80%,45%)'];

const SalesDashboard = () => {
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

return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary mb-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> FUTURE VISION</div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do seu funil de vendas</p>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 lg:gap-5">
        {stats.map(s => (
          <div key={s.label} className="stat-card group relative overflow-hidden">
            <div className="absolute -right-5 -top-6 h-20 w-20 rounded-full bg-primary/5 transition-transform duration-300 group-hover:scale-125" />
            <div className="relative flex items-center justify-between gap-3 mb-4">
              <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/10"><s.icon size={19} className={s.color} /></span>
            </div>
            <div className="relative text-3xl font-bold tracking-tight text-foreground tabular-nums">{s.value}</div>
            <div className="relative mt-3 h-1 w-10 rounded-full bg-primary/20 transition-all duration-300 group-hover:w-16 group-hover:bg-primary/50" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-1">Desempenho comercial</p><h3 className="font-semibold text-foreground mb-4">Leads por Etapa do Funil</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(262,70%,50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-1">Portfólio</p><h3 className="font-semibold text-foreground mb-4">Produto Mais Vendido</h3>
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

const Dashboard = () => {
  const { role } = useAuth();
  return role === 'atendimento' ? <AttendanceDashboard /> : <SalesDashboard />;
};

export default Dashboard;
