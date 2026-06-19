import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar, FileBarChart,
  MoreHorizontal, UserCog, LogOut, MessageCircle, X, Target, Handshake, Building2, StickyNote
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { profile, role, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = [
    { to: '/', icon: LayoutDashboard, label: 'Início' },
    { to: '/crm', icon: GitBranch, label: 'Funil' },
    { to: '/leads', icon: Users, label: 'Leads' },
    { to: '/chat', icon: MessageCircle, label: 'Chat' },
  ];

  const more = [
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/relatorios', icon: FileBarChart, label: 'Relatórios' },
    { to: '/metas', icon: Target, label: 'Metas' },
    { to: '/notas', icon: StickyNote, label: 'Notas / Post-its' },
    { to: '/parceiros-spc', icon: Handshake, label: 'Parceiros SPC' },
    { to: '/parceiros-spc/parceiros', icon: Handshake, label: '— Parceiros' },
    { to: '/parceiros-spc/clientes', icon: Building2, label: '— Clientes Indicados' },
    { to: '/parceiros-spc/relatorios', icon: FileBarChart, label: '— Relatórios Parceiros' },
    { to: '/perfil', icon: UserCog, label: 'Meu Perfil' },
  ];

  const isActive = (to: string) => pathname === to;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar border-t border-sidebar-border flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
        {primary.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              isActive(item.to)
                ? 'text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
            }`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
        >
          <MoreHorizontal size={20} />
          <span>Ver mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-card rounded-t-2xl border-t border-border max-h-[80vh] overflow-y-auto animate-slide-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="font-semibold text-foreground text-sm">{profile?.display_name || profile?.email || 'Menu'}</div>
                {role && <div className="text-xs text-muted-foreground capitalize">{role}</div>}
              </div>
              <button onClick={() => setMoreOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>
            <div className="py-2">
              {more.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
                    isActive(item.to)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
              <button
                onClick={() => { setMoreOpen(false); signOut(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-muted transition"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomNav;
