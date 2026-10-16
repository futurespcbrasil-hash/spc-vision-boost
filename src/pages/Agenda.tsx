import { useAppState } from '@/context/AppContext';
import { Calendar as CalIcon, Check, Clock, Plus, Link, Unlink, Loader2, AlertCircle, CheckCircle2, Info, Video, Pencil, Trash2, ExternalLink, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GCalEvent {
  id: string;
  google_event_id?: string;
  calendar_id?: string;
  calendar_name?: string;
  summary: string;
  start: string;
  end: string;
  location: string;
  description: string;
  status?: string;
  htmlLink?: string;
  creator?: { email?: string; displayName?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  visibility?: string;
  transparency?: string;
  hangoutLink?: string;
  created?: string;
  updated?: string;
  recurrence?: string[];
  recurringEventId?: string;
  reminders?: { useDefault?: boolean; overrides?: Array<{ method?: string; minutes?: number }> };
  conferenceData?: { conferenceSolution?: { name?: string }; entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }> };
  attachments?: Array<{ fileUrl?: string; title?: string; mimeType?: string }>;
  eventType?: string;
  colorId?: string;
  guestsCanInviteOthers?: boolean;
  guestsCanModify?: boolean;
  guestsCanSeeOtherGuests?: boolean;
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
const formatGoogleDescription = (value?: string | null) => {
  if (!value) return '';
  // Keep every Google Calendar detail; only make markup readable.
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<(p|div|li|tr|h[1-6])\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
const googleCompletionKey = (event: GCalEvent) => `${event.calendar_id || 'primary'}::${event.google_event_id || event.id}`;

const Agenda = () => {
  const { schedule, toggleScheduleDone, addScheduleEvent } = useAppState();
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [eventSearch, setEventSearch] = useState('');
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});

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
  const [editingGoogleEvent, setEditingGoogleEvent] = useState<GCalEvent | null>(null);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<GCalEvent | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const addLog = useCallback((message: string, type: GCalLog['type'] = 'info') => {
    setGcalLogs(prev => [...prev, { time: new Date().toLocaleTimeString('pt-BR'), message, type }]);
  }, []);

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
  const searchTerm = eventSearch.trim().toLocaleLowerCase('pt-BR');

  const eventDates = [
    ...schedule.filter(e => !e.done).map(e => new Date(e.date + 'T12:00:00')),
    ...appEvents.map(e => new Date(e.start_datetime)),
    ...gcalEvents.filter(e => e.start).map(e => new Date(e.start.includes('T') ? e.start : e.start + 'T12:00:00')),
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

  const fetchCompletionStatuses = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await (supabase as any).from('calendar_event_completions').select('source_type,event_key,is_completed').eq('user_id', session.user.id);
    if (error) { console.error('Error fetching completion statuses:', error); return; }
    const next: Record<string, boolean> = {};
    (data || []).forEach((row: any) => { next[`${row.source_type}:${row.event_key}`] = !!row.is_completed; });
    setCompletionMap(next);
  }, []);
  const toggleCalendarCompletion = async (sourceType: 'app' | 'google', eventKey: string) => {
    const mapKey = `${sourceType}:${eventKey}`;
    const nextValue = !completionMap[mapKey];
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Faça login para registrar a conclusão'); return; }
    const now = new Date().toISOString();
    const { error } = await (supabase as any).from('calendar_event_completions').upsert({
      user_id: session.user.id, source_type: sourceType, event_key: eventKey,
      is_completed: nextValue, completed_at: nextValue ? now : null, updated_at: now,
    }, { onConflict: 'user_id,source_type,event_key' });
    if (error) { console.error('Error saving completion:', error); toast.error('Não foi possível salvar a conclusão'); return; }
    setCompletionMap(prev => ({ ...prev, [mapKey]: nextValue }));
    toast.success(nextValue ? 'Compromisso marcado como concluído' : 'Conclusão desfeita');
  };

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
      // Show this user's last calendar snapshot immediately; the network refresh happens after status check.
      try {
        const cached = localStorage.getItem(`spc-vision:gcal-events:${session.user.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.events)) setGcalEvents(parsed.events);
          addLog('Eventos em cache exibidos enquanto atualiza o Google Calendar', 'info');
        }
      } catch {
        // Ignore corrupt or unavailable browser cache.
      }

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
      // Fetch the full range once per refresh; cached data is displayed immediately on reload.
      const timeMin = '1970-01-01T00:00:00.000Z';
      const timeMax = '2100-01-01T00:00:00.000Z';

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
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            localStorage.setItem(`spc-vision:gcal-events:${currentSession.user.id}`, JSON.stringify({
              savedAt: Date.now(),
              events: data.events,
            }));
          }
        } catch {
          // Cache is an optimization; the live result remains usable if storage is unavailable.
        }
        addLog(`Google Calendar atualizado: ${data.events.length} eventos`, 'success');
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
    fetchCompletionStatuses();
  }, [checkGcalStatus, fetchAppEvents, fetchCompletionStatuses]);

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
      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
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

  const handleUpdateGoogleEvent = async (formData: EventFormData) => {
    if (!editingGoogleEvent) return;
    setCreatingEvent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login primeiro');
        return;
      }
      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=update-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendar_id: editingGoogleEvent.calendar_id || 'primary',
            event_id: editingGoogleEvent.google_event_id || editingGoogleEvent.id,
            summary: formData.title,
            description: formData.description,
            start_datetime: formData.start_datetime,
            end_datetime: formData.end_datetime,
            location: formData.location || '',
            attendee_emails: formData.client_email.split(',').map(email => email.trim()).filter(Boolean),
            all_day: formData.all_day ?? !editingGoogleEvent.start?.includes('T'),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Erro ao atualizar evento no Google Calendar');
        return;
      }
      toast.success('Evento atualizado no Google Calendar');
      setEditingGoogleEvent(null);
      setSelectedGoogleEvent(null);
      await fetchGcalEvents();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar evento no Google Calendar');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDeleteGoogleEvent = async (event: GCalEvent) => {
    if (!confirm(`Excluir "${event.summary || 'este evento'}" do Google Calendar? Esta ação também será refletida na agenda Google.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Faça login primeiro');
        return;
      }
      const projectId = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar?action=delete-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendar_id: event.calendar_id || 'primary',
            event_id: event.google_event_id || event.id,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Erro ao excluir evento do Google Calendar');
        return;
      }
      setGcalEvents(prev => prev.filter(item => item.id !== event.id));
      setSelectedGoogleEvent(null);
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) localStorage.setItem(`spc-vision:gcal-events:${currentSession.user.id}`, JSON.stringify({ savedAt: Date.now(), events: gcalEvents.filter(item => item.id !== event.id) }));
      } catch {}
      toast.success('Evento excluído do Google Calendar');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir evento do Google Calendar');
    }
  };

  const filteredAppEvents = (selectedDateStr && !searchTerm ? appEvents.filter(e => e.start_datetime.startsWith(selectedDateStr)) : appEvents)
    .filter(e => !searchTerm || [e.title, e.description, e.client_email].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(searchTerm)));
  const filteredGcalEvents = (selectedDateStr && !searchTerm ? gcalEvents.filter(e => e.start.startsWith(selectedDateStr)) : gcalEvents)
    .filter(e => !searchTerm || [e.summary, e.location, e.description, e.calendar_name, ...(e.attendees || []).map(a => a.displayName || a.email || '')].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(searchTerm)));
  const filteredSchedule = schedule.filter(e => !selectedDateStr || !!searchTerm || e.date === selectedDateStr)
    .filter(e => !searchTerm || [e.leadName, e.note].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(searchTerm)))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

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
      {(showEventForm || editingEvent || editingGoogleEvent) && (
        editingGoogleEvent ? (
          <GoogleEventForm
            initialData={editingGoogleEvent}
            loading={creatingEvent}
            onSubmit={handleUpdateGoogleEvent}
            onCancel={() => { setShowEventForm(false); setEditingEvent(null); setEditingGoogleEvent(null); }}
          />
        ) : (
          <EventForm
            initialData={editingEvent}
            loading={creatingEvent}
            onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
            onCancel={() => { setShowEventForm(false); setEditingEvent(null); setEditingGoogleEvent(null); }}
          />
        )
      )}

      {selectedGoogleEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGoogleEvent(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="google-event-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-medium uppercase tracking-wide text-primary">Google Calendar</p><h2 id="google-event-title" className="text-xl font-semibold text-foreground mt-1">{selectedGoogleEvent.summary || '(Sem título)'}</h2></div>
              <button type="button" onClick={() => setSelectedGoogleEvent(null)} className="rounded-lg border border-border px-2 py-1 text-sm hover:bg-muted">Fechar</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Início</p><p className="font-medium">{selectedGoogleEvent.start ? (selectedGoogleEvent.start.includes('T') ? new Date(selectedGoogleEvent.start).toLocaleString('pt-BR') : new Date(selectedGoogleEvent.start + 'T12:00:00').toLocaleDateString('pt-BR')) : '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Fim</p><p className="font-medium">{selectedGoogleEvent.end ? (selectedGoogleEvent.end.includes('T') ? new Date(selectedGoogleEvent.end).toLocaleString('pt-BR') : new Date(selectedGoogleEvent.end + 'T12:00:00').toLocaleDateString('pt-BR')) : '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Agenda</p><p>{selectedGoogleEvent.calendar_name || 'Agenda principal'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Local</p><p className="whitespace-pre-wrap break-words">{selectedGoogleEvent.location || 'Não informado'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Observações</p><p className="whitespace-pre-wrap break-words">{formatGoogleDescription(selectedGoogleEvent.description) || 'Sem observações'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Organizador</p><p className="break-words">{selectedGoogleEvent.organizer?.displayName || selectedGoogleEvent.organizer?.email || '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Criado por</p><p className="break-words">{selectedGoogleEvent.creator?.displayName || selectedGoogleEvent.creator?.email || '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Convidados</p>{selectedGoogleEvent.attendees?.length ? <ul className="space-y-1">{selectedGoogleEvent.attendees.map((a, i) => <li key={a.email || i} className="break-words">{a.displayName ? a.displayName + ' — ' : ''}{a.email || 'Convidado'}{a.responseStatus ? ' · ' + a.responseStatus : ''}</li>)}</ul> : <p>Nenhum convidado listado</p>}</div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Status</p><p>{selectedGoogleEvent.status || '—'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Visibilidade</p><p>{selectedGoogleEvent.visibility || 'Padrão'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Tipo de evento</p><p>{selectedGoogleEvent.eventType || 'Padrão'}</p></div>
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Última atualização</p><p>{selectedGoogleEvent.updated ? new Date(selectedGoogleEvent.updated).toLocaleString('pt-BR') : '—'}</p></div>
              {selectedGoogleEvent.conferenceData?.entryPoints?.length ? <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Videoconferência</p><ul className="space-y-1">{selectedGoogleEvent.conferenceData.entryPoints.map((point, i) => <li key={point.uri || i} className="break-words">{point.label || point.entryPointType || 'Link'}: {point.uri || '—'}</li>)}</ul></div> : null}
              {selectedGoogleEvent.attachments?.length ? <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Anexos</p><ul className="space-y-1">{selectedGoogleEvent.attachments.map((attachment, i) => <li key={attachment.fileUrl || i} className="break-words">{attachment.fileUrl ? <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{attachment.title || attachment.fileUrl}</a> : (attachment.title || 'Anexo')}{attachment.mimeType ? ' · ' + attachment.mimeType : ''}</li>)}</ul></div> : null}
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Lembretes</p><p>{selectedGoogleEvent.reminders?.useDefault ? 'Lembretes padrão do Google Calendar' : selectedGoogleEvent.reminders?.overrides?.length ? selectedGoogleEvent.reminders.overrides.map(reminder => (reminder.method || 'Lembrete') + ' · ' + reminder.minutes + ' min antes').join(' | ') : 'Nenhum lembrete personalizado informado'}</p></div>
              {selectedGoogleEvent.recurrence?.length ? <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Recorrência</p><p className="whitespace-pre-wrap break-words">{selectedGoogleEvent.recurrence.join('\n')}</p></div> : null}
              <div className="rounded-lg bg-muted/40 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Permissões dos convidados</p><p>Convidar outros: {selectedGoogleEvent.guestsCanInviteOthers === undefined ? 'Padrão' : selectedGoogleEvent.guestsCanInviteOthers ? 'Sim' : 'Não'} · Editar evento: {selectedGoogleEvent.guestsCanModify === undefined ? 'Padrão' : selectedGoogleEvent.guestsCanModify ? 'Sim' : 'Não'} · Ver outros convidados: {selectedGoogleEvent.guestsCanSeeOtherGuests === undefined ? 'Padrão' : selectedGoogleEvent.guestsCanSeeOtherGuests ? 'Sim' : 'Não'}</p></div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => toggleCalendarCompletion('google', googleCompletionKey(selectedGoogleEvent))}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm ${completionMap[`google:${googleCompletionKey(selectedGoogleEvent)}`] ? 'border-green-600/40 text-green-700 hover:bg-green-500/10' : 'border-border hover:bg-muted'}`}>
                <Check size={14} /> {completionMap[`google:${googleCompletionKey(selectedGoogleEvent)}`] ? 'Concluído · desfazer' : 'Marcar como concluído'}
              </button>
              {(selectedGoogleEvent.hangoutLink || selectedGoogleEvent.htmlLink) && <a href={selectedGoogleEvent.hangoutLink || selectedGoogleEvent.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><ExternalLink size={14} /> Abrir no Google</a>}
              <button type="button" onClick={() => { setEditingGoogleEvent(selectedGoogleEvent); setSelectedGoogleEvent(null); }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Pencil size={14} /> Editar</button>
              <button type="button" onClick={() => handleDeleteGoogleEvent(selectedGoogleEvent)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Excluir</button>
            </div>
          </div>
        </div>
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
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={eventSearch} onChange={event => setEventSearch(event.target.value)}
              placeholder="Pesquisar compromisso por nome, telefone, e-mail ou observação..."
              aria-label="Pesquisar compromissos"
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
          </div>
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
                  <div key={event.id} className="stat-card space-y-2 border-t-2 border-border/70">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold tabular-nums">{startTime}</span><div className="h-px flex-1 bg-border" /></div>
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => toggleCalendarCompletion('app', event.id)}
                        aria-label={completionMap[`app:${event.id}`] ? 'Desmarcar como concluído' : 'Marcar como concluído'}
                        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${completionMap[`app:${event.id}`] ? 'bg-green-600 border-green-600 text-white' : 'border-primary'}`}>
                        {completionMap[`app:${event.id}`] && <Check size={12} />}
                      </button>
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
                📅 Google Calendar {selectedDateStr ? `- ${selectedDate?.toLocaleDateString('pt-BR')}` : '(todos os eventos carregados)'}
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
                    <div key={e.id} role="button" tabIndex={0} onClick={() => setSelectedGoogleEvent(e)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedGoogleEvent(e); } }}
                      className="stat-card w-full text-left flex items-center gap-3 border-l-4 border-l-primary/50 border-t-2 border-t-border/70 hover:bg-muted/40 transition cursor-pointer"
                      title="Clique para ver detalhes e ações">
                      <button type="button" onClick={event => { event.stopPropagation(); toggleCalendarCompletion('google', googleCompletionKey(e)); }}
                        aria-label={completionMap[`google:${googleCompletionKey(e)}`] ? 'Desmarcar como concluído' : 'Marcar como concluído'}
                        className={`h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${completionMap[`google:${googleCompletionKey(e)}`] ? 'bg-green-600 border-green-600 text-white' : 'border-primary'}`}>
                        {completionMap[`google:${googleCompletionKey(e)}`] && <Check size={12} />}
                      </button>
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                        <CalIcon size={12} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><span className="font-semibold tabular-nums">{timeStr}</span><div className="h-px flex-1 bg-border" /></div>
                        <div className="text-sm font-medium text-foreground truncate">{e.summary || '(Sem título)'}</div>
                        {e.location && <div className="text-xs text-muted-foreground truncate">📍 {e.location}</div>}
                        {e.calendar_name && <div className="text-[11px] text-muted-foreground truncate">Agenda: {e.calendar_name}</div>}
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

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">📌 Compromissos {selectedDateStr ? `- ${selectedDate?.toLocaleDateString('pt-BR')}` : ''} ({filteredSchedule.length})</h3>
            {filteredSchedule.length === 0 ? <p className="text-sm text-muted-foreground py-3">Nenhum compromisso encontrado para esta data ou pesquisa.</p> : filteredSchedule.map(item => (
              <div key={item.id} className={`stat-card flex items-center gap-3 border-t-2 border-border/70 ${item.done ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => toggleScheduleDone(item.id)} aria-label={item.done ? 'Desmarcar como concluído' : 'Marcar como concluído'}
                  className={`h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${item.done ? 'bg-green-600 border-green-600 text-white' : 'border-primary'}`}>{item.done && <Check size={12} />}</button>
                <div className="flex-1 min-w-0"><div className={`text-sm font-medium text-foreground ${item.done ? 'line-through' : ''}`}>{item.leadName}</div>{item.note && <div className="text-xs text-muted-foreground">{item.note}</div>}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0 border-l border-border pl-3"><CalIcon size={12} /> {item.date}<Clock size={12} /> {item.time}</div>
              </div>
            ))}
          </div>
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
  location?: string;
  all_day?: boolean;
  with_meet: boolean;
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
    location: '',
    with_meet: !!initialData?.meet_link,
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
        <CalIcon size={18} className="text-primary" />
        {initialData ? 'Editar Evento' : 'Novo Evento'}
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
      <label className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition">
        <input
          type="checkbox"
          checked={form.with_meet}
          onChange={e => setForm({ ...form, with_meet: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <Video size={16} className="text-primary" />
        <span className="text-sm text-foreground">Criar link do Google Meet para esta reunião</span>
      </label>
      <p className="text-xs text-muted-foreground">📅 O evento será salvo no Google Agenda. {form.with_meet && '🔗 Um link do Meet será gerado e enviado ao cliente.'}</p>
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


const GoogleEventForm = ({ initialData, loading, onSubmit, onCancel }: {
  initialData: GCalEvent;
  loading: boolean;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}) => {
  const isAllDay = !initialData.start?.includes('T');
  const formatInput = (value: string) => {
    if (!value) return '';
    if (!value.includes('T')) return value;
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [allDay, setAllDay] = useState(isAllDay);
  const [form, setForm] = useState({
    title: initialData.summary || '',
    description: initialData.description || '',
    start_datetime: formatInput(initialData.start),
    end_datetime: formatInput(initialData.end),
    client_email: initialData.attendees?.map(a => a.email).filter(Boolean).join(', ') || '',
    location: initialData.location || '',
  });
  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20";
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalize = (value: string) => {
      if (allDay) return new Date(value + 'T12:00:00').toISOString();
      return new Date(value).toISOString();
    };
    onSubmit({
      title: form.title,
      description: form.description,
      start_datetime: normalize(form.start_datetime),
      end_datetime: normalize(form.end_datetime),
      client_email: form.client_email.split(',').map(v => v.trim()).filter(Boolean)[0] || '',
      location: form.location,
      all_day: allDay,
      with_meet: false,
    });
  };
  return (
    <form onSubmit={handleSubmit} className="stat-card space-y-3 animate-slide-in border-l-4 border-l-primary">
      <h3 className="font-semibold text-foreground flex items-center gap-2"><CalIcon size={18} className="text-primary" />Editar evento do Google Calendar</h3>
      <input className={inputClass} required placeholder="Título *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <textarea className={inputClass} rows={4} placeholder="Descrição completa" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <input className={inputClass} placeholder="Local" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
      <input className={inputClass} placeholder="E-mails dos convidados (separados por vírgula)" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={allDay} onChange={e => { const next = e.target.checked; setAllDay(next); setForm(prev => ({ ...prev, start_datetime: next ? prev.start_datetime.slice(0, 10) : (prev.start_datetime.includes('T') ? prev.start_datetime : prev.start_datetime + 'T09:00'), end_datetime: next ? prev.end_datetime.slice(0, 10) : (prev.end_datetime.includes('T') ? prev.end_datetime : prev.end_datetime + 'T10:00') })); }} className="accent-primary" />Evento de dia inteiro</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground mb-1 block">Início *</label><input className={inputClass} type={allDay ? 'date' : 'datetime-local'} required value={form.start_datetime} onChange={e => setForm({ ...form, start_datetime: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground mb-1 block">Fim *</label><input className={inputClass} type={allDay ? 'date' : 'datetime-local'} required value={form.end_datetime} onChange={e => setForm({ ...form, end_datetime: e.target.value })} /></div>
      </div>
      <p className="text-xs text-muted-foreground">As alterações serão enviadas ao Google Calendar. Para convidados, informe os e-mails separados por vírgula.</p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">{loading && <Loader2 size={14} className="animate-spin" />}Salvar no Google</button>
      </div>
    </form>
  );
};

export default Agenda;
