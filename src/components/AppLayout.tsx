import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const moduleForPath = (pathname: string): string | null => {
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

const AppLayout = ({ children, noPadding }: { children: ReactNode; noPadding?: boolean }) => {
  const location = useLocation();
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
  const moduleKey = moduleForPath(location.pathname);
  // User administration is owner-only; all other routes require an explicit saved module permission.
  const allowed = moduleKey !== null
    && canAccessModule(moduleKey)
    && (location.pathname !== '/usuarios' || canManageUsers);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block"><AppSidebar /></div>
      <main className={`flex-1 overflow-hidden ${noPadding ? 'pb-16 md:pb-0' : 'pb-20 md:pb-0'}`}>
        <div className={noPadding ? 'h-full' : 'p-4 md:p-6 max-w-[1400px] mx-auto'}>
          {allowed ? children : (
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
