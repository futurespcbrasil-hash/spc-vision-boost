import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Monitor, ShieldCheck, Download, MessageCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const RUSTDESK_PUBLIC_URL = 'https://crm.futuresolucoes.com.br/suporte-rustdesk';

const FutureRemoteDashboard = () => {
  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(RUSTDESK_PUBLIC_URL);
      toast.success('Link público do RustDesk copiado');
    } catch {
      toast.error('Não foi possível copiar automaticamente. Copie o link exibido na tela.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Acesso Remoto</h1>
        <p className="text-sm text-muted-foreground">Suporte remoto sob demanda, iniciado e autorizado pelo cliente.</p>
      </div>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Monitor size={26} /></div>
            <div><CardTitle className="text-xl">RustDesk — Suporte remoto Future</CardTitle><CardDescription className="mt-1">Envie esta página ao cliente para baixar a versão correta.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Link público de suporte</p>
            <p className="break-all text-sm font-medium text-foreground">{RUSTDESK_PUBLIC_URL}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.open(RUSTDESK_PUBLIC_URL, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} className="mr-2" />Abrir página pública</Button>
            <Button variant="outline" onClick={copiarLink}><Copy size={16} className="mr-2" />Copiar link para o cliente</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle size={18} />Como iniciar um atendimento</CardTitle><CardDescription>Orientação rápida para a equipe Future.</CardDescription></CardHeader>
          <CardContent><ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span><span>Envie ao cliente o link público acima.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span><span>Peça para baixar a versão compatível, abrir o RustDesk e informar o ID exibido.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span><span>No computador do técnico, conecte usando o ID e siga a solicitação apresentada pelo aplicativo.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span><span>Comece o suporte somente após o cliente autorizar a conexão.</span></li>
          </ol></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck size={18} />Boas práticas de segurança</CardTitle><CardDescription>Suporte sob demanda, sem inventário de computadores.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" /><span>Confirme que o cliente solicitou o atendimento antes de conectar.</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" /><span>Oriente o cliente a acompanhar a sessão e fechar o RustDesk ao terminar.</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" /><span>Não solicite nem armazene senhas permanentes de acesso.</span></div>
            <div className="flex items-start gap-2"><Download size={17} className="mt-0.5 shrink-0 text-primary" /><span>A página pública contém downloads e instruções para Windows e Mac.</span></div>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"><strong className="text-foreground">MeshCentral:</strong> permanece instalado no servidor como alternativa administrativa. Os menus de computadores, histórico e configurações ficam ocultos no CRM; o fluxo diário passa a orientar a equipe pelo RustDesk.</div>
    </div>
  );
};
export default FutureRemoteDashboard;
