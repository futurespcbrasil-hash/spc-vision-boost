import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import CRMKanban from "@/pages/CRMKanban";
import LeadsPage from "@/pages/LeadsPage";
import Comparador from "@/pages/Comparador";
import GerarLink from "@/pages/GerarLink";
import PublicComparison from "@/pages/PublicComparison";
import Agenda from "@/pages/Agenda";
import Argumentos from "@/pages/Argumentos";
import Produtos from "@/pages/Produtos";
import Relatorios from "@/pages/Relatorios";
import WhatsAppContas from "@/pages/WhatsAppContas";
import WhatsAppConversas from "@/pages/WhatsAppConversas";
import WhatsAppEnviar from "@/pages/WhatsAppEnviar";
import WhatsAppTemplates from "@/pages/WhatsAppTemplates";
import WhatsAppDashboard from "@/pages/WhatsAppDashboard";
import WhatsAppConfig from "@/pages/WhatsAppConfig";
import NotFound from "./pages/NotFound";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/comparacao/:id" element={<PublicComparison />} />
            <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="/crm" element={<AppLayout><CRMKanban /></AppLayout>} />
            <Route path="/leads" element={<AppLayout><LeadsPage /></AppLayout>} />
            <Route path="/produtos" element={<AppLayout><Produtos /></AppLayout>} />
            <Route path="/comparador" element={<AppLayout><Comparador /></AppLayout>} />
            <Route path="/gerar-link" element={<AppLayout><GerarLink /></AppLayout>} />
            <Route path="/agenda" element={<AppLayout><Agenda /></AppLayout>} />
            <Route path="/argumentos" element={<AppLayout><Argumentos /></AppLayout>} />
            <Route path="/relatorios" element={<AppLayout><Relatorios /></AppLayout>} />
            <Route path="/whatsapp/contas" element={<AppLayout><WhatsAppContas /></AppLayout>} />
            <Route path="/whatsapp/conversas" element={<AppLayout><WhatsAppConversas /></AppLayout>} />
            <Route path="/whatsapp/enviar" element={<AppLayout><WhatsAppEnviar /></AppLayout>} />
            <Route path="/whatsapp/templates" element={<AppLayout><WhatsAppTemplates /></AppLayout>} />
            <Route path="/whatsapp/dashboard" element={<AppLayout><WhatsAppDashboard /></AppLayout>} />
            <Route path="/whatsapp/config" element={<AppLayout><WhatsAppConfig /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallPrompt />
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
