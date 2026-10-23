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
const ManualEmissor = lazyWithRetry(() => import("@/pages/ManualEmissor"));
const PortalPublico = lazyWithRetry(() => import("@/pages/PortalPublico"));
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const GestorDashboard = lazyWithRetry(() => import("@/pages/GestorDashboard"));
const CRMKanban = lazyWithRetry(() => import("@/pages/CRMKanban"));
const LeadsPage = lazyWithRetry(() => import("@/pages/LeadsPage"));
const PublicComparison = lazyWithRetry(() => import("@/pages/PublicComparison"));
const Agenda = lazyWithRetry(() => import("@/pages/Agenda"));
const Argumentos = lazyWithRetry(() => import("@/pages/Argumentos"));
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
const ComissoesIndicacoesSistema = lazyWithRetry(() => import("@/pages/ComissoesIndicacoesSistema"));
const CadastroVendedores = lazyWithRetry(() => import("@/pages/CadastroVendedores"));
const Usuarios = lazyWithRetry(() => import("@/pages/Usuarios"));
const Suporte = lazyWithRetry(() => import("@/pages/Suporte"));
const SuporteRustDesk = lazyWithRetry(() => import("@/pages/SuporteRustDesk"));
const FutureRemoteDashboard = lazyWithRetry(() => import("@/pages/remote/FutureRemoteDashboard"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const BoletosWhatsApp = lazyWithRetry(() => import("@/pages/BoletosWhatsApp"));
const EmailMarketing = lazyWithRetry(() => import("@/pages/EmailMarketing"));
const CampanhasWhatsApp = lazyWithRetry(() => import("@/pages/CampanhasWhatsApp"));

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
            <Route element={<AppLayout />}>
            <Route path="/manual" element={<ManualEmissor />} />
            <Route path="/" element={role === 'gestor' ? <GestorDashboard /> : <Dashboard />} />
            <Route path="/crm" element={<CRMKanban />} />
            <Route path="/crm-comercial" element={<Navigate to="/crm" replace />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/produtos" element={<Navigate to="/" replace />} />
            <Route path="/comparador" element={<Navigate to="/" replace />} />
            <Route path="/gerar-link" element={<Navigate to="/" replace />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/argumentos" element={<Argumentos />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/notas" element={<Notas />} />
            <Route path="/parceiros-spc" element={<ParceirosDashboard />} />
            <Route path="/parceiros-spc/parceiros" element={<Parceiros />} />
            <Route path="/parceiros-spc/clientes" element={<ClientesIndicados />} />
            <Route path="/indicacoes/clientes" element={<ClientesIndicadosAtendimento />} />
            <Route path="/parceiros-spc/relatorios" element={<ParceirosRelatorios />} />
            <Route path="/consultas" element={<ConsultaSPC />} />
            <Route path="/consultas/cnpj" element={<ConsultaCNPJ />} />
            <Route path="/consultas/sintegra" element={<ConsultaSintegra />} />
            <Route path="/consultas/cnpj-lote" element={<ConsultaCNPJLote />} />
            <Route path="/campanhas/email" element={<EmailMarketing />} />
            <Route path="/campanhas/whatsapp" element={<CampanhasWhatsApp />} />
            <Route path="/whatsapp" element={<WhatsAppChat />} />
            <Route path="/whatsapp/instancias" element={<WhatsAppInstancias />} />
            <Route path="/whatsapp/ajustes" element={<WhatsAppAjustes />} />
            <Route path="/relatorios-comissoes" element={<RelatoriosComissoes />} />
            <Route path="/comissoes/indicacoes-sistema" element={<ComissoesIndicacoesSistema />} />
            <Route path="/cadastro-vendedores" element={<CadastroVendedores />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/revendas" element={<Navigate to="/" replace />} />
            <Route path="/financeiro/clientes" element={<BoletosWhatsApp initialTab="clientes" />} />
            <Route path="/financeiro/boletos" element={<BoletosWhatsApp />} />
            <Route path="/future-remote" element={<FutureRemoteDashboard />} />
            <Route path="/future-remote/solicitacoes" element={<Navigate to="/future-remote" replace />} />
            <Route path="/future-remote/computadores" element={<Navigate to="/future-remote" replace />} />
            <Route path="/future-remote/historico" element={<Navigate to="/future-remote" replace />} />
            <Route path="/future-remote/configuracoes" element={<Navigate to="/future-remote" replace />} />
            <Route path="*" element={<NotFound />} />

            </Route>          </Routes>
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
              <Route path="/portal/*" element={<PortalPublico />} />
              <Route path="/comparacao/:id" element={<PublicComparison />} />
              <Route path="/suporte" element={<Suporte />} />
              <Route path="/suporte-rustdesk" element={<SuporteRustDesk />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>

        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
