import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const [items, setItems] = useState<CRMNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const unreadCount = useMemo(() => items.filter(item => !item.read_at).length, [items]);

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
    if (item.chat_id) navigate('/whatsapp');
    else if (item.lead_id) navigate('/crm');
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

  if (!user) return null;

  return (
    <div className="fixed right-4 top-3 z-[60]">
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
            <Button variant="ghost" size="sm" onClick={() => void markAllRead()} disabled={unreadCount === 0} className="gap-1 text-xs"><CheckCheck size={14} /> Marcar lidas</Button>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? <p className="p-4 text-sm text-muted-foreground">Carregando...</p> : items.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">Você não tem notificações.</p>
            ) : items.map(item => (
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CRMNotificationBell;
