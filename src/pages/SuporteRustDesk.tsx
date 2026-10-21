import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownToLine, Laptop, Monitor, ShieldCheck, Apple, ExternalLink } from 'lucide-react';

const CRM_PUBLIC_URL = 'https://crm.futuresolucoes.com.br';
const WINDOWS_64_URL = 'https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-x86_64.exe';
const WINDOWS_32_URL = 'https://github.com/rustdesk/rustdesk/releases/download/1.5.0/rustdesk-1.5.0-x86-sciter.exe';
// O projeto não publica um único DMG universal na versão atual; a página oficial lista builds Intel e Apple Silicon.
const MAC_DOWNLOADS_URL = 'https://github.com/rustdesk/rustdesk/releases/latest';

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
          Acesso com autorização
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl flex-1 py-10 sm:py-14 lg:py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-violet-100">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            SUPORTE REMOTO · RUSTDESK
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Baixe o RustDesk para receber suporte
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Baixe a versão oficial adequada ao seu computador. Abra o RustDesk e informe à equipe da Future Soluções o ID exibido na tela. Não é necessário configurar servidor ou chave.
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
              <p className="text-xs leading-5 text-slate-500">Download oficial do projeto RustDesk.</p>
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
              <p className="text-xs leading-5 text-slate-400">Versão legada oficial. Use apenas se seu Windows for de 32 bits.</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.06] text-white shadow-xl shadow-black/10 backdrop-blur-sm">
            <CardHeader className="pb-3 pt-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
                <Apple size={24} />
              </div>
              <CardTitle className="text-xl text-white">Apple macOS</CardTitle>
              <CardDescription className="min-h-10 text-slate-300">Escolha a versão adequada ao seu Mac: Intel ou Apple Silicon.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DownloadButton href={MAC_DOWNLOADS_URL}>Abrir downloads oficiais para Mac</DownloadButton>
              <p className="text-xs leading-5 text-slate-400">Na página oficial, escolha o arquivo DMG correspondente ao processador do Mac.</p>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-sm leading-6 text-slate-300">
          <p className="font-semibold text-white">Como iniciar o suporte</p>
          <p className="mt-1">1. Baixe e abra o RustDesk oficial. 2. Informe à equipe da Future o ID que aparece na tela. 3. Confira a solicitação e autorize a conexão quando estiver pronto. Não compartilhe sua senha permanente nem permita acesso que você não reconheça.</p>
          <p className="mt-3 text-xs text-slate-400">Esta opção usa os servidores públicos do RustDesk. O RustDesk não é integrado ao cadastro ou ao controle de sessões do CRM da Future; o suporte é iniciado pelo ID informado pelo cliente.</p>
        </div>

        <div className="mt-3 text-center">
          <a href="https://rustdesk.com/pt/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 underline underline-offset-4 hover:text-white">
            Site oficial do RustDesk <ExternalLink size={12} />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        Future Soluções · Suporte remoto com autorização do usuário
      </footer>
    </div>
  </main>
);

export default SuporteRustDesk;
