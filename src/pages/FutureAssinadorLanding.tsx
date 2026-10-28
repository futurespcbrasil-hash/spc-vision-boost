import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Building2, CheckCircle2, FileCheck2,
  FileSignature, FileText, LockKeyhole, ReceiptText, ShieldCheck,
  Sparkles, UploadCloud, X, Send, CheckCircle, LoaderCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const products = [
  {
    icon: ShieldCheck,
    eyebrow: "Identidade digital",
    title: "Certificado Digital",
    description: "Emita ou renove seu e-CPF ou e-CNPJ com orientação da equipe Future.",
    cta: "Encontrar meu certificado",
    to: "/portal/solucoes/certificado-digital",
  },
  {
    icon: ReceiptText,
    eyebrow: "Rotina fiscal",
    title: "Emissor Fiscal",
    description: "Organize a emissão de notas fiscais em uma plataforma online, com suporte.",
    cta: "Conhecer o emissor",
    to: "/portal/solucoes/emissor-fiscal",
  },
  {
    icon: Building2,
    eyebrow: "Decisões comerciais",
    title: "SPC Brasil para empresas",
    description: "Conheça soluções para consultas cadastrais, análise de crédito e cobrança.",
    cta: "Conhecer soluções SPC",
    to: "/portal/solucoes/spc-brasil",
  },
];

const whatsappLink = (message: string) =>
  "https://wa.me/5554981028290?text=" + encodeURIComponent(message);

export default function FutureAssinadorLanding() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreviewNotice, setShowPreviewNotice] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lead, setLead] = useState({ nome: "", telefone: "", email: "", interesse: "assinatura-pdf", consentimento: false, website: "" });
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [leadMessage, setLeadMessage] = useState("");

  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadStatus === "sending") return;
    setLeadStatus("sending");
    setLeadMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("future-assinador-lead", {
        body: lead,
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Não foi possível registrar seus dados.");
      setLeadStatus("success");
      setLeadMessage("Pronto! Recebemos seu contato. A equipe Future poderá falar com você.");
      setLead({ nome: "", telefone: "", email: "", interesse: "assinatura-pdf", consentimento: false, website: "" });
    } catch (error) {
      console.error("[Future Assinador] Falha ao enviar lead.", error);
      setLeadStatus("error");
      setLeadMessage("Não conseguimos registrar agora. Tente novamente ou fale com nossa equipe pelo WhatsApp.");
    }
  };

  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const chooseFile = (file?: File) => {
    if (!file) return;
    setFileError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(null);
      setFileError("Selecione um arquivo PDF válido.");
      setShowPreviewNotice(true);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSelectedFile(null);
      setFileError("O arquivo excede o limite de 20 MB para esta prévia.");
      setShowPreviewNotice(true);
      return;
    }
    setSelectedFile(file);
    setShowPreviewNotice(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaff] text-[#211a31]">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-0 h-[680px] bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.15),transparent_58%),radial-gradient(ellipse_at_top_right,rgba(91,33,182,0.10),transparent_48%)]" />

      <header className="relative z-10 border-b border-violet-100/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/portal" className="group flex items-center gap-3" aria-label="Future Soluções - página inicial">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-900 text-white shadow-lg shadow-violet-900/20 transition group-hover:scale-[1.03]">
              <FileSignature size={23} strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-extrabold tracking-tight">Future <span className="text-violet-700">Assinador</span></span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Uma solução Future Soluções</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex" aria-label="Navegação principal">
            <a href="#como-funciona" className="transition hover:text-violet-700">Como funciona</a>
            <a href="#solucoes" className="transition hover:text-violet-700">Soluções para empresas</a>
            <a href="#duvidas" className="transition hover:text-violet-700">Dúvidas</a>
          </nav>
          <a href="#assinador" className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-700/20 transition hover:-translate-y-0.5 hover:bg-violet-800 sm:px-5">
            Acessar assinador <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:pt-24">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-violet-800 shadow-sm">
            <Sparkles size={15} /> MAIS PRATICIDADE PARA SUA EMPRESA
          </div>
          <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.7rem]">
            Seus documentos prontos para assinar. <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">Sua empresa pronta para avançar.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            Simplifique sua rotina com assinatura digital de PDFs e descubra ferramentas que ajudam sua empresa a trabalhar melhor — tudo com a orientação da Future Soluções.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#assinador" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-4 font-extrabold text-white shadow-xl shadow-violet-800/25 transition hover:-translate-y-0.5 hover:bg-violet-800">
              Quero assinar um PDF <ArrowRight size={18} />
            </a>
            <a href="#solucoes" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50">
              Conhecer soluções
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-violet-700" /> Certificado compatível</span>
            <span className="inline-flex items-center gap-2"><LockKeyhole size={17} className="text-violet-700" /> Privacidade em primeiro lugar</span>
            <span className="inline-flex items-center gap-2"><FileCheck2 size={17} className="text-violet-700" /> Pré-visualização do PDF</span>
          </div>
        </div>

        <div id="assinador" className="relative scroll-mt-8">
          <div className="absolute -inset-5 rounded-[2.2rem] bg-gradient-to-br from-violet-300/35 via-fuchsia-200/20 to-indigo-300/30 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.7rem] border border-white bg-white shadow-[0_28px_90px_-30px_rgba(76,29,149,0.32)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FileSignature size={21} /></span>
                <div>
                  <p className="font-extrabold text-slate-900">Comece pelo seu documento</p>
                  <p className="mt-0.5 text-xs text-slate-500">Experiência de assinatura digital</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Demonstração</span>
            </div>

            <div className="p-5 sm:p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
                className={`flex min-h-[250px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? "border-violet-600 bg-violet-100" : "border-violet-200 bg-violet-50/60 hover:border-violet-400 hover:bg-violet-50"}`}
              >
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-md shadow-violet-900/5"><UploadCloud size={30} /></span>
                {selectedFile ? (
                  <>
                    <span className="max-w-full break-all font-bold text-slate-900">{selectedFile.name}</span>
                    <span className="mt-2 text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Arquivo selecionado localmente</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-extrabold text-slate-900">Arraste seu PDF para cá</span>
                    <span className="mt-2 text-sm text-slate-500">ou clique para escolher um arquivo no computador</span>
                  </>
                )}
                <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white">
                  <FileText size={16} /> {selectedFile ? "Escolher outro PDF" : "Selecionar PDF"}
                </span>
              </button>

              {showPreviewNotice && (
                <div className="mt-4 flex gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4 text-left">
                  <BadgeCheck className="mt-0.5 shrink-0 text-violet-700" size={19} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{selectedFile ? "Arquivo selecionado nesta prévia" : "Selecione um arquivo PDF"}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {fileError ?? "O arquivo permanece no seu dispositivo. Esta demonstração permite conferir o PDF, mas ainda não realiza assinatura criptográfica nem envia o documento."}
                    </p>
                  </div>
                  <button type="button" aria-label="Fechar aviso" onClick={() => setShowPreviewNotice(false)} className="shrink-0 text-slate-400 hover:text-slate-700"><X size={16} /></button>
                </div>
              )}

              {selectedFile && previewUrl && (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-bold text-slate-700">Pré-visualização local do PDF</span>
                    <button type="button" onClick={() => { setSelectedFile(null); setShowPreviewNotice(false); setFileError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs font-bold text-violet-700 hover:text-violet-900">Remover arquivo</button>
                  </div>
                  <iframe title="Pré-visualização local do PDF selecionado" src={previewUrl} className="h-[360px] w-full bg-slate-100 sm:h-[440px]" />
                </div>
              )}

              <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <LockKeyhole size={18} className="mt-0.5 shrink-0 text-violet-700" />
                <p className="text-xs leading-5 text-slate-600">Seu documento permanece no dispositivo nesta etapa de demonstração. Não selecione arquivos confidenciais para testar a prévia.</p>
              </div>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">A assinatura estará disponível após a integração e os testes de compatibilidade dos certificados.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-violet-100 bg-white/80">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:grid-cols-3 sm:px-8">
          {[
            ["Mais agilidade", "Simplifique etapas da sua rotina documental."],
            ["Mais clareza", "Saiba como funciona cada etapa antes de assinar."],
            ["Apoio da Future", "Conte com orientação para encontrar a solução certa."],
          ].map(([title, description]) => (
            <div key={title} className="flex items-start gap-3 px-2">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CheckCircle2 size={19} /></span>
              <div><p className="font-extrabold text-slate-900">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-12 px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-700">Simples de entender</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Da preparação à assinatura, com clareza em cada etapa.</h2>
          <p className="mt-4 leading-7 text-slate-600">Uma experiência pensada para deixar a rotina digital mais simples, sem abrir mão de segurança e transparência.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", title: "Escolha seu PDF", text: "Selecione o documento que precisa assinar e confira se é o arquivo correto.", icon: UploadCloud },
            { n: "02", title: "Use um certificado compatível", text: "A integração permitirá selecionar o certificado conforme o dispositivo e a tecnologia suportada.", icon: ShieldCheck },
            { n: "03", title: "Baixe e valide", text: "Após a assinatura funcional, você poderá baixar o PDF e verificar a integridade da assinatura.", icon: FileCheck2 },
          ].map((step) => (
            <article key={step.n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-900/5">
              <div className="flex items-center justify-between"><span className="text-sm font-black tracking-widest text-violet-700">{step.n}</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><step.icon size={22} /></span></div>
              <h3 className="mt-6 text-xl font-extrabold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="solucoes" className="relative overflow-hidden bg-[#191326] py-16 text-white sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.25),transparent_42%),radial-gradient(ellipse_at_bottom_left,rgba(126,34,206,0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-300">Mais soluções para sua empresa</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Assinatura digital é só o começo.</h2>
              <p className="mt-4 max-w-xl leading-7 text-slate-300">A Future Soluções também ajuda sua empresa com identidade digital, emissão fiscal e informação para decisões comerciais.</p>
            </div>
            <a href={whatsappLink("Olá! Quero conhecer as soluções da Future Soluções para minha empresa.")} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-bold transition hover:bg-white/10">Falar com a Future <ArrowRight size={17} /></a>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {products.map((product) => (
              <article key={product.title} className="group rounded-2xl border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-white/[0.075]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200"><product.icon size={24} /></span>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-violet-300">{product.eyebrow}</p>
                <h3 className="mt-2 text-xl font-extrabold">{product.title}</h3>
                <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-300">{product.description}</p>
                <Link to={product.to} className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-violet-200 transition group-hover:text-white">{product.cta} <ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="mx-auto max-w-7xl scroll-mt-12 px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-xl shadow-violet-900/5 md:grid-cols-[0.9fr_1.1fr] md:p-10">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-700">Vamos conversar</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Receba orientação da Future.</h2>
            <p className="mt-4 leading-7 text-slate-600">Deixe seus dados e indique o que você procura. Nossa equipe poderá orientar sobre assinatura digital, certificado, emissão fiscal e soluções SPC Brasil.</p>
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-violet-50 p-4 text-sm leading-6 text-slate-700">
              <LockKeyhole className="mt-0.5 shrink-0 text-violet-700" size={19} />
              <span>Usamos estes dados somente para responder ao seu pedido de contato. Não envie senhas, certificados ou documentos neste formulário.</span>
            </div>
          </div>
          <form onSubmit={submitLead} className="space-y-4" aria-label="Solicitar contato da Future Soluções">
            <div>
              <label htmlFor="future-lead-nome" className="mb-1.5 block text-sm font-bold text-slate-700">Nome</label>
              <input id="future-lead-nome" autoComplete="name" required minLength={2} maxLength={120} value={lead.nome} onChange={(e) => setLead({ ...lead, nome: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="Como podemos chamar você?" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="future-lead-telefone" className="mb-1.5 block text-sm font-bold text-slate-700">WhatsApp</label>
                <input id="future-lead-telefone" type="tel" autoComplete="tel" required minLength={10} maxLength={30} value={lead.telefone} onChange={(e) => setLead({ ...lead, telefone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="(54) 99999-9999" />
              </div>
              <div>
                <label htmlFor="future-lead-email" className="mb-1.5 block text-sm font-bold text-slate-700">E-mail</label>
                <input id="future-lead-email" type="email" autoComplete="email" required maxLength={254} value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder="voce@empresa.com.br" />
              </div>
            </div>
            <div>
              <label htmlFor="future-lead-interesse" className="mb-1.5 block text-sm font-bold text-slate-700">O que você procura?</label>
              <select id="future-lead-interesse" value={lead.interesse} onChange={(e) => setLead({ ...lead, interesse: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100">
                <option value="assinatura-pdf">Assinatura de PDF</option>
                <option value="certificado-digital">Certificado Digital</option>
                <option value="emissor-fiscal">Emissor Fiscal</option>
                <option value="spc-brasil">SPC Brasil para empresas</option>
                <option value="outro">Outra solução</option>
              </select>
            </div>
            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="future-lead-website">Não preencha este campo</label>
              <input id="future-lead-website" tabIndex={-1} autoComplete="off" value={lead.website} onChange={(e) => setLead({ ...lead, website: e.target.value })} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-600">
              <input type="checkbox" required checked={lead.consentimento} onChange={(e) => setLead({ ...lead, consentimento: e.target.checked })} className="mt-1 h-4 w-4 accent-violet-700" />
              <span>Autorizo a Future Soluções a utilizar meus dados para responder a esta solicitação. Li a informação de privacidade.</span>
            </label>
            <button type="submit" disabled={leadStatus === "sending"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3.5 font-extrabold text-white shadow-lg shadow-violet-700/20 transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">
              {leadStatus === "sending" ? <LoaderCircle size={18} className="animate-spin" /> : leadStatus === "success" ? <CheckCircle size={18} /> : <Send size={17} />}
              {leadStatus === "sending" ? "Enviando..." : leadStatus === "success" ? "Contato recebido" : "Quero receber orientação"}
            </button>
            {leadMessage && <p role="status" aria-live="polite" className={`rounded-lg p-3 text-sm leading-5 ${leadStatus === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{leadMessage}{leadStatus === "error" && <> <a className="font-bold underline" href={whatsappLink("Olá! Não consegui enviar o formulário do Future Assinador e gostaria de atendimento.")} target="_blank" rel="noreferrer">Falar pelo WhatsApp</a></>}</p>}
            <p className="text-xs leading-5 text-slate-400">Não envie documentos ou dados de certificado por este formulário. O assinador ainda não está habilitado para assinatura criptográfica nesta versão.</p>
          </form>
        </div>
      </section>

      <section id="duvidas" className="mx-auto max-w-5xl scroll-mt-12 px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-violet-700">Transparência em primeiro lugar</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Dúvidas frequentes</h2>
        </div>
        <div className="mt-9 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-6">
          {[
            ["Preciso ter conta no CRM?", "A página pública foi planejada para ser acessada por clientes sem login no CRM. O fluxo final de assinatura será definido conforme os requisitos de segurança."],
            ["Posso usar qualquer certificado digital?", "A compatibilidade depende do tipo de certificado, do dispositivo e da integração escolhida. A página só deve anunciar suporte após testes reais."],
            ["O documento é assinado nesta versão?", "Ainda não. Esta demonstração permite selecionar e visualizar o PDF localmente. A assinatura criptográfica será liberada somente depois da integração e de testes com certificados compatíveis."],
            ["Como a Future pode ajudar minha empresa?", "Além do assinador, você pode conhecer as soluções de Certificado Digital, Emissor Fiscal e SPC Brasil para empresas."],
          ].map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="cursor-pointer list-none pr-8 font-bold text-slate-900 marker:hidden after:float-right after:-mr-7 after:text-violet-700 after:content-['+'] group-open:after:content-['−']">{question}</summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-800 via-purple-800 to-indigo-900 px-6 py-10 text-white shadow-2xl shadow-violet-900/20 sm:px-12 sm:py-14">
          <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-violet-200">Future Soluções</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Sua empresa não precisa resolver tudo sozinha.</h2>
              <p className="mt-4 leading-7 text-violet-100">Converse com nossa equipe e descubra qual solução faz sentido para o seu momento.</p>
            </div>
            <a href={whatsappLink("Olá! Quero conversar com a Future Soluções sobre as soluções para minha empresa.")} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-4 font-extrabold text-violet-900 transition hover:-translate-y-0.5 hover:bg-violet-50">Falar com um especialista <ArrowRight size={18} /></a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-700"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-700 text-white"><FileSignature size={17} /></span> Future Assinador Digital</div>
          <div className="flex flex-wrap gap-5"><Link to="/portal">Portal Future</Link><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer">Site oficial</a><a href={whatsappLink("Olá! Tenho uma dúvida sobre o Future Assinador Digital.")} target="_blank" rel="noreferrer">Contato</a></div>
          <p>© {new Date().getFullYear()} Future Soluções</p>
        </div>
      </footer>
    </main>
  );
}
