import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type CRMReminder = { id: string; titulo: string; conteudo?: string | null; data_lembrete?: string | null; };
type CRMScheduleReminder = { id: string; lead_name?: string | null; date: string; time?: string | null; note?: string | null; };

type CRMNotification = {
  id: string;
  title: string;
  body: string;
  chat_id: string | null;
  lead_id: string | null;
  created_at: string;
  read_at: string | null;
};

const CRMNotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<CRMNotification[]>([]);
  const [notes, setNotes] = useState<CRMReminder[]>([]);
  const [appointments, setAppointments] = useState<CRMScheduleReminder[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const unreadCount = useMemo(() => items.filter(item => !item.read_at).length + notes.length + appointments.length, [items, notes, appointments]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).from('whatsapp_notifications')
        .select('id,title,body,chat_id,lead_id,created_at,read_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!active) return;
      if (!error) setItems((data || []) as CRMNotification[]);
      else console.warn('[CRM notifications] Falha ao carregar notificações:', error.message);
      setLoading(false);
    };
    void load();
    const loadReminders = async () => {
      const [{ data: noteData, error: noteError }, { data: appointmentData, error: appointmentError }] = await Promise.all([
        (supabase as any).from('notas').select('id,titulo,conteudo,data_lembrete').eq('concluido', false).order('data_lembrete', { ascending: true, nullsFirst: false }).limit(10),
        (supabase as any).from('schedule_events').select('id,lead_name,date,time,note').eq('done', false).order('date', { ascending: true }).limit(10),
      ]);
      if (!active) return;
      if (noteError) console.warn('[CRM notifications] Falha ao carregar notas:', noteError.message);
      else setNotes((noteData || []).map((note: any) => ({ ...note, titulo: note.titulo || 'Nota pendente' })));
      if (appointmentError) console.warn('[CRM notifications] Falha ao carregar compromissos:', appointmentError.message);
      else setAppointments((appointmentData || []) as CRMScheduleReminder[]);
    };
    void loadReminders();
    const channel = supabase.channel(`crm-bell-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_notifications', filter: `user_id=eq.${user.id}` }, payload => {
        if (!active) return;
        const item = payload.new as CRMNotification;
        setItems(previous => [item, ...previous.filter(old => old.id !== item.id)].slice(0, 30));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_notifications', filter: `user_id=eq.${user.id}` }, payload => {
        if (!active) return;
        const item = payload.new as CRMNotification;
        setItems(previous => previous.map(old => old.id === item.id ? item : old));
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user?.id]);

  const openNotification = async (item: CRMNotification) => {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await (supabase as any).from('whatsapp_notifications')
        .update({ read_at: readAt }).eq('id', item.id).eq('user_id', user?.id);
      if (!error) setItems(previous => previous.map(old => old.id === item.id ? { ...old, read_at: readAt } : old));
    }
    setOpen(false);
    if (item.lead_id) navigate(`/crm?leadId=${encodeURIComponent(item.lead_id)}&focus=card`);
    else if (item.chat_id) navigate('/whatsapp');
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    const readAt = new Date().toISOString();
    const unreadIds = items.filter(item => !item.read_at).map(item => item.id);
    const { error } = await (supabase as any).from('whatsapp_notifications')
      .update({ read_at: readAt }).eq('user_id', user.id).is('read_at', null);
    if (error) return;
    setItems(previous => previous.map(item => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
  };

  const clearHistory = async () => {
    if (!user?.id || items.length === 0) return;
    const { error, count } = await (supabase as any).from('whatsapp_notifications')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);
    if (error) {
      console.error('[CRM notifications] Falha ao limpar histórico:', error);
      toast.error(`Não foi possível limpar as notificações: ${error.message}`);
      return;
    }
    // Só limpar a interface depois da confirmação do banco; o próximo carregamento
    // consulta a mesma tabela, então os registros removidos não devem reaparecer.
    setItems([]);
    toast.success(count === 0 ? 'Não havia notificações para excluir.' : 'Histórico de notificações limpo.');
  };

  if (!user || location.pathname.startsWith('/whatsapp')) return null;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="relative rounded-full shadow-md bg-card" aria-label={`Notificações do CRM: ${unreadCount} não lidas`}>
            <Bell size={18} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Notificações do CRM</p>
              <p className="text-xs text-muted-foreground">{unreadCount} não lidas</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()} disabled={unreadCount === 0} className="gap-1 text-xs"><CheckCheck size={14} /> Lidas</Button>
              <Button variant="ghost" size="sm" onClick={() => void clearHistory()} disabled={items.length === 0} className="gap-1 text-xs text-destructive"><Trash2 size={14} /> Limpar</Button>
            </div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
            {!loading && items.length === 0 && notes.length === 0 && appointments.length === 0 && <p className="p-5 text-sm text-muted-foreground text-center">Você não tem notificações ou lembretes.</p>}
            {items.map(item => (
              <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`w-full text-left p-3 border-b border-border/70 hover:bg-muted/60 transition ${item.read_at ? '' : 'bg-primary/5'}`}>
                <span className="flex items-start gap-2">
                  {!item.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{item.title}</span>
                    <span className="block text-xs text-muted-foreground mt-1">{item.body}</span>
                    <span className="block text-[10px] text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                  </span>
                </span>
              </button>
            ))}
            {notes.length > 0 && <>
              <div className="p-3 border-y border-border bg-muted/30 text-xs font-semibold">📝 Post-its pendentes</div>
              {notes.map(note => <button key={note.id} type="button" onClick={() => { setOpen(false); navigate('/notas'); }} className="w-full text-left p-3 border-b border-border/70 hover:bg-muted/60 transition">
                <span className="block text-sm font-medium">{note.titulo}</span>
                {note.conteudo && <span className="block text-xs text-muted-foreground mt-1 line-clamp-2">{note.conteudo}</span>}
                <span className="block text-[10px] text-muted-foreground mt-1">{note.data_lembrete || 'Sem data de lembrete'}</span>
              </button>)}
            </>}
            {appointments.length > 0 && <>
              <div className="p-3 border-y border-border bg-muted/30 text-xs font-semibold">📅 Próximos compromissos</div>
              {appointments.map(event => <button key={event.id} type="button" onClick={() => { setOpen(false); navigate('/agenda'); }} className="w-full text-left p-3 border-b border-border/70 hover:bg-muted/60 transition">
                <span className="block text-sm font-medium">{event.lead_name || 'Compromisso'}</span>
                <span className="block text-xs text-muted-foreground mt-1">{event.date} {event.time || ''}{event.note ? ` · ${event.note}` : ''}</span>
              </button>)}
            </>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CRMNotificationBell;
