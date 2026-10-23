import { ReactNode, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CRMNotificationBell from '@/components/CRMNotificationBell';

const moduleForPath = (pathname: string): string | null => {
  if (pathname.startsWith('/manual')) return 'manual';
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/crm')) return 'crm';
  if (pathname.startsWith('/leads')) return 'leads';
  if (pathname.startsWith('/agenda')) return 'agenda';
  if (pathname.startsWith('/argumentos')) return 'crm';
  if (pathname.startsWith('/relatorios-comissoes') || pathname.startsWith('/cadastro-vendedores') || pathname.startsWith('/comissoes/')) return 'comissoes';
  if (pathname.startsWith('/relatorios')) return 'relatorios';
  if (pathname.startsWith('/metas')) return 'metas';
  if (pathname.startsWith('/notas')) return 'notas';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/campanhas')) return 'campaigns';
  if (pathname.startsWith('/consultas/cnpj-lote')) return 'consulta_cnpj_lote';
  if (pathname.startsWith('/consultas/sintegra')) return 'consulta_sintegra';
  if (pathname.startsWith('/consultas/cnpj')) return 'consulta_cnpj';
  if (pathname.startsWith('/consultas')) return 'consultas_spc';
  if (pathname.startsWith('/whatsapp')) return 'whatsapp';
  if (pathname.startsWith('/future-remote')) return 'future_remote';
  if (pathname.startsWith('/parceiros-spc')) return 'parceiros';
  if (pathname.startsWith('/indicacoes')) return 'indicacoes_atendimento';
  if (pathname.startsWith('/financeiro')) return 'financeiro';
  if (pathname.startsWith('/perfil')) return 'perfil';
  if (pathname.startsWith('/usuarios')) return 'usuarios';
  return null;
};

const AppLayout = ({ children, noPadding }: { children?: ReactNode; noPadding?: boolean }) => {
  const location = useLocation();
  const currentPathname = useRef(location.pathname);
  currentPathname.current = location.pathname;
  const { user, canAccessModule, canManageUsers } = useAuth();

  // Unread internal-chat messages update the browser tab title and desktop notification.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
    const refreshUnread = async () => {
      const { count, error } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('read', false);
      if (!active || error) return;
      document.title = (count || 0) > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    };
    void refreshUnread();
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
    const channel = supabase.channel(`chat-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${user.id}` }, payload => {
        const message = payload.new as { sender_id?: string; recipient_id?: string; content?: string; read?: boolean };
        if (message.recipient_id !== user.id) return;
        void refreshUnread();
        if (message.sender_id && message.sender_id !== user.id && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          void supabase.from('profiles').select('display_name').eq('user_id', message.sender_id).maybeSingle().then(({ data }) => {
            if (!active) return;
            const notification = new Notification(data?.display_name || 'Nova mensagem', { body: message.content?.startsWith('__chat_media__:') ? 'Enviou um arquivo de mídia' : (message.content || 'Nova mensagem'), icon: '/favicon.ico', tag: `chat-${message.sender_id}` });
            notification.onclick = () => { window.focus(); window.location.href = '/chat'; notification.close(); };
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${user.id}` }, () => { void refreshUnread(); })
      .subscribe();
    const onFocus = () => { void refreshUnread(); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.removeEventListener('focus', onFocus); supabase.removeChannel(channel); document.title = baseTitle; };
  }, [user]);
  // Global lead/chat assignment notifications remain available while navigating the CRM.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const channel = supabase.channel(`crm-assignment-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_notifications', filter: `user_id=eq.${user.id}` }, payload => {
        if (!active || currentPathname.current.startsWith('/whatsapp')) return;
        const item = payload.new as { id: string; title?: string; body?: string; chat_id?: string | null; lead_id?: string | null };
        toast({ title: item.title || 'Nova notificação', description: item.body || 'Você recebeu uma nova atribuição.' });
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification(item.title || 'Future Soluções', {
            body: item.body || 'Você recebeu uma nova atribuição.',
            icon: '/favicon.ico',
            tag: `crm-notification-${item.id}`,
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = item.lead_id ? `/crm?leadId=${encodeURIComponent(item.lead_id)}` : (item.chat_id ? '/whatsapp' : '/crm');
            notification.close();
          };
        }
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  const moduleKey = moduleForPath(location.pathname);
  const useNoPadding = noPadding ?? location.pathname.startsWith('/whatsapp');
  // Rotas sem módulo mapeado (como NotFound) não representam módulos protegidos.
  const allowed = moduleKey === null || (
    canAccessModule(moduleKey)
    && (location.pathname !== '/usuarios' || canManageUsers)
  );

  return (
    <div className="flex min-h-screen bg-background">
      <CRMNotificationBell />
      <div className="hidden md:block"><AppSidebar /></div>
      <main className={`flex-1 overflow-hidden ${useNoPadding ? 'pb-16 md:pb-0' : 'pb-20 md:pb-0'}`}>
        <div className={useNoPadding ? 'h-full' : 'p-4 sm:p-5 lg:p-7 xl:p-8 max-w-[1600px] mx-auto'}>
          {allowed ? (children ?? <Outlet />) : (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8">
              <ShieldAlert size={42} className="text-muted-foreground mb-4" />
              <h1 className="text-xl font-semibold">Acesso não autorizado</h1>
              <p className="text-sm text-muted-foreground mt-2">Seu perfil não tem permissão para acessar este módulo. Solicite acesso ao administrador.</p>
            </div>
          )}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
