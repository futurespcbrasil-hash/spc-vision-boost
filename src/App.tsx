import { lazy, Suspense, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SectorsProvider } from "@/hooks/useSectors";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import Auth from "@/pages/Auth";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

// Recarrega automaticamente uma única vez quando um deploy deixa um chunk antigo em cache.
const lazyWithRetry = (importer: () => Promise<{ default: ComponentType<any> }>) =>
  lazy(async () => {
    try {
      const module = await importer();
      try { sessionStorage.removeItem("spc-chunk-load-retry"); } catch { /* storage indisponível */ }
      return module;
    } catch (error) {
      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem("spc-chunk-load-retry") === "1";
        if (alreadyRetried) sessionStorage.removeItem("spc-chunk-load-retry");
        else sessionStorage.setItem("spc-chunk-load-retry", "1");
      } catch { /* storage indisponível */ }
      if (!alreadyRetried) {
        window.location.reload();
        return new Promise<{ default: ComponentType<any> }>(() => {});
      }
      throw error;
    }
  });

// Rotas carregadas sob demanda (app mais leve e inicialização mais rápida)
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const GestorDashboard = lazyWithRetry(() => import("@/pages/GestorDashboard"));
const CRMKanban = lazyWithRetry(() => import("@/pages/CRMKanban"));
const LeadsPage = lazyWithRetry(() => import("@/pages/LeadsPage"));
const Comparador = lazyWithRetry(() => import("@/pages/Comparador"));
const GerarLink = lazyWithRetry(() => import("@/pages/GerarLink"));
const PublicComparison = lazyWithRetry(() => import("@/pages/PublicComparison"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Argumentos = lazyWithRetry(() => import("@/pages/Argumentos"));
const Produtos = lazyWithRetry(() => import("@/pages/Produtos"));
const Relatorios = lazyWithRetry(() => import("@/pages/Relatorios"));
const Chat = lazyWithRetry(() => import("@/pages/Chat"));
const Perfil = lazyWithRetry(() => import("@/pages/Perfil"));
const Metas = lazyWithRetry(() => import("@/pages/Metas"));
const Notas = lazyWithRetry(() => import("@/pages/Notas"));
const ParceirosDashboard = lazyWithRetry(() => import("@/pages/parceiros-spc/ParceirosDashboard"));
const Parceiros = lazyWithRetry(() => import("@/pages/parceiros-spc/Parceiros"));
const ClientesIndicados = lazyWithRetry(() => import("@/pages/parceiros-spc/ClientesIndicados"));
const ClientesIndicadosAtendimento = lazyWithRetry(() => import("@/pages/indicacoes/ClientesIndicadosAtendimento"));
const ParceirosRelatorios = lazyWithRetry(() => import("@/pages/parceiros-spc/Relatorios"));
const ConsultaSPC = lazyWithRetry(() => import("@/pages/ConsultaSPC"));
const ConsultaCNPJ = lazyWithRetry(() => import("@/pages/cnpj/ConsultaCNPJ"));
const ConsultaSintegra = lazyWithRetry(() => import("@/pages/cnpj/ConsultaSintegra"));
const ConsultaCNPJLote = lazyWithRetry(() => import("@/pages/cnpj/ConsultaCNPJLote"));
const WhatsAppChat = lazyWithRetry(() => import("@/pages/WhatsAppChat"));
const WhatsAppInstancias = lazyWithRetry(() => import("@/pages/WhatsAppInstancias"));
const WhatsAppAjustes = lazyWithRetry(() => import("@/pages/WhatsAppAjustes"));
const RelatoriosComissoes = lazyWithRetry(() => import("@/pages/RelatoriosComissoes"));
const CadastroVendedores = lazyWithRetry(() => import("@/pages/CadastroVendedores"));
const Usuarios = lazyWithRetry(() => import("@/pages/Usuarios"));
const Revendas = lazyWithRetry(() => import("@/pages/Revendas"));
const Suporte = lazyWithRetry(() => import("@/pages/Suporte"));
const FutureRemoteDashboard = lazyWithRetry(() => import("@/pages/remote/FutureRemoteDashboard"));
const RemoteComputadores = lazyWithRetry(() => import("@/pages/remote/Computadores"));
const RemoteHistorico = lazyWithRetry(() => import("@/pages/remote/Historico"));
const RemoteConfiguracoes = lazyWithRetry(() => import("@/pages/remote/Configuracoes"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const BoletosWhatsApp = lazyWithRetry(() => import("@/pages/BoletosWhatsApp"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const ProtectedRoutes = () => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <AppProvider>
      <SectorsProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>

            <Route path="/comparacao/:id" element={<PublicComparison />} />
            <Route path="/" element={<AppLayout>{role === 'gestor' ? <GestorDashboard /> : <Dashboard />}</AppLayout>} />
            <Route path="/crm" element={<AppLayout><CRMKanban /></AppLayout>} />
            <Route path="/crm-comercial" element={<Navigate to="/crm" replace />} />
            <Route path="/leads" element={<AppLayout><LeadsPage /></AppLayout>} />
            <Route path="/produtos" element={<AppLayout><Produtos /></AppLayout>} />
            <Route path="/comparador" element={<AppLayout><Comparador /></AppLayout>} />
            <Route path="/gerar-link" element={<AppLayout><GerarLink /></AppLayout>} />
            <Route path="/agenda" element={<AppLayout><Agenda /></AppLayout>} />
            <Route path="/argumentos" element={<AppLayout><Argumentos /></AppLayout>} />
            <Route path="/relatorios" element={<AppLayout><Relatorios /></AppLayout>} />
            <Route path="/chat" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
            <Route path="/metas" element={<AppLayout><Metas /></AppLayout>} />
            <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
            <Route path="/parceiros-spc" element={<AppLayout><ParceirosDashboard /></AppLayout>} />
            <Route path="/parceiros-spc/parceiros" element={<AppLayout><Parceiros /></AppLayout>} />
            <Route path="/parceiros-spc/clientes" element={<AppLayout><ClientesIndicados /></AppLayout>} />
            <Route path="/indicacoes/clientes" element={<AppLayout><ClientesIndicadosAtendimento /></AppLayout>} />
            <Route path="/parceiros-spc/relatorios" element={<AppLayout><ParceirosRelatorios /></AppLayout>} />
            <Route path="/consultas" element={<AppLayout><ConsultaSPC /></AppLayout>} />
            <Route path="/consultas/cnpj" element={<AppLayout><ConsultaCNPJ /></AppLayout>} />
            <Route path="/consultas/sintegra" element={<AppLayout><ConsultaSintegra /></AppLayout>} />
            <Route path="/consultas/cnpj-lote" element={<AppLayout><ConsultaCNPJLote /></AppLayout>} />
            <Route path="/whatsapp" element={<AppLayout noPadding><WhatsAppChat /></AppLayout>} />
            <Route path="/whatsapp/instancias" element={<AppLayout noPadding><WhatsAppInstancias /></AppLayout>} />
            <Route path="/whatsapp/ajustes" element={<AppLayout noPadding><WhatsAppAjustes /></AppLayout>} />
            <Route path="/relatorios-comissoes" element={<AppLayout><RelatoriosComissoes /></AppLayout>} />
            <Route path="/cadastro-vendedores" element={<AppLayout><CadastroVendedores /></AppLayout>} />
            <Route path="/usuarios" element={<AppLayout><Usuarios /></AppLayout>} />
            <Route path="/revendas" element={<AppLayout><Revendas /></AppLayout>} />
            <Route path="/financeiro/clientes" element={<AppLayout><BoletosWhatsApp initialTab="clientes" /></AppLayout>} />
            <Route path="/financeiro/boletos" element={<AppLayout><BoletosWhatsApp /></AppLayout>} />
            <Route path="/future-remote" element={<AppLayout><FutureRemoteDashboard /></AppLayout>} />
            <Route path="/future-remote/solicitacoes" element={<Navigate to="/future-remote/computadores" replace />} />
            <Route path="/future-remote/computadores" element={<AppLayout><RemoteComputadores /></AppLayout>} />
            <Route path="/future-remote/historico" element={<AppLayout><RemoteHistorico /></AppLayout>} />
            <Route path="/future-remote/configuracoes" element={<AppLayout><RemoteConfiguracoes /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>

        <PWAInstallPrompt />
      </SectorsProvider>
    </AppProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/comparacao/:id" element={<PublicComparison />} />
              <Route path="/suporte" element={<Suporte />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>

        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
