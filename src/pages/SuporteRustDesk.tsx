import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownToLine, Monitor, ShieldCheck } from 'lucide-react';

const WINDOWS_64_URL =
  'https://jhmdavcidwqycjedvgoz.supabase.co/storage/v1/object/public/future-remote-installers/rustdesk-1.5.1-x86_64.msi?download';

const SuporteRustDesk = () => (
  <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute -right-24 top-48 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.14),transparent_58%)]" />
    </div>

    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white sm:text-base">Future Soluções</p>
            <p className="text-xs text-slate-400">Suporte técnico remoto</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 sm:flex">
          <ShieldCheck size={14} />
          Acesso com autorização
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-12 text-center sm:py-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-violet-100">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
          SUPORTE REMOTO · FUTURE REMOTE
        </div>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Baixe o Future Remote
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
          Para receber suporte técnico da Future Soluções, baixe o instalador para Windows 64 bits,
          execute o arquivo e informe à nossa equipe o ID exibido no programa.
        </p>

        <Card className="relative mt-9 w-full max-w-lg overflow-hidden border-violet-300/50 bg-white text-slate-900 shadow-2xl shadow-violet-950/25">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
          <CardHeader className="items-center pb-3 pt-7">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Monitor size={30} />
            </div>
            <CardTitle className="text-2xl">Windows 64 bits</CardTitle>
            <CardDescription className="text-slate-600">
              Instalador oficial personalizado da Future Soluções para computadores Windows 64 bits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-7">
            <Button asChild className="h-12 w-full justify-center gap-2 text-sm font-semibold">
              <a href={WINDOWS_64_URL}>
                <ArrowDownToLine size={18} />
                Baixar Future Remote – Windows 64 bits
              </a>
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              Compatível com Windows 10 e Windows 11 de 64 bits.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 w-full max-w-2xl border border-white/10 bg-white/[0.05] p-5 text-left text-sm leading-6 text-slate-300 sm:p-6">
          <p className="font-semibold text-white">Como iniciar o suporte</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Baixe e instale o Future Remote.</li>
            <li>Abra o programa e informe à equipe da Future o ID exibido na tela.</li>
            <li>Confira a solicitação e autorize a conexão somente quando estiver pronto.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            Nunca compartilhe sua senha permanente nem permita acesso remoto que você não reconheça.
            Você pode encerrar a conexão a qualquer momento.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        Future Soluções · Suporte remoto com autorização do usuário
      </footer>
    </div>
  </main>
); 

export default SuporteRustDesk;
