import { ArrowDownToLine, ArrowRight, FileCheck2, FileSignature, LockKeyhole, ShieldCheck, CheckCircle2, MonitorDown, MessageCircle } from "lucide-react";

const DOWNLOAD_URL = "https://jhmdavcidwqycjedvgoz.supabase.co/storage/v1/object/public/future-remote-installers/AssinaPDF-CrossPlatform-Setup-x64.msi?download";
const WHATSAPP_URL = "https://wa.me/5554981028290?text=" + encodeURIComponent("Olá! Quero saber mais sobre o AssinaPDF da Future Soluções.");

export default function FutureAssinadorLanding() {
  return (
    <main className="min-h-screen bg-[#faf9ff] text-slate-900">
      <header className="border-b border-violet-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href="/assinar" className="flex items-center gap-3" aria-label="Future AssinaPDF">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-700 text-white"><FileSignature size={24} /></span>
            <span><strong className="block text-lg font-black">Future <span className="text-violet-700">AssinaPDF</span></strong><span className="block text-xs text-slate-500">Uma solução Future Soluções</span></span>
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-bold text-violet-800 hover:bg-violet-50 sm:inline-flex"><MessageCircle size={17} /> Falar com a Future</a>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.17),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.10),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-violet-800"><ShieldCheck size={15} /> Assinatura digital de PDFs</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">Assine seus PDFs com praticidade e segurança.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Conheça o AssinaPDF da Future Soluções: um aplicativo para facilitar a assinatura e a validação de documentos PDF no seu computador.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={DOWNLOAD_URL} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-4 font-extrabold text-white shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:bg-violet-800"><ArrowDownToLine size={19} /> Baixar AssinaPDF para Windows 64 bits</a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 font-bold text-slate-700 hover:border-violet-200 hover:bg-violet-50">Falar com um especialista <ArrowRight size={17} /></a>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Instalador para Windows 64 bits. O download depende da disponibilidade pública do arquivo no Supabase.</p>
          </div>

          <div className="rounded-[2rem] border border-violet-100 bg-white p-7 shadow-2xl shadow-violet-900/10 sm:p-9">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-800"><FileCheck2 size={32} /></div>
            <h2 className="mt-6 text-2xl font-black">Documentos digitais, sem complicação.</h2>
            <p className="mt-3 leading-7 text-slate-600">Uma ferramenta da Future Soluções para apoiar sua rotina de documentos eletrônicos.</p>
            <ul className="mt-7 space-y-4">
              {[
                ["Assinatura de PDFs", "Prepare documentos para assinatura digital."],
                ["Validação", "Confira informações das assinaturas presentes no PDF."],
                ["Certificado digital", "Fluxo local com certificado compatível, conforme a versão instalada."],
                ["Privacidade", "Mantenha certificados e senhas sob seu controle; nunca compartilhe sua chave privada."],
              ].map(([title, description]) => <li key={title} className="flex items-start gap-3"><span className="mt-0.5 text-violet-700"><CheckCircle2 size={20} /></span><span><strong className="block">{title}</strong><span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span></span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-violet-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3">
          <div className="flex items-center gap-3"><MonitorDown className="shrink-0 text-violet-700" size={25} /><div><strong className="block">Windows 64 bits</strong><span className="text-sm text-slate-500">Instalador para computadores compatíveis.</span></div></div>
          <div className="flex items-center gap-3"><LockKeyhole className="shrink-0 text-violet-700" size={25} /><div><strong className="block">Privacidade em primeiro lugar</strong><span className="text-sm text-slate-500">Não envie senhas ou arquivos de certificado a terceiros.</span></div></div>
          <div className="flex items-center gap-3"><ShieldCheck className="shrink-0 text-violet-700" size={25} /><div><strong className="block">Suporte Future</strong><span className="text-sm text-slate-500">Conte com nossa equipe para orientação.</span></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-20">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Pronto para conhecer o AssinaPDF?</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Baixe o instalador para Windows 64 bits ou fale com nossa equipe para tirar dúvidas sobre instalação e compatibilidade.</p>
        <a href={DOWNLOAD_URL} className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-7 py-4 font-extrabold text-white shadow-lg hover:bg-violet-800"><ArrowDownToLine size={19} /> Baixar instalador</a>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-bold text-slate-700">Future Soluções · AssinaPDF</span>
          <a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="hover:text-violet-700">futuresolucoes.com.br</a>
          <span>© {new Date().getFullYear()} Future Soluções</span>
        </div>
      </footer>
    </main>
  );
}
