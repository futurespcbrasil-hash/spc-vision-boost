import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar, FileBarChart,
  UserCog, LogOut, MessageCircle, Target, Handshake, ChevronDown, Building2, StickyNote
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const AppSidebar = () => {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const [parceirosOpen, setParceirosOpen] = useState(location.pathname.startsWith('/parceiros-spc'));

  const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/crm', icon: GitBranch, label: 'Funil' },
    { to: '/leads', icon: Users, label: 'Leads' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/relatorios', icon: FileBarChart, label: 'Relatórios' },
    { to: '/metas', icon: Target, label: 'Metas' },
    { to: '/notas', icon: StickyNote, label: 'Notas' },
    { to: '/chat', icon: MessageCircle, label: 'Chat Interno' },
  ];

  const PARCEIROS_SUB = [
    { to: '/parceiros-spc', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/parceiros-spc/parceiros', icon: Handshake, label: 'Parceiros' },
    { to: '/parceiros-spc/clientes', icon: Building2, label: 'Clientes Indicados' },
    { to: '/parceiros-spc/relatorios', icon: FileBarChart, label: 'Relatórios' },
  ];

  const renderNavItem = (item: typeof NAV_ITEMS[0], isActive: boolean) => (
    <Link
      key={item.to}
      to={item.to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
        ${isActive 
          ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
        }`}
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={18} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  return (
    <aside className={`h-screen gradient-spc flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} sticky top-0`}>
      <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center animate-fade-in bg-white rounded-md px-2 py-1">
            <img src="/logo-future.png" alt="Future Soluções" className="h-7 w-auto object-contain" />
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1 rounded text-xs"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => renderNavItem(item, location.pathname === item.to))}

        <button
          onClick={() => setParceirosOpen(!parceirosOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/parceiros-spc')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'Parceiros SPC' : undefined}
        >
          <Handshake size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Parceiros SPC</span>
              <ChevronDown size={14} className={`transition-transform ${parceirosOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && parceirosOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            {PARCEIROS_SUB.map(sub => (
              <Link
                key={sub.to}
                to={sub.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                  ${location.pathname === sub.to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}
              >
                <sub.icon size={14} />
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>


      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && profile && (
          <div className="text-sidebar-foreground/80 text-xs px-2">
            <div className="font-medium truncate">{profile.display_name || profile.email}</div>
            <div className="text-sidebar-foreground/50 capitalize">{role}</div>
          </div>
        )}
        <Link
          to="/perfil"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-sm w-full ${collapsed ? 'justify-center' : ''} ${location.pathname === '/perfil' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
          title="Meu Perfil"
        >
          <UserCog size={16} />
          {!collapsed && <span>Meu Perfil</span>}
        </Link>
        <button
          onClick={signOut}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-sm w-full ${collapsed ? 'justify-center' : ''}`}
          title="Sair"
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
