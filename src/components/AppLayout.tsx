import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';

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
  if (pathname.startsWith('/produtos')) return 'produtos';
  if (pathname.startsWith('/comparador')) return 'comparador';
  if (pathname.startsWith('/gerar-link')) return 'gerar_link';
  if (pathname.startsWith('/revendas')) return 'revendas';
  if (pathname.startsWith('/perfil')) return 'perfil';
  if (pathname.startsWith('/usuarios')) return 'usuarios';
  return null;
};

const AppLayout = ({ children, noPadding }: { children: ReactNode; noPadding?: boolean }) => {
  const location = useLocation();
  const { canAccessModule } = useAuth();
  const moduleKey = moduleForPath(location.pathname);
  // Deny routes that have not been explicitly mapped to a module.
  const allowed = moduleKey !== null && canAccessModule(moduleKey);

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
