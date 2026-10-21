import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownToLine, Laptop, Monitor, ShieldCheck, Apple } from 'lucide-react';

const CRM_PUBLIC_URL = 'https://crm.futuresolucoes.com.br';
const INSTALLER_BASE = 'https://jhmdavcidwqycjedvgoz.supabase.co/storage/v1/object/public/future-remote-installers';
const WINDOWS_64_URL = `${INSTALLER_BASE}/future-rustdesk-win64.exe`;
const WINDOWS_32_URL = `${INSTALLER_BASE}/future-rustdesk-win32.exe`;
const MAC_UNIVERSAL_URL = `${INSTALLER_BASE}/future-rustdesk-mac-universal.dmg`;

const DownloadButton = ({ href, children }: { href: string; children: ReactNode }) => (
  <Button asChild className="h-11 w-full justify-center gap-2 text-sm font-semibold">
    <a href={href} target="_blank" rel="noopener noreferrer">
      <ArrowDownToLine size={18} />
      {children}
    </a>
  </Button>
);

const SuporteRustDesk = () => (
  <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute -right-24 top-48 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.14),transparent_58%)]" />
    </div>

    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <a href={CRM_PUBLIC_URL + '/suporte-rustdesk'} className="flex min-w-0 items-center gap-3" aria-label="Future Soluções — suporte RustDesk">
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
            FUTURE REMOTE · RUSTDESK
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Baixe o suporte remoto da Future
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Escolha o instalador de acordo com o seu computador. Depois de instalar, informe o ID exibido no RustDesk à equipe da Future Soluções para vincularmos o dispositivo ao seu cadastro.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          <Card className="relative overflow-hidden border-violet-300/50 bg-white text-slate-900 shadow-2xl shadow-violet-950/25 md:-translate-y-1">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
            <CardHeader className="pb-3 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Monitor size={24} />
                </div>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">Recomendado</span>
              </div>
              <CardTitle className="text-xl">Windows 64 bits</CardTitle>
              <CardDescription className="min-h-10 text-slate-600">Para a maioria dos computadores Windows atuais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DownloadButton href={WINDOWS_64_URL}>Baixar para Windows 64 bits</DownloadButton>
              <p className="text-xs leading-5 text-slate-500">Use esta opção se o Windows indicar sistema operacional de 64 bits.</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-sm">
            <CardHeader className="pb-3 pt-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                <Laptop size={24} />
              </div>
              <CardTitle className="text-xl text-white">Windows 32 bits</CardTitle>
              <CardDescription className="min-h-10 text-slate-300">Para computadores mais antigos com Windows de 32 bits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DownloadButton href={WINDOWS_32_URL}>Baixar para Windows 32 bits</DownloadButton>
              <p className="text-xs leading-5 text-slate-400">Se estiver em dúvida, confira “Tipo de sistema” nas configurações do Windows.</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-sm">
            <CardHeader className="pb-3 pt-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                <Apple size={24} />
              </div>
              <CardTitle className="text-xl text-white">Apple macOS</CardTitle>
              <CardDescription className="min-h-10 text-slate-300">Pacote Universal para Macs compatíveis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DownloadButton href={MAC_UNIVERSAL_URL}>Baixar para Mac</DownloadButton>
              <p className="text-xs leading-5 text-slate-400">Compatibilidade conforme a versão do macOS e o pacote disponibilizado.</p>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-sm leading-6 text-slate-300">
          <p className="font-semibold text-white">Como iniciar o suporte</p>
          <p className="mt-1">Após abrir o RustDesk, informe à equipe da Future o ID que aparece na tela. O atendente vinculará o dispositivo ao cadastro correto. A conexão remota exige a autenticação e a autorização aplicáveis.</p>
          <p className="mt-3 text-xs text-slate-400">Os instaladores personalizados da Future precisam ser enviados ao armazenamento antes de liberar esta página para os clientes.</p>
        </div>

        <div className="mt-8 text-center">
          <a href={CRM_PUBLIC_URL + '/suporte'} className="text-sm font-medium text-violet-200 underline underline-offset-4 hover:text-white">
            Ir para o suporte via MeshCentral
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        Future Soluções · Suporte remoto seguro, com autorização do usuário
      </footer>
    </div>
  </main>
);

export default SuporteRustDesk;
