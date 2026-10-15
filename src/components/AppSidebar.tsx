import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar, FileBarChart,
  UserCog, LogOut, MessageCircle, Target, Handshake, ChevronDown, Building2, StickyNote, Search, MessageSquare, Settings2, Layers, UserPlus, FileText,
  Monitor, History, Cog, Wallet
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const AppSidebar = () => {
  const location = useLocation();
  const { profile, role, signOut, canManageUsers, canAccessModule } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const [whatsappOpen, setWhatsappOpen] = useState(location.pathname.startsWith('/whatsapp'));
  const [parceirosOpen, setParceirosOpen] = useState(location.pathname.startsWith('/parceiros-spc'));
  const [consultasOpen, setConsultasOpen] = useState(location.pathname.startsWith('/consultas'));
  const [comissoesOpen, setComissoesOpen] = useState(location.pathname.startsWith('/relatorios-comissoes') || location.pathname.startsWith('/cadastro-vendedores'));
  const [remoteOpen, setRemoteOpen] = useState(location.pathname.startsWith('/future-remote'));
  const [finOpen, setFinOpen] = useState(location.pathname.startsWith('/financeiro'));

  const REMOTE_SUB = [
    { to: '/future-remote', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'future_remote' },
    { to: '/future-remote/computadores', icon: Monitor, label: 'Computadores', moduleKey: 'future_remote' },
    { to: '/future-remote/historico', icon: History, label: 'Histórico', moduleKey: 'future_remote' },
    { to: '/future-remote/configuracoes', icon: Cog, label: 'Configurações', moduleKey: 'future_remote' },
  ];

  const CONSULTAS_SUB = [
    { to: '/consultas', icon: Search, label: 'Consulta SPC', moduleKey: 'consultas_spc' },
    { to: '/consultas/cnpj', icon: Building2, label: 'Consulta Receita', moduleKey: 'consulta_cnpj' },
    { to: '/consultas/sintegra', icon: FileText, label: 'Consulta Sintegra', moduleKey: 'consulta_sintegra' },
    { to: '/consultas/cnpj-lote', icon: Layers, label: 'Consulta CNPJ em Lote', moduleKey: 'consulta_cnpj_lote' },
  ];

  const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'dashboard' },
    { to: '/crm', icon: GitBranch, label: 'Funil', moduleKey: 'crm' },
    { to: '/leads', icon: Users, label: 'Leads', moduleKey: 'leads' },
    
    { to: '/agenda', icon: Calendar, label: 'Agenda', moduleKey: 'agenda' },
    { to: '/relatorios', icon: FileBarChart, label: 'Relatórios', moduleKey: 'relatorios' },
    { to: '/metas', icon: Target, label: 'Metas', moduleKey: 'metas' },
    { to: '/notas', icon: StickyNote, label: 'Notas', moduleKey: 'notas' },
    { to: '/chat', icon: MessageCircle, label: 'Chat Interno', moduleKey: 'chat' },
  ];

  const COMISSOES_SUB = [
    { to: '/relatorios-comissoes', icon: FileBarChart, label: 'Relatórios', moduleKey: 'comissoes' },
    { to: '/cadastro-vendedores', icon: UserPlus, label: 'Cadastro Vendedores', moduleKey: 'comissoes' },
  ];

  const WHATSAPP_SUB = [
    { to: '/whatsapp', icon: MessageSquare, label: 'Conversas', moduleKey: 'whatsapp' },
    { to: '/whatsapp/ajustes', icon: Settings2, label: 'Ajustes', moduleKey: 'whatsapp' },
  ];

  const PARCEIROS_SUB = [
    { to: '/parceiros-spc', icon: LayoutDashboard, label: 'Dashboard', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/parceiros', icon: Handshake, label: 'Parceiros', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/clientes', icon: Building2, label: 'Clientes Indicados', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/relatorios', icon: FileBarChart, label: 'Relatórios', moduleKey: 'parceiros' },
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
        {NAV_ITEMS.filter(item => canAccessModule(item.moduleKey)).map(item => {
          return renderNavItem(item, location.pathname === item.to);
        })}


        {canAccessModule('revendas') && (
          <Link
            to="/revendas"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
              ${location.pathname.startsWith('/revendas')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
            title={collapsed ? 'Revendas' : undefined}
          >
            <Building2 size={18} />
            {!collapsed && <span>Revendas</span>}
          </Link>
        )}
        {['consultas_spc', 'consulta_cnpj', 'consulta_sintegra', 'consulta_cnpj_lote'].some(key => canAccessModule(key)) && (
          <>
        <button
          onClick={() => setConsultasOpen(!consultasOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/consultas')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'Consultas' : undefined}
        >
          <Search size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Consultas</span>
              <ChevronDown size={14} className={`transition-transform ${consultasOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && consultasOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            {CONSULTAS_SUB.filter(sub => canAccessModule(sub.moduleKey)).map(sub => (
              <Link key={sub.to} to={sub.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                  ${location.pathname === sub.to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}>
                <sub.icon size={14} />
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        )}


          </>
        )}

        {canAccessModule('whatsapp') && (
          <>
        <button
          onClick={() => setWhatsappOpen(!whatsappOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/whatsapp')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'WhatsApp' : undefined}
        >
          <MessageSquare size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">WhatsApp</span>
              <ChevronDown size={14} className={`transition-transform ${whatsappOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && whatsappOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            {WHATSAPP_SUB.filter(sub => canAccessModule(sub.moduleKey)).map(sub => (
              <Link key={sub.to} to={sub.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                  ${location.pathname === sub.to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}>
                <sub.icon size={14} />
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        )}

          </>
        )}

        {canAccessModule('future_remote') && (
          <>
        <button
          onClick={() => setRemoteOpen(!remoteOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/future-remote')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'Future Remote' : undefined}
        >
          <Monitor size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Future Remote</span>
              <ChevronDown size={14} className={`transition-transform ${remoteOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && remoteOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            {REMOTE_SUB.filter(sub => canAccessModule(sub.moduleKey)).map(sub => (
              <Link key={sub.to} to={sub.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                  ${location.pathname === sub.to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}>
                <sub.icon size={14} />
                <span>{sub.label}</span>
              </Link>
            ))}
          </div>
        )}

          </>
        )}

        {canAccessModule('financeiro') && (
          <>
        <button
          onClick={() => setFinOpen(!finOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/financeiro')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'Financeiro' : undefined}
        >
          <Wallet size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Financeiro</span>
              <ChevronDown size={14} className={`transition-transform ${finOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && finOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            <Link to="/financeiro/boletos"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                ${location.pathname === '/financeiro/boletos'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}>
              <FileText size={14} />
              <span>Boletos WhatsApp</span>
            </Link>
            <Link to="/financeiro/clientes"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition
                ${location.pathname === '/financeiro/clientes'
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'}`}>
              <Users size={14} />
              <span>Clientes</span>
            </Link>
          </div>
        )}

          </>
        )}

        {(role === 'gestor' || canManageUsers) && canAccessModule('comissoes') && (
          <>
            <button
              onClick={() => setComissoesOpen(!comissoesOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${(location.pathname.startsWith('/relatorios-comissoes') || location.pathname.startsWith('/cadastro-vendedores'))
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
              title={collapsed ? 'Comissões' : undefined}
            >
              <FileBarChart size={18} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Comissões</span>
                  <ChevronDown size={14} className={`transition-transform ${comissoesOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
            {!collapsed && comissoesOpen && (
              <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
                {COMISSOES_SUB.filter(sub => canAccessModule(sub.moduleKey)).map(sub => (
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
          </>
        )}

        {canAccessModule('parceiros') && (
          <>
        <button
          onClick={() => setParceirosOpen(!parceirosOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${location.pathname.startsWith('/parceiros-spc')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
          title={collapsed ? 'Parceiros' : undefined}
        >
          <Handshake size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Parceiros</span>
              <ChevronDown size={14} className={`transition-transform ${parceirosOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {!collapsed && parceirosOpen && (
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-1">
            {PARCEIROS_SUB.filter(sub => canAccessModule(sub.moduleKey)).map(sub => (
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
          </>
        )}

      </nav>


      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && profile && (
          <div className="text-sidebar-foreground/80 text-xs px-2">
            <div className="font-medium truncate">{profile.display_name || profile.email}</div>
            <div className="text-sidebar-foreground/50 capitalize">{role}</div>
          </div>
        )}
        {canManageUsers && (
          <Link
            to="/usuarios"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-sm w-full ${collapsed ? 'justify-center' : ''} ${location.pathname === '/usuarios' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
            title="Usuários"
          >
            <Users size={16} />
            {!collapsed && <span>Usuários</span>}
          </Link>
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
