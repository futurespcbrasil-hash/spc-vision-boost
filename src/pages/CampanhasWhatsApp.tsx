import { MessageCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CampanhasWhatsApp = () => (
  <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
    <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="h-6 w-6" /> Campanhas — WhatsApp</h1>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Próxima etapa</CardTitle>
        <CardDescription>O módulo de campanhas por WhatsApp ficará separado das conversas e instâncias atuais.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Estamos começando pelo E-mail Marketing. Quando esta etapa estiver validada, este espaço poderá receber importação de contatos, modelos de mensagem, fila gradual e relatórios para WhatsApp.
      </CardContent>
    </Card>
  </div>
);

export default CampanhasWhatsApp;
