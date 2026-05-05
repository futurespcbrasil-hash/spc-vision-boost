import { useAppState } from '@/context/AppContext';
import { Calendar as CalIcon, Check, Clock, Plus, Link, Unlink, Loader2, AlertCircle, CheckCircle2, Info, Video, Pencil, Trash2, ExternalLink } from 'lucide-react';
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

interface AppEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  client_email: string;
  google_event_id: string | null;
  meet_link: string | null;
  status: string;
  created_at: string;
}

interface GCalLog {
  time: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  synced: { label: 'Sincronizado', color: 'bg-green-500/10 text-green-600', icon: '🟢' },
  error: { label: 'Erro', color: 'bg-destructive/10 text-destructive', icon: '🔴' },
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600', icon: '🟡' },
};

const Agenda = () => {
  const { schedule, toggleScheduleDone, addScheduleEvent } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [gcalLogs, setGcalLogs] = useState<GCalLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // App events state
  const [appEvents, setAppEvents] = useState<AppEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const addLog = useCallback((message: string, type: GCalLog['type'] = 'info') => {
    setGcalLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), message, type }]);
  }, []);

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
  const todayStr = new Date().toISOString().split('T')[0];

  const pending = schedule.filter(e => !e.done).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const futureEvents = pending.filter(e => e.date >= todayStr);
  const done = schedule.filter(e => e.done);

  const filteredPending = selectedDateStr
    ? pending.filter(e => e.date === selectedDateStr)
    : pending;

  const eventDates = [
    ...schedule.filter(e => !e.done).map(e => new Date(e.date + 'T12:00:00')),
    ...appEvents.map(e => new Date(e.start_datetime)),
  ];

  // Fetch app events from DB
  const fetchAppEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_datetime', { ascending: true });
      if (data) setAppEvents(data as unknown as AppEvent[]);
      if (error) console.error('Error fetching events:', error);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Check Google Calendar connection status
  const checkGcalStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      if (!session) {
        addLog('Sem sessão autenticada - faça login primeiro', 'error');
        setGcalError('Faça login para conectar o Google Calendar');
        return;
      }
      addLog('Sessão encontrada, verificando status...', 'info');

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

      if (response.ok) {
        setGcalConnected(data.connected || false);
        setGcalError(null);
        addLog(`Status: ${data.connected ? 'Conectado' : 'Não conectado'}`, data.connected ? 'success' : 'info');
      } else {
        addLog(`Erro ${response.status}: ${JSON.stringify(data)}`, 'error');
        setGcalError(`Erro ${response.status}: ${data.error || data.detail || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      addLog(`Exceção: ${err.message}`, 'error');
      setGcalError(err.message);
      setGcalConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  }, [addLog]);

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
    fetchAppEvents();
  }, [checkGcalStatus, fetchAppEvents]);

  useEffect(() => {
    if (gcalConnected) fetchGcalEvents();
  }, [gcalConnected, fetchGcalEvents]);

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
        addLog('Tentativa de conexão sem sessão', 'error');
        return;
      }

      addLog('Gerando URL de autenticação...', 'info');
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

      if (response.ok && data.url) {
        addLog('URL gerada, redirecionando para o Google...', 'success');
        window.location.href = data.url;
      } else {
        const errMsg = `Erro ${response.status}: ${data.error || data.detail || JSON.stringify(data)}`;
        addLog(errMsg, 'error');
        setGcalError(errMsg);
        toast.error('Erro ao conectar com Google Calendar');
      }
    } catch (err: any) {
      addLog(`Exceção: ${err.message}`, 'error');
      setGcalError(err.message);
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

  // Create event via edge function
  const handleCreateEvent = async (formData: EventFormData) => {
    setCreatingEvent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login primeiro');
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/create-calendar-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            start_datetime: formData.start_datetime,
            end_datetime: formData.end_datetime,
            client_email: formData.client_email,
            with_meet: formData.with_meet,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        toast.success(data.synced ? 'Evento criado e sincronizado com Google Calendar + Meet!' : 'Evento salvo (Google Calendar não conectado)');
        addLog(data.synced ? 'Evento criado com Meet link' : 'Evento salvo localmente', data.synced ? 'success' : 'info');
        setShowEventForm(false);
        fetchAppEvents();
      } else {
        toast.error(data.error || 'Erro ao criar evento');
        addLog(`Erro: ${data.error || data.google_error || 'desconhecido'}`, 'error');
      }
    } catch (err: any) {
      toast.error('Erro ao criar evento');
      addLog(`Exceção: ${err.message}`, 'error');
    } finally {
      setCreatingEvent(false);
    }
  };

  // Update event
  const handleUpdateEvent = async (formData: EventFormData) => {
    if (!editingEvent) return;
    setCreatingEvent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/update-calendar-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_id: editingEvent.id,
            title: formData.title,
            description: formData.description,
            start_datetime: formData.start_datetime,
            end_datetime: formData.end_datetime,
            client_email: formData.client_email,
          }),
        }
      );

      if (response.ok) {
        toast.success('Evento atualizado!');
        setEditingEvent(null);
        fetchAppEvents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao atualizar');
      }
    } catch (err: any) {
      toast.error('Erro ao atualizar evento');
    } finally {
      setCreatingEvent(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/delete-calendar-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_id: eventId }),
        }
      );

      if (response.ok) {
        toast.success('Evento excluído!');
        setAppEvents(prev => prev.filter(e => e.id !== eventId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir evento');
    }
  };

  // Filter app events by selected date
  const filteredAppEvents = selectedDateStr
    ? appEvents.filter(e => e.start_datetime.startsWith(selectedDateStr))
    : appEvents;

  const filteredGcalEvents = selectedDateStr
    ? gcalEvents.filter(e => e.start.startsWith(selectedDateStr))
    : gcalEvents;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus eventos, reuniões e compromissos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status badge */}
          {!checkingStatus && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              hasSession === false
                ? 'bg-destructive/10 text-destructive'
                : gcalConnected
                ? 'bg-green-500/10 text-green-600'
                : gcalError
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}>
              {hasSession === false ? (
                <><AlertCircle size={12} /> Sem login</>
              ) : gcalConnected ? (
                <><CheckCircle2 size={12} /> Conectado</>
              ) : gcalError ? (
                <><AlertCircle size={12} /> Erro</>
              ) : (
                <><Info size={12} /> Desconectado</>
              )}
            </span>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition"
          >
            <Info size={12} /> Logs {gcalLogs.length > 0 && `(${gcalLogs.length})`}
          </button>

          {checkingStatus ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Verificando...</span>
          ) : gcalConnected ? (
            <button onClick={disconnectGcal} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition">
              <Unlink size={14} /> Desconectar
            </button>
          ) : (
            <button onClick={connectGcal} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition">
              <Link size={14} /> Conectar Google
            </button>
          )}

          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition">
            <Plus size={16} /> Compromisso
          </button>

          <button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
            <CalIcon size={16} /> Criar Evento
          </button>
        </div>
      </div>

      {/* Error banner */}
      {gcalError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{gcalError}</span>
        </div>
      )}

      {/* Logs panel */}
      {showLogs && (
        <div className="stat-card space-y-2 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Logs Google Calendar</h3>
            <button onClick={() => setGcalLogs([])} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>
          </div>
          {gcalLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum log ainda.</p>
          ) : (
            gcalLogs.map((log, i) => (
              <div key={i} className={`text-xs flex items-start gap-2 ${
                log.type === 'error' ? 'text-destructive' : log.type === 'success' ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                <span className="text-muted-foreground/60 flex-shrink-0">{log.time}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule form (simple) */}
      {showForm && (
        <ScheduleForm onAdd={(e) => { addScheduleEvent(e); setShowForm(false); }} onCancel={() => setShowForm(false)} />
      )}

      {/* Event form (Google Calendar + Meet) */}
      {(showEventForm || editingEvent) && (
        <EventForm
          initialData={editingEvent}
          loading={creatingEvent}
          onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
          onCancel={() => { setShowEventForm(false); setEditingEvent(null); }}
        />
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
          {/* App Events (with Meet) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              🗓️ Meus Eventos {selectedDateStr ? `- ${selectedDate?.toLocaleDateString('pt-BR')}` : ''} ({filteredAppEvents.length})
              {eventsLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </h3>
            {filteredAppEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum evento {selectedDateStr ? 'nesta data' : 'criado'}. Clique em "Criar Evento + Meet" para começar.</p>
            ) : (
              filteredAppEvents.map(event => {
                const startDate = new Date(event.start_datetime);
                const endDate = new Date(event.end_datetime);
                const dateStr = startDate.toLocaleDateString('pt-BR');
                const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endTime = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const st = statusConfig[event.status] || statusConfig.pending;

                return (
                  <div key={event.id} className="stat-card space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{event.title}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${st.color}`}>
                            {st.icon} {st.label}
                          </span>
                        </div>
                        {event.description && <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CalIcon size={11} /> {dateStr}</span>
                          <span className="flex items-center gap-1"><Clock size={11} /> {startTime} - {endTime}</span>
                          {event.client_email && <span>📧 {event.client_email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {event.meet_link && (
                          <a
                            href={event.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
                          >
                            <Video size={12} /> Entrar na reunião
                          </a>
                        )}
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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

          {/* Future schedule events */}
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

// Simple schedule form (existing)
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

// Event form (Google Calendar + Meet)
interface EventFormData {
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  client_email: string;
}

const EventForm = ({
  initialData,
  loading,
  onSubmit,
  onCancel,
}: {
  initialData?: AppEvent | null;
  loading: boolean;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}) => {
  const formatForInput = (dt: string) => {
    if (!dt) return '';
    const d = new Date(dt);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState<EventFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    start_datetime: initialData ? formatForInput(initialData.start_datetime) : '',
    end_datetime: initialData ? formatForInput(initialData.end_datetime) : '',
    client_email: initialData?.client_email || '',
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startIso = new Date(form.start_datetime).toISOString();
    const endIso = new Date(form.end_datetime).toISOString();
    onSubmit({ ...form, start_datetime: startIso, end_datetime: endIso });
  };

  return (
    <form onSubmit={handleSubmit} className="stat-card space-y-3 animate-slide-in border-l-4 border-l-primary">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Video size={18} className="text-primary" />
        {initialData ? 'Editar Evento' : 'Novo Evento com Google Meet'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className={inputClass} placeholder="Título do evento *" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className={inputClass} type="email" placeholder="Email do cliente" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} />
      </div>
      <input className={inputClass} placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Início *</label>
          <input className={inputClass} type="datetime-local" required value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fim *</label>
          <input className={inputClass} type="datetime-local" required value={form.end_datetime} onChange={e => setForm({ ...form, end_datetime: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">🔗 Um link do Google Meet será gerado automaticamente e o cliente receberá um convite por email.</p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {initialData ? 'Atualizar' : 'Criar Evento'}
        </button>
      </div>
    </form>
  );
};

export default Agenda;
