import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, GitBranch, Calendar, FileBarChart,
  MoreHorizontal, UserCog, LogOut, MessageCircle, MessageSquare, X, Target, Handshake, Building2, StickyNote, Search, FileText,
  Package, Layers, Link2, Monitor, History, Cog, Wallet
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { profile, role, signOut, canManageUsers, canAccessModule } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = [
    { to: '/', icon: LayoutDashboard, label: 'Início', moduleKey: 'dashboard' },
    { to: '/crm', icon: GitBranch, label: 'Funil', moduleKey: 'crm' },
    { to: '/leads', icon: Users, label: 'Leads', moduleKey: 'leads' },
    { to: '/chat', icon: MessageCircle, label: 'Chat', moduleKey: 'chat' },
  ];

  const more = [
    { to: '/whatsapp', icon: MessageSquare, label: 'WhatsApp', moduleKey: 'whatsapp' },
    { to: '/whatsapp/instancias', icon: MessageSquare, label: '— Instâncias WA', moduleKey: 'whatsapp' },
    { to: '/consultas', icon: Search, label: 'Consultas SPC', moduleKey: 'consultas_spc' },
    { to: '/consultas/cnpj', icon: Building2, label: '— Consulta Receita', moduleKey: 'consulta_cnpj' },
    { to: '/consultas/sintegra', icon: FileText, label: '— Consulta Sintegra', moduleKey: 'consulta_sintegra' },
    { to: '/consultas/cnpj-lote', icon: Building2, label: '— Consulta CNPJ em Lote', moduleKey: 'consulta_cnpj_lote' },
    { to: '/produtos', icon: Package, label: 'Produtos', moduleKey: 'produtos' },
    { to: '/comparador', icon: Layers, label: 'Comparador', moduleKey: 'comparador' },
    { to: '/gerar-link', icon: Link2, label: 'Gerar Link', moduleKey: 'gerar_link' },
    { to: '/future-remote', icon: Monitor, label: 'Future Remote', moduleKey: 'future_remote' },
    { to: '/future-remote/computadores', icon: Monitor, label: '— Computadores', moduleKey: 'future_remote' },
    { to: '/future-remote/historico', icon: History, label: '— Histórico Remote', moduleKey: 'future_remote' },
    { to: '/future-remote/configuracoes', icon: Cog, label: '— Configurações Remote', moduleKey: 'future_remote' },
    { to: '/financeiro/boletos', icon: Wallet, label: 'Financeiro — Boletos', moduleKey: 'financeiro' },
    { to: '/financeiro/clientes', icon: Wallet, label: '— Clientes Financeiro', moduleKey: 'financeiro' },
    { to: '/revendas', icon: Building2, label: 'Revendas', moduleKey: 'revendas' },
    { to: '/agenda', icon: Calendar, label: 'Agenda', moduleKey: 'agenda' },
    { to: '/relatorios', icon: FileBarChart, label: 'Relatórios', moduleKey: 'relatorios' },
    { to: '/metas', icon: Target, label: 'Metas', moduleKey: 'metas' },
    { to: '/notas', icon: StickyNote, label: 'Notas / Post-its', moduleKey: 'notas' },
    { to: '/parceiros-spc', icon: Handshake, label: 'Parceiros', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/parceiros', icon: Handshake, label: '— Parceiros', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/clientes', icon: Building2, label: '— Clientes Indicados', moduleKey: 'parceiros' },
    { to: '/parceiros-spc/relatorios', icon: FileBarChart, label: '— Relatórios Parceiros', moduleKey: 'parceiros' },
    { to: '/perfil', icon: UserCog, label: 'Meu Perfil', moduleKey: 'perfil' },
    { to: '/relatorios-comissoes', icon: FileBarChart, label: 'Relatórios Comissões', adminOnly: true, moduleKey: 'comissoes' },
  ];

  const isActive = (to: string) => pathname === to;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar border-t border-sidebar-border flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
        {primary.filter(item => canAccessModule(item.moduleKey)).map(item => (
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
              {[...more.filter(m => (!m.adminOnly || role === 'gestor' || canManageUsers) && canAccessModule(m.moduleKey)), ...(canManageUsers ? [{ to: '/usuarios', icon: Users, label: 'Usuários', moduleKey: 'usuarios' }] : [])].map(item => (
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
