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
import Dashboard from "@/pages/Dashboard";
import GestorDashboard from "@/pages/GestorDashboard";
import CRMKanban from "@/pages/CRMKanban";
import LeadsPage from "@/pages/LeadsPage";
import Comparador from "@/pages/Comparador";
import GerarLink from "@/pages/GerarLink";
import PublicComparison from "@/pages/PublicComparison";
import Agenda from "@/pages/Agenda";
import Argumentos from "@/pages/Argumentos";
import Produtos from "@/pages/Produtos";
import Relatorios from "@/pages/Relatorios";
import Chat from "@/pages/Chat";
import Auth from "@/pages/Auth";
import Perfil from "@/pages/Perfil";
import NotFound from "./pages/NotFound";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const queryClient = new QueryClient();

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
      <ErrorBoundary>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      <PWAInstallPrompt />
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
          <Routes>
            <Route path="/comparacao/:id" element={<PublicComparison />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
