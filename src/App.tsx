import { lazy, Suspense } from "react";
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

// Rotas carregadas sob demanda (app mais leve e inicialização mais rápida)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const GestorDashboard = lazy(() => import("@/pages/GestorDashboard"));
const CRMKanban = lazy(() => import("@/pages/CRMKanban"));
const LeadsPage = lazy(() => import("@/pages/LeadsPage"));
const Comparador = lazy(() => import("@/pages/Comparador"));
const GerarLink = lazy(() => import("@/pages/GerarLink"));
const PublicComparison = lazy(() => import("@/pages/PublicComparison"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Argumentos = lazy(() => import("@/pages/Argumentos"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Chat = lazy(() => import("@/pages/Chat"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Metas = lazy(() => import("@/pages/Metas"));
const Notas = lazy(() => import("@/pages/Notas"));
const ParceirosDashboard = lazy(() => import("@/pages/parceiros-spc/ParceirosDashboard"));
const Parceiros = lazy(() => import("@/pages/parceiros-spc/Parceiros"));
const ClientesIndicados = lazy(() => import("@/pages/parceiros-spc/ClientesIndicados"));
const ParceirosRelatorios = lazy(() => import("@/pages/parceiros-spc/Relatorios"));
const ConsultaSPC = lazy(() => import("@/pages/ConsultaSPC"));
const WhatsAppChat = lazy(() => import("@/pages/WhatsAppChat"));
const WhatsAppInstancias = lazy(() => import("@/pages/WhatsAppInstancias"));
const WhatsAppAjustes = lazy(() => import("@/pages/WhatsAppAjustes"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
            <Route path="/parceiros-spc/relatorios" element={<AppLayout><ParceirosRelatorios /></AppLayout>} />
            <Route path="/consultas" element={<AppLayout><ConsultaSPC /></AppLayout>} />
            <Route path="/whatsapp" element={<AppLayout><WhatsAppChat /></AppLayout>} />
            <Route path="/whatsapp/instancias" element={<AppLayout><WhatsAppInstancias /></AppLayout>} />
            <Route path="/whatsapp/ajustes" element={<AppLayout><WhatsAppAjustes /></AppLayout>} />
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
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>

        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
