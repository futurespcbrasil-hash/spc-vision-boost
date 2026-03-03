import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, GitBranch, BarChart3, Link2, Calendar, 
  MessageSquare, ChevronLeft, ChevronRight, Package, FileBarChart 
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
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

const AppSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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

      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.to;
          return (
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
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
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
