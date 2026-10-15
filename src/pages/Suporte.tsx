import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Download, Monitor, ShieldCheck } from 'lucide-react';

// Link público direto do MeshCentral, sem depender de consulta à Edge Function.
const AGENT_DOWNLOAD_URL = 'https://future-remote.duckdns.org/agentinvite?c=xQjX82Y$4LSrmWsJs8FzYPKaatOVMl2RhmfsbGpOVq3TwBBc45C@sGMW$vA8J$r8L5FITL6JK8AByIqsitWRKjx0xYn2h8JfMFAXUP6ssJgz$Y$MXvVk@8qB7QocwyjvMgMUMsnSBTJACWFlasYtTarQwQoIkHAzmZrvd1VbdDtENWcLjk$E77DYjPbUZjQ7oiPVg7o=';

const Suporte = () => {
  return (
    <main className="min-h-screen gradient-spc flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center space-y-3">
            <img src="/logo-future.png" alt="Future Soluções" className="mx-auto h-10 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
              <p className="text-sm text-muted-foreground">Suporte remoto Future Soluções</p>
            </div>
            <p className="text-sm text-foreground">
              Siga as etapas abaixo para preparar seu computador para o atendimento remoto.
            </p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary"><Monitor size={20} /></div>
              <div className="flex-1 space-y-1">
                <h2 className="font-semibold text-foreground">1. Identifique seu sistema</h2>
                <p className="text-sm text-muted-foreground">
                  Confira se seu computador usa Windows ou macOS e selecione a versão correspondente na página de downloads.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary"><Download size={20} /></div>
              <div className="flex-1 space-y-1">
                <h2 className="font-semibold text-foreground">2. Baixe e instale</h2>
                <p className="text-sm text-muted-foreground">
                  Abra o arquivo baixado e siga as instruções. Se o sistema pedir confirmação ou permissões para instalar, confira se a solicitação corresponde ao aplicativo de suporte que você acabou de baixar antes de permitir.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary"><CheckCircle2 size={20} /></div>
              <div className="flex-1 space-y-1">
                <h2 className="font-semibold text-foreground">3. Abra o aplicativo</h2>
                <p className="text-sm text-muted-foreground">
                  Após a instalação, abra o aplicativo instalado novamente. Se aparecer a opção Conectar, clique nela e aguarde a conexão.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2 text-primary"><ShieldCheck size={20} /></div>
              <div className="flex-1 space-y-1">
                <h2 className="font-semibold text-foreground">4. Avise o suporte e autorize o acesso</h2>
                <p className="text-sm text-muted-foreground">
                  Avise a equipe da Future Soluções que a instalação terminou. Quando aparecer uma mensagem solicitando autorização para a conexão remota, confira que você está aguardando esse atendimento e aceite para permitir o acesso.
                </p>
              </div>
            </div>
          </div>

          <Button asChild className="w-full h-12 text-base">
            <a href={AGENT_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <Download size={18} className="mr-2" />
              Baixar aplicativo de suporte
            </a>
          </Button>

          <div className="flex items-start justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <p>Instale o aplicativo somente quando o atendimento for esperado. O acesso remoto deve ser autorizado por você quando solicitado.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Suporte;
