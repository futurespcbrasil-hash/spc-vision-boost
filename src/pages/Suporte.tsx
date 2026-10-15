import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Download, Loader2, Monitor, ShieldCheck } from 'lucide-react';
import { getAgentDownloadUrl } from '@/services/meshCentralService';

const Suporte = () => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getAgentDownloadUrl()
      .then((res) => {
        if (active) setDownloadUrl(res?.agent_download_url ?? null);
      })
      .catch(() => {
        if (active) setDownloadUrl(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

          {downloadUrl ? (
            <Button asChild className="w-full h-12 text-base">
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download size={18} className="mr-2" />
                Baixar aplicativo de suporte
              </a>
            </Button>
          ) : loading ? (
            <Button className="w-full h-12 text-base" disabled>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Preparando link de download...
            </Button>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>Não foi possível carregar a página de downloads. Tente atualizar esta página ou entre em contato com o suporte da Future Soluções.</p>
            </div>
          )}

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
