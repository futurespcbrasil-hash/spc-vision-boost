import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Laptop,
  Monitor,
  ShieldCheck,
} from 'lucide-react';

// Links oficiais dos agentes do MeshCentral fornecidos pela Future Soluções.
// O link anterior do botão foi preservado em docs/backups/FUTURE-REMOTE-DOWNLOAD-LINKS.2026-10-19.md.
const CRM_PUBLIC_URL = 'https://crm.futuresolucoes.com.br';
const WINDOWS_64_URL = 'https://future-remote.duckdns.org/meshagents?id=4&meshid=2HvEW0BjOwhWEmztqpDdJHEBM1dk7UKVgoBYm6MMTczwSJbSDmKORHZuDRC57W$zEPkDAWRhUiy7p34kgGWuLniy17e$hZ$a4g9LNlTr2VquYfTYRF63zKc@93ujBOyVzdi19nBAHALrk4YNSFtknHuzLX69rg==';
const WINDOWS_32_URL = 'https://future-remote.duckdns.org/meshagents?id=3&meshid=2HvEW0BjOwhWEmztqpDdJHEBM1dk7UKVgoBYm6MMTczwSJbSDmKORHZuDRC57W$zEPkDAWRhUiy7p34kgGWuLniy17e$hZ$a4g9LNlTr2VquYfTYRF63zKc@93ujBOyVzdi19nBAHALrk4YNSFtknHuzLX69rg==';
const MAC_UNIVERSAL_URL = 'https://future-remote.duckdns.org/meshosxagent?id=10005&meshid=2HvEW0BjOwhWEmztqpDdJHEBM1dk7UKVgoBYm6MMTczwSJbSDmKORHZuDRC57W$zEPkDAWRhUiy7p34kgGWuLniy17e$hZ$a4g9LNlTr2VquYfTYRF63zKc@93ujBOyVzdi19nBAHALrk4YNSFtknHuzLX69rg==';

const DownloadButton = ({ href, children }: { href: string; children: ReactNode }) => (
  <Button asChild className="h-11 w-full justify-center gap-2 text-sm font-semibold">
    <a href={href} target="_blank" rel="noopener noreferrer">
      <ArrowDownToLine size={18} />
      {children}
    </a>
  </Button>
);

type DetectionResult = 'windows64' | 'mac' | 'windowsUnknown' | 'unknown';

const Suporte = () => {
  const [detection, setDetection] = useState<DetectionResult | null>(null);

  const detectSystem = () => {
    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const browserNavigator = navigator as Navigator & {
      userAgentData?: {
        platform?: string;
        architecture?: string;
        bitness?: string;
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string; platform?: string }>;
      };
    };
    const platformInfo = browserNavigator.userAgentData?.platform || platform;
    const isMac = /mac/i.test(platformInfo) || /Macintosh|Mac OS X/i.test(userAgent);
    const isWindows = /win/i.test(platformInfo) || /Windows/i.test(userAgent);

    if (isMac) {
      setDetection('mac');
      return;
    }
    if (!isWindows) {
      setDetection('unknown');
      return;
    }

    const userAgentData = browserNavigator.userAgentData;
    if (userAgentData?.getHighEntropyValues) {
      userAgentData.getHighEntropyValues(['architecture', 'bitness']).then((details) => {
        const architecture = details.architecture || userAgentData.architecture || '';
        const bitness = details.bitness || userAgentData.bitness || '';
        if (bitness === '64' || /x86_64|x64|arm64|aarch64/i.test(architecture)) {
          setDetection('windows64');
        } else {
          setDetection('windowsUnknown');
        }
      }).catch(() => setDetection(/Win64|x64|WOW64|x86_64|amd64/i.test(userAgent) ? 'windows64' : 'windowsUnknown'));
      return;
    }

    if (/Win64|x64|WOW64|x86_64|amd64/i.test(userAgent)) {
      setDetection('windows64');
    } else {
      setDetection('windowsUnknown');
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-24 top-48 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.14),transparent_58%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <a href={CRM_PUBLIC_URL + '/suporte'} className="flex min-w-0 items-center gap-3" aria-label="Future Soluções — página de suporte">
            
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide text-white sm:text-base">Future Soluções</p>
              <p className="text-xs text-slate-400">Suporte técnico remoto</p>
            </div>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 sm:flex">
            <ShieldCheck size={14} />
            Conexão com sua autorização
          </div>
        </header>

        <section className="mx-auto w-full max-w-4xl flex-1 py-10 sm:py-14 lg:py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-violet-100">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              FUTURE REMOTE
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Vamos preparar seu computador para o suporte?
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
              Escolha abaixo o instalador certo para seu dispositivo. O download é direto, sem precisar navegar por uma lista de sistemas e ferramentas.
            </p>
          </div>

          <div className="mx-auto mb-7 max-w-2xl text-center">
            <Button type="button" onClick={detectSystem} className="h-12 gap-2 px-6 text-sm font-semibold shadow-lg shadow-violet-950/30">
              <Laptop size={18} />
              Clique aqui para detectar a versão do seu sistema
            </Button>
            {detection && (
              <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left sm:p-5">
                {detection === 'windows64' && (
                  <>
                    <p className="font-semibold text-emerald-200">Detectamos Windows de 64 bits.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Clique em <strong className="text-white">Baixar para Windows 64 bits</strong> abaixo. Se o instalador não funcionar, confira o “Tipo de sistema” nas configurações do Windows.</p>
                  </>
                )}
                {detection === 'mac' && (
                  <>
                    <p className="font-semibold text-emerald-200">Detectamos um Mac (macOS).</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Clique em <strong className="text-white">Baixar para Mac</strong>. O instalador Universal é a opção disponibilizada para macOS.</p>
                  </>
                )}
                {detection === 'windowsUnknown' && (
                  <>
                    <p className="font-semibold text-amber-200">Detectamos Windows, mas não foi possível confirmar se é 32 ou 64 bits.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Veja como conferir manualmente:</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-300">
                      <li>Abra o menu <strong className="text-white">Iniciar</strong> e entre em <strong className="text-white">Configurações</strong>.</li>
                      <li>Selecione <strong className="text-white">Sistema</strong> e depois <strong className="text-white">Sobre</strong>.</li>
                      <li>Na seção <strong className="text-white">Especificações do dispositivo</strong>, procure <strong className="text-white">Tipo de sistema</strong>.</li>
                      <li>Se aparecer “sistema operacional de 64 bits”, baixe Windows 64 bits. Se aparecer “sistema operacional de 32 bits”, baixe Windows 32 bits.</li>
                    </ol>
                    <p className="mt-2 text-xs leading-5 text-slate-400">Atalho: pressione Windows + Pause/Break para abrir a página de informações do sistema, se o teclado tiver essa tecla.</p>
                  </>
                )}
                {detection === 'unknown' && (
                  <>
                    <p className="font-semibold text-amber-200">Não foi possível identificar o sistema automaticamente.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Escolha manualmente uma das opções abaixo. Se estiver usando Windows, siga os passos de “Não sabe qual versão do Windows escolher?” para confirmar se é 32 ou 64 bits.</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            <Card className="relative overflow-hidden border-violet-300/50 bg-white text-slate-900 shadow-2xl shadow-violet-950/25 md:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
              <CardHeader className="pb-3 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Monitor size={24} />
                  </div>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                    Recomendado
                  </span>
                </div>
                <CardTitle className="text-xl">Windows 64 bits</CardTitle>
                <CardDescription className="min-h-10 text-slate-600">
                  Para a maioria dos computadores Windows atuais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DownloadButton href={WINDOWS_64_URL}>Baixar para Windows 64 bits</DownloadButton>
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                  Escolha esta opção se o Windows indicar sistema operacional de 64 bits.
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardHeader className="pb-3 pt-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                  <Laptop size={24} />
                </div>
                <CardTitle className="text-xl text-white">Windows 32 bits</CardTitle>
                <CardDescription className="min-h-10 text-slate-300">
                  Para computadores mais antigos com Windows de 32 bits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DownloadButton href={WINDOWS_32_URL}>Baixar para Windows 32 bits</DownloadButton>
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                  <CircleHelp size={15} className="mt-0.5 shrink-0 text-violet-200" />
                  Se estiver em dúvida, confira o tipo de sistema nas configurações do Windows.
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardHeader className="pb-3 pt-6">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                  <Laptop size={24} />
                </div>
                <CardTitle className="text-xl text-white">Apple macOS</CardTitle>
                <CardDescription className="min-h-10 text-slate-300">
                  Instalador Universal para Macs compatíveis, Intel ou Apple Silicon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DownloadButton href={MAC_UNIVERSAL_URL}>Baixar para Mac</DownloadButton>
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-400">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />
                  Após baixar, use o botão direito ou Control + clique e selecione “Abrir”.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                <CircleHelp size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-white">Não sabe qual versão do Windows escolher?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Abra <strong className="text-white">Configurações → Sistema → Sobre</strong> e procure por “Tipo de sistema”. Se aparecer “sistema operacional de 64 bits”, escolha o primeiro botão; se indicar 32 bits, escolha o segundo.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 sm:grid-cols-[auto_1fr] sm:items-start sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h2 className="font-semibold text-emerald-100">Você mantém o controle do acesso</h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Instale o aplicativo somente se você solicitou ou está esperando atendimento da Future Soluções. Avise nossa equipe quando terminar. Autorize a sessão no computador apenas quando reconhecer o atendimento e a solicitação de conexão.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">Precisa de ajuda para instalar?</p>
            <p className="mt-1 text-sm text-slate-300">
              Entre em contato com a equipe que está atendendo você e informe em qual etapa precisa de ajuda.
            </p>
            <a
              href={CRM_PUBLIC_URL + '/suporte'}
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-200 transition-colors hover:text-white"
            >
              Página oficial de suporte Future Soluções
              <ChevronRight size={14} />
            </a>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Future Soluções <span className="mx-1.5 text-slate-700">•</span> Future Remote
        </footer>
      </div>
    </main>
  );
};

export default Suporte;
