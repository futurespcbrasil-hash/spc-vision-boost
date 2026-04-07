import { useAppState } from '@/context/AppContext';
import { Calendar as CalIcon, Check, Clock, Plus, Link, Unlink, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GCalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  description: string;
}

const Agenda = () => {
  const { schedule, toggleScheduleDone, addScheduleEvent } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
  const todayStr = new Date().toISOString().split('T')[0];

  const pending = schedule.filter(e => !e.done).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const futureEvents = pending.filter(e => e.date >= todayStr);
  const done = schedule.filter(e => e.done);

  const filteredPending = selectedDateStr
    ? pending.filter(e => e.date === selectedDateStr)
    : pending;

  const eventDates = schedule.filter(e => !e.done).map(e => new Date(e.date + 'T12:00:00'));

  // Check Google Calendar connection status
  const checkGcalStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('google-calendar', {
        body: null,
        headers: {},
      });
      // Use query params approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await response.json();
      setGcalConnected(data.connected || false);
    } catch {
      setGcalConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  // Fetch Google Calendar events
  const fetchGcalEvents = useCallback(async () => {
    if (!gcalConnected) return;
    setGcalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + 30 * 86400000).toISOString();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=events&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await response.json();
      if (data.events) {
        setGcalEvents(data.events);
      } else if (data.connected === false) {
        setGcalConnected(false);
        toast.error('Conexão com Google Calendar expirou. Reconecte.');
      }
    } catch {
      toast.error('Erro ao buscar eventos do Google Calendar');
    } finally {
      setGcalLoading(false);
    }
  }, [gcalConnected]);

  useEffect(() => {
    checkGcalStatus();
  }, [checkGcalStatus]);

  useEffect(() => {
    if (gcalConnected) fetchGcalEvents();
  }, [gcalConnected, fetchGcalEvents]);

  // Check URL for callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gcal') === 'connected') {
      setGcalConnected(true);
      toast.success('Google Calendar conectado com sucesso!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const connectGcal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login primeiro');
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = window.location.origin;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Erro ao conectar com Google Calendar');
    }
  };

  const disconnectGcal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=disconnect`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      setGcalConnected(false);
      setGcalEvents([]);
      toast.success('Google Calendar desconectado');
    } catch {
      toast.error('Erro ao desconectar');
    }
  };

  // Filter gcal events by selected date
  const filteredGcalEvents = selectedDateStr
    ? gcalEvents.filter(e => e.start.startsWith(selectedDateStr))
    : gcalEvents;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Compromissos e retornos agendados</p>
        </div>
        <div className="flex items-center gap-2">
          {checkingStatus ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Verificando...</span>
          ) : gcalConnected ? (
            <button onClick={disconnectGcal} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition">
              <Unlink size={14} /> Desconectar Google Calendar
            </button>
          ) : (
            <button onClick={connectGcal} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition">
              <Link size={14} /> Conectar Google Calendar
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
            <Plus size={16} /> Novo Compromisso
          </button>
        </div>
      </div>

      {showForm && (
        <ScheduleForm onAdd={(e) => { addScheduleEvent(e); setShowForm(false); }} onCancel={() => setShowForm(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        {/* Calendar */}
        <div className="stat-card flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{ hasEvent: eventDates }}
            modifiersStyles={{ hasEvent: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' } }}
            className="rounded-md"
          />
        </div>

        {/* Events list */}
        <div className="space-y-4">
          {/* Google Calendar Events */}
          {gcalConnected && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                📅 Google Calendar {selectedDateStr ? `- ${selectedDate?.toLocaleDateString('pt-BR')}` : '(próximos 30 dias)'}
                {gcalLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              </h3>
              {filteredGcalEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum evento do Google Calendar {selectedDateStr ? 'nesta data' : ''}.</p>
              ) : (
                filteredGcalEvents.map(e => {
                  const startDate = new Date(e.start);
                  const dateStr = startDate.toLocaleDateString('pt-BR');
                  const timeStr = e.start.includes('T') ? startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia inteiro';
                  return (
                    <div key={e.id} className="stat-card flex items-center gap-3 border-l-4 border-l-primary/50">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                        <CalIcon size={12} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{e.summary}</div>
                        {e.location && <div className="text-xs text-muted-foreground truncate">📍 {e.location}</div>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                        <CalIcon size={12} /> {dateStr}
                        <Clock size={12} /> {timeStr}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Future events - always visible */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">🔜 Compromissos Futuros ({futureEvents.length})</h3>
            {futureEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum compromisso futuro agendado.</p>
            ) : (
              futureEvents.map(e => (
                <div key={`future-${e.id}`} className="stat-card flex items-center gap-3">
                  <button onClick={() => toggleScheduleDone(e.id)} className="w-5 h-5 rounded-full border-2 border-primary flex-shrink-0 hover:bg-primary/10 transition" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{e.leadName}</div>
                    <div className="text-xs text-muted-foreground">{e.note}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <CalIcon size={12} /> {e.date}
                    <Clock size={12} /> {e.time}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              📌 {selectedDateStr ? `Pendentes em ${selectedDate?.toLocaleDateString('pt-BR')}` : 'Todos Pendentes'} ({filteredPending.length})
            </h3>
            {filteredPending.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">Nenhum compromisso {selectedDateStr ? 'nesta data' : 'pendente'}.</p>
            )}
            {filteredPending.map(e => (
              <div key={e.id} className="stat-card flex items-center gap-3">
                <button onClick={() => toggleScheduleDone(e.id)} className="w-5 h-5 rounded-full border-2 border-primary flex-shrink-0 hover:bg-primary/10 transition" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{e.leadName}</div>
                  <div className="text-xs text-muted-foreground">{e.note}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                  <CalIcon size={12} /> {e.date}
                  <Clock size={12} /> {e.time}
                </div>
              </div>
            ))}
          </div>

          {done.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">✅ Concluídos ({done.length})</h3>
              {done.map(e => (
                <div key={e.id} className="stat-card flex items-center gap-3 opacity-50">
                  <button onClick={() => toggleScheduleDone(e.id)} className="w-5 h-5 rounded-full bg-success flex-shrink-0 flex items-center justify-center">
                    <Check size={12} className="text-success-foreground" />
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground line-through">{e.leadName}</div>
                    <div className="text-xs text-muted-foreground">{e.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ScheduleForm = ({ onAdd, onCancel }: { onAdd: (e: any) => void; onCancel: () => void }) => {
  const [form, setForm] = useState({ leadName: '', date: '', time: '', note: '' });
  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ id: Date.now().toString(), leadId: '', ...form, done: false });
  };

  return (
    <form onSubmit={handleSubmit} className="stat-card space-y-3 animate-slide-in">
      <h3 className="font-semibold text-foreground">Novo Compromisso</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className={inputClass} placeholder="Nome do lead *" required value={form.leadName} onChange={e => setForm({ ...form, leadName: e.target.value })} />
        <input className={inputClass} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <input className={inputClass} type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
      </div>
      <input className={inputClass} placeholder="Nota / Observação" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">Salvar</button>
      </div>
    </form>
  );
};

export default Agenda;
