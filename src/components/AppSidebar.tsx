import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, GitBranch, BarChart3, Link2, Calendar, 
  MessageSquare, ChevronLeft, ChevronRight, Package, FileBarChart,
  Phone, ChevronDown, ChevronUp, Smartphone, MessagesSquare, Send,
  FileText, PieChart, Settings, LogOut, Shield
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const AppSidebar = () => {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(location.pathname.startsWith('/whatsapp'));

  const isWhatsappActive = location.pathname.startsWith('/whatsapp');

  const NAV_ITEMS = role === 'gestor'
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/agenda', icon: Calendar, label: 'Agenda' },
        { to: '/relatorios', icon: FileBarChart, label: 'Relatórios' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/crm', icon: GitBranch, label: 'CRM / Funil' },
        { to: '/leads', icon: Users, label: 'Leads' },
        { to: '/produtos', icon: Package, label: 'Produtos' },
        { to: '/comparador', icon: BarChart3, label: 'Comparador' },
        { to: '/gerar-link', icon: Link2, label: 'Gerar Link' },
        { to: '/agenda', icon: Calendar, label: 'Agenda' },
        { to: '/argumentos', icon: MessageSquare, label: 'Argumentos' },
        { to: '/relatorios', icon: FileBarChart, label: 'Relatórios' },
      ];

  const WHATSAPP_ITEMS = [
    { to: '/whatsapp/contas', icon: Smartphone, label: 'Contas Conectadas' },
    { to: '/whatsapp/conversas', icon: MessagesSquare, label: 'Conversas' },
    { to: '/whatsapp/enviar', icon: Send, label: 'Enviar Mensagem' },
    { to: '/whatsapp/templates', icon: FileText, label: 'Templates' },
    { to: '/whatsapp/dashboard', icon: PieChart, label: 'Dashboard' },
    { to: '/whatsapp/config', icon: Settings, label: 'Configurações' },
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
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
              SPC
            </div>
            <span className="text-sidebar-foreground font-semibold text-sm">Vendas SPC</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1 rounded"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => renderNavItem(item, location.pathname === item.to))}

        {/* WhatsApp Section */}
        <button
          onClick={() => !collapsed && setWhatsappOpen(!whatsappOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${isWhatsappActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            }`}
          title={collapsed ? 'WhatsApp' : undefined}
        >
          <Phone size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">WhatsApp</span>
              {whatsappOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </>
          )}
        </button>

        {!collapsed && whatsappOpen && (
          <div className="ml-4 space-y-0.5 border-l-2 border-sidebar-border pl-2">
            {WHATSAPP_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-2 py-2 rounded-md text-xs font-medium transition-all duration-150
                  ${location.pathname === item.to
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40'
                  }`}
              >
                <item.icon size={14} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}

        {collapsed && (
          <Link
            to="/whatsapp/conversas"
            className="flex items-center justify-center px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            title="WhatsApp"
          >
            <Phone size={18} />
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && profile && (
          <div className="text-sidebar-foreground/80 text-xs px-2">
            <div className="font-medium truncate">{profile.display_name || profile.email}</div>
            <div className="text-sidebar-foreground/50 capitalize">{role}</div>
          </div>
        )}
        <button
          onClick={signOut}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-sm w-full ${collapsed ? 'justify-center' : ''}`}
          title="Sair"
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
        {!collapsed && (
          <div className="text-sidebar-foreground/50 text-xs text-center">
            SPC Brasil © 2026
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
