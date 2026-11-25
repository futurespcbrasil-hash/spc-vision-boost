import {
  ArrowDownToLine, ArrowRight, BadgeCheck, CheckCircle2, ChevronDown,
  Combine, FileCheck2, FileImage, FileSignature, Files, FileText, FolderOpen,
  Image, LockKeyhole, MessageCircle, Monitor, RotateCw, ShieldCheck,
  Sparkles, Stamp, Undo2, WandSparkles, Zap,
} from "lucide-react";

const DOWNLOAD_URL = "https://jhmdavcidwqycjedvgoz.supabase.co/storage/v1/object/public/future-remote-installers/AssinaPDF-CrossPlatform-Setup-x64.msi?download";
const WHATSAPP_URL = "https://wa.me/5554981028290?text=" + encodeURIComponent("Olá! Quero conhecer o AssinaPDF da Future Soluções.");

const features = [
  { icon: FileSignature, title: "Assinatura digital", text: "Assine documentos PDF com certificado digital instalado no computador, com posicionamento visual e motivo opcional." },
  { icon: Files, title: "Assinatura em lote", text: "Uma rotina pensada para agilizar o trabalho com vários documentos, reduzindo tarefas repetitivas." },
  { icon: BadgeCheck, title: "Validação de assinaturas", text: "Analise assinaturas presentes no PDF e consulte os detalhes técnicos e a integridade criptográfica." },
  { icon: WandSparkles, title: "Editor de PDF", text: "Trabalhe no documento com ferramentas de texto, imagem e formas, além de desfazer e refazer alterações." },
  { icon: Combine, title: "Combinar e organizar", text: "Reúna vários PDFs, reorganize páginas, gire documentos e salve um novo arquivo com a sequência desejada." },
  { icon: FileImage, title: "Conversão de arquivos", text: "Transforme imagens em PDF e exporte páginas de PDF para formatos de imagem." },
];

const fiscal = [
  ["NF-e → DANFE", "Importe XMLs autorizados, confira os dados e prepare o DANFE em PDF."],
  ["NFC-e → DANFCE", "Gere DANFCEs com QR Code, visualize, organize e exporte em lote."],
  ["CT-e → DACTE", "Gere DACTEs em PDF A4, agrupe por emitente e exporte individualmente, consolidados ou em ZIP."],
  ["NFS-e Nacional → DANFSe", "Gere DANFSe a partir de XMLs autorizados e exporte individualmente ou em PDF único."],
  ["MDF-e → DAMDFE", "Gere DAMDFE em PDF, visualize e consolide documentos."],
];

const steps = [
  ["01", "Abra o documento", "Selecione os PDFs ou XMLs diretamente no seu computador."],
  ["02", "Use a ferramenta", "Assine, valide, edite, organize ou converta conforme sua necessidade."],
  ["03", "Salve o resultado", "Exporte o novo arquivo no local que escolher, mantendo o original preservado nos fluxos de trabalho."],
];

export default function FutureAssinadorLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f7fb] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="/assinar" className="flex items-center gap-3" aria-label="Future AssinaPDF">
            <img src="/logo-future.png" alt="Future Soluções" className="h-10 w-auto max-w-[150px] object-contain" />
            <span className="hidden h-9 border-l border-slate-200 sm:block" />
            <span><strong className="block text-lg font-black tracking-tight">Assina<span className="text-violet-700">PDF</span></strong><span className="block text-[11px] text-slate-500">Documentos seguros. Processos simples.</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#recursos" className="hover:text-violet-700">Recursos</a>
            <a href="#fiscal" className="hover:text-violet-700">Documentos fiscais</a>
            <a href="#seguranca" className="hover:text-violet-700">Segurança</a>
            <a href="#duvidas" className="hover:text-violet-700">Dúvidas</a>
          </nav>
          <a href={DOWNLOAD_URL} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-violet-900/15 transition hover:-translate-y-0.5 hover:bg-violet-800"><ArrowDownToLine size={17} /> Baixar aplicativo</a>
        </div>
      </header>

      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_10%_5%,rgba(124,58,237,0.18),transparent_42%),radial-gradient(ellipse_at_95%_65%,rgba(14,165,233,0.12),transparent_35%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/85 px-3.5 py-2 text-xs font-extrabold uppercase tracking-[.13em] text-violet-800 shadow-sm"><Sparkles size={14} /> Produtividade para documentos digitais</div>
            <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.65rem]">Muito mais que assinar PDFs. <span className="text-violet-700">Tudo para trabalhar com documentos em um só lugar.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Assine e valide documentos, edite arquivos, combine páginas e converta documentos fiscais. Uma experiência desktop desenvolvida pela Future Soluções para simplificar sua rotina.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={DOWNLOAD_URL} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-4 font-extrabold text-white shadow-xl shadow-violet-900/20 transition hover:-translate-y-0.5 hover:bg-violet-800"><ArrowDownToLine size={19} /> Baixar para Windows 64 bits</a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-4 font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-800"><MessageCircle size={18} /> Falar com a Future</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><Monitor size={16} className="text-violet-700" /> Windows 64 bits</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole size={16} className="text-violet-700" /> Processamento local</span>
              <span className="inline-flex items-center gap-2"><Zap size={16} className="text-violet-700" /> Ferramentas integradas</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[590px]">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-violet-300/40 via-sky-200/30 to-indigo-300/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-5 py-4">
                <img src="/logo-future.png" alt="" className="h-7 w-auto" />
                <div className="ml-2"><div className="text-sm font-extrabold">AssinaPDF</div><div className="text-[10px] text-slate-500">Central de ferramentas</div></div>
                <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">Aplicativo desktop</span>
              </div>
              <div className="bg-[#292d36] px-4 py-3">
                <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-white/90">
                  {["Início", "Assinatura", "Validação", "Editar PDF", "Organizar", "Converter", "Atualizações"].map((item, i) => <span key={item} className={i === 0 ? "rounded-md bg-white/20 px-2.5 py-1.5" : "px-2.5 py-1.5"}>{item}</span>)}
                </div>
              </div>
              <div className="bg-[#f3f4f6] p-5 sm:p-7">
                <div className="text-xl font-bold text-slate-800">O que você deseja fazer?</div>
                <div className="mt-1 text-xs text-slate-500">Acesse rapidamente as principais ferramentas.</div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    [FileSignature, "Assinar PDF", "Certificado digital"],
                    [BadgeCheck, "Validar", "Integridade e assinaturas"],
                    [FolderOpen, "Abrir PDF", "Visualizar documentos"],
                    [WandSparkles, "Editar PDF", "Texto, imagem e formas"],
                    [Combine, "Organizar", "Combinar e ordenar"],
                    [FileImage, "Converter", "PDF, imagens e XML"],
                  ].map(([Icon, title, subtitle]: any) => <div key={title} className="min-h-[112px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><Icon size={21} className="text-violet-700" /><div className="mt-3 text-xs font-extrabold text-slate-800">{title}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{subtitle}</div></div>)}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-[10px] text-slate-500"><span>Future Soluções</span><span>Documentos seguros. Processos simples.</span></div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:flex"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><ShieldCheck size={20} /></span><span><strong className="block text-xs">Seus arquivos no seu computador</strong><span className="text-[10px] text-slate-500">Privacidade desde o início</span></span></div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4 lg:px-8">
          {[["01", "Assinar e validar", "Certificado digital e conferência"], ["02", "Editar", "Ferramentas para seus PDFs"], ["03", "Organizar", "Combinar e ordenar páginas"], ["04", "Converter", "Arquivos e documentos fiscais"]].map(([n,t,d]) => <div key={n} className="flex items-start gap-3"><span className="text-2xl font-black text-violet-200">{n}</span><div><div className="font-extrabold text-slate-800">{t}</div><div className="mt-1 text-xs leading-5 text-slate-500">{d}</div></div></div>)}
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center"><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-700">Um conjunto completo de ferramentas</span><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Mais controle sobre cada documento.</h2><p className="mt-4 leading-7 text-slate-600">Do primeiro arquivo ao PDF final, encontre recursos para executar tarefas comuns sem depender de vários programas diferentes.</p></div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({icon: Icon, title, text}) => <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/5"><span className="inline-flex rounded-xl bg-violet-50 p-3 text-violet-700 transition group-hover:bg-violet-700 group-hover:text-white"><Icon size={23}/></span><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
        </div>
      </section>

      <section id="fiscal" className="relative overflow-hidden bg-[#202532] py-20 text-white lg:py-24">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-300">Produtividade fiscal</span><h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Seus documentos fiscais também têm espaço aqui.</h2><p className="mt-5 leading-7 text-slate-300">Além das ferramentas de PDF, o AssinaPDF reúne fluxos para transformar XMLs fiscais em documentos PDF, com visualização e opções de exportação.</p><div className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200"><Files size={18} className="text-violet-300"/> Importação e geração de documentos fiscais</div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fiscal.map(([title,text]) => <div key={title} className="rounded-xl border border-white/10 bg-white/[.06] p-5 backdrop-blur"><div className="flex items-center gap-2 text-sm font-extrabold"><FileText size={17} className="text-violet-300"/>{title}</div><p className="mt-2 text-xs leading-5 text-slate-300">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-700">Editor de documentos</span><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Edite com ferramentas que fazem sentido.</h2><p className="mt-4 leading-7 text-slate-600">A central de edição foi pensada para trabalhar sobre uma cópia do arquivo, com recursos para inserir e ajustar conteúdo e acompanhar as alterações.</p><ul className="mt-7 space-y-3 text-sm text-slate-700">{["Inserção de texto e imagens", "Ferramentas de formas e seleção", "Desfazer e refazer alterações", "Zoom, navegação e visualização por páginas", "Salvar e exportar o resultado em PDF"].map(x=><li key={x} className="flex items-center gap-3"><CheckCircle2 size={18} className="shrink-0 text-emerald-600"/>{x}</li>)}</ul></div>
          <div className="rounded-[1.7rem] bg-gradient-to-br from-slate-800 to-[#30394b] p-5 shadow-2xl sm:p-7"><div className="rounded-xl border border-white/10 bg-[#171c25] p-4"><div className="flex items-center justify-between border-b border-white/10 pb-3"><div><div className="text-[10px] font-bold tracking-widest text-violet-300">FUTURE / ASSINAPDF STUDIO</div><div className="mt-1 text-sm font-semibold text-white">Documento.pdf</div></div><span className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Exportar PDF</span></div><div className="mt-4 grid grid-cols-[54px_1fr] gap-3"><div className="space-y-2">{[FileText, Image, Stamp, RotateCw, Undo2].map((Icon,i)=><div key={i} className="flex h-10 items-center justify-center rounded-lg bg-white/5 text-violet-200"><Icon size={18}/></div>)}</div><div className="rounded-lg bg-white p-5"><div className="mx-auto min-h-64 max-w-[250px] border border-slate-200 bg-white p-5 shadow-sm"><div className="h-2 w-2/3 rounded bg-slate-200"/><div className="mt-4 space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-1.5 rounded bg-slate-100" style={{width: i===4?"68%":"100%"}}/>)}</div><div className="mt-7 rounded border border-violet-300 bg-violet-50 p-3 text-[10px] font-semibold text-violet-800">Área de edição do documento</div></div></div></div></div></div>
        </div>
      </section>

      <section id="seguranca" className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-700">Privacidade e segurança</span><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Seus documentos sob seu controle.</h2><p className="mt-4 leading-7 text-slate-600">O aplicativo foi projetado para processar arquivos localmente. Os documentos não precisam ser enviados a um serviço online para os fluxos locais de edição e assinatura.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f5fc] p-5"><LockKeyhole className="text-violet-700" size={24}/><h3 className="mt-3 font-extrabold">Certificado no dispositivo</h3><p className="mt-2 text-sm leading-6 text-slate-600">A chave privada não deve ser exportada ou transmitida. O aplicativo utiliza o certificado disponível no ambiente do usuário.</p></div>
            <div className="rounded-2xl bg-[#f7f5fc] p-5"><ShieldCheck className="text-violet-700" size={24}/><h3 className="mt-3 font-extrabold">Arquivo original preservado</h3><p className="mt-2 text-sm leading-6 text-slate-600">Os fluxos de edição e assinatura trabalham com cópias ou geram um novo arquivo, evitando sobrescrever o original por padrão.</p></div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Importante sobre validação:</strong> a verificação criptográfica disponível analisa a integridade e os dados das assinaturas. Ela não atesta, por si só, cadeia de confiança, revogação ou carimbo do tempo, nem substitui uma validação oficial ICP-Brasil.</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center"><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-700">Simples de começar</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Sua rotina em três passos.</h2></div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map(([n,t,d])=><div key={n} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="text-3xl font-black text-violet-200">{n}</div><h3 className="mt-4 font-extrabold">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{d}</p></div>)}</div>
      </section>

      <section id="duvidas" className="bg-[#f0eef8] py-20">
        <div className="mx-auto max-w-4xl px-5"><div className="text-center"><span className="text-xs font-extrabold uppercase tracking-[.18em] text-violet-700">Perguntas frequentes</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Antes de baixar</h2></div>
          <div className="mt-10 divide-y divide-violet-200 rounded-2xl border border-violet-200 bg-white px-6">
            {[
              ["Em qual sistema funciona?", "O instalador disponibilizado nesta página é para Windows 64 bits."],
              ["Preciso enviar meus PDFs para a internet?", "Os recursos locais do aplicativo foram projetados para processar os documentos no próprio computador."],
              ["Posso usar meu certificado digital?", "A assinatura utiliza certificados digitais disponíveis no ambiente do sistema operacional e compatíveis com a versão instalada."],
              ["A validação garante conformidade ICP-Brasil?", "A verificação criptográfica do aplicativo não substitui uma validação completa de cadeia de confiança, revogação e carimbo do tempo. Consulte também o serviço oficial aplicável."],
              ["As conversões de Word e Excel já estão disponíveis?", "PDF para Word, Word para PDF e Excel para Word/PDF aparecem no projeto como conversões em desenvolvimento; não são anunciadas como recursos liberados nesta versão."],
            ].map(([q,a])=><details key={q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-800">{q}<ChevronDown size={18} className="shrink-0 text-violet-700 transition group-open:rotate-180"/></summary><p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{a}</p></details>)}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-violet-800 via-violet-700 to-indigo-800 px-5 py-16 text-center text-white sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"/>
        <div className="relative mx-auto max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold"><Sparkles size={14}/> Future Soluções</span><h2 className="mt-5 text-3xl font-black sm:text-4xl">Simplifique o trabalho com seus documentos.</h2><p className="mt-4 leading-7 text-violet-100">Conheça o AssinaPDF e tenha ferramentas de assinatura, edição, organização e conversão em um único aplicativo.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a href={DOWNLOAD_URL} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 font-extrabold text-violet-800 shadow-xl transition hover:-translate-y-0.5"><ArrowDownToLine size={19}/> Baixar AssinaPDF · Windows 64 bits</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-7 py-4 font-bold text-white hover:bg-white/10"><MessageCircle size={18}/> Falar com a equipe</a></div></div>
      </section>

      <footer className="bg-[#171c25] px-5 py-8 text-sm text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><img src="/logo-future.png" alt="Future Soluções" className="h-8 w-auto brightness-0 invert"/><span className="text-white font-bold">AssinaPDF</span></div><span>© {new Date().getFullYear()} Future Soluções. Todos os direitos reservados.</span><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 hover:text-white">futuresolucoes.com.br <ArrowRight size={13} className="inline"/></a></div>
      </footer>
    </main>
  );
}
