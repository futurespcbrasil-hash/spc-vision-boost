import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Search, Copy, Check, ShieldCheck,
  FileText, Building2, ReceiptText, MonitorSmartphone, CircleHelp,
  ChevronDown, ExternalLink, Sparkles, BadgeCheck, Mail, Menu, X
} from 'lucide-react';

const manuals = [
  { title: 'Começando no Emissor Fiscal', category: 'Primeiros passos', description: 'Conheça a dashboard, a empresa ativa e os principais menus.', terms: 'acesso dashboard navegação empresa' },
  { title: 'Clientes, produtos e serviços', category: 'Cadastros', description: 'Organize os cadastros usados nas emissões fiscais.', terms: 'cadastro cliente produto serviço fornecedor' },
  { title: 'Emitir e acompanhar NF-e', category: 'Documentos fiscais', description: 'Entenda a listagem, os status e os cuidados antes de transmitir.', terms: 'nfe nota fiscal eletrônica produto rejeitada autorizada cancelamento' },
  { title: 'Venda no PDV e NFC-e', category: 'Documentos fiscais', description: 'Revise itens, quantidades, descontos, pagamentos e total da venda.', terms: 'nfce consumidor pdv venda pagamento' },
  { title: 'Emitir NFS-e', category: 'Documentos fiscais', description: 'Confira tomador, descrição do serviço, valores e tributação municipal.', terms: 'nfse serviço prefeitura tomador iss' },
  { title: 'Empresa e certificado A1', category: 'Configuração', description: 'Confira os dados da empresa e valide o certificado digital.', terms: 'configuração empresa certificado digital pfx p12 senha validade' },
  { title: 'Resolver rejeições e dúvidas', category: 'Suporte', description: 'Saiba o que conferir antes de repetir uma emissão e como pedir ajuda.', terms: 'erro rejeição suporte problema' },
];

const chapters = [
  { title: '1. Acesso e navegação', items: [
    ['Empresa ativa', 'Confira a empresa indicada no topo antes de cadastrar dados ou emitir documentos. Se houver mais de uma empresa disponível, confirme que está trabalhando no contexto correto.'],
    ['Dashboard', 'Use os cards para acessar as áreas principais. Conforme o card, o ícone abre a listagem e o botão de ação inicia uma emissão. Os indicadores resumem os registros disponíveis e não substituem a consulta ao documento.'],
    ['Menus e permissões', 'As opções exibidas podem variar conforme o perfil, a configuração da empresa e os módulos liberados para a conta.']
  ]},
  { title: '2. Cadastros', items: [
    ['Clientes', 'Abra Cadastros → Clientes e escolha Novo Cliente. Preencha os campos solicitados, confira CPF/CNPJ e contatos e salve. Antes de emitir, confirme que selecionou o tomador ou destinatário correto.'],
    ['Produtos', 'Abra Cadastros → Produtos e crie o registro. Revise nome, código, unidade, preço e dados fiscais aplicáveis. Códigos tributários e alíquotas devem ser confirmados com o responsável fiscal.'],
    ['Serviços e fornecedores', 'Mantenha descrição, códigos, valores e dados de identificação atualizados. Para serviço, confirme o código de tributação municipal com o contador ou responsável fiscal.'],
    ['Natureza de operação e grupo tributário', 'CFOP, finalidade e parâmetros tributários precisam refletir a operação real. Não escolha esses dados por suposição; peça validação ao responsável fiscal.']
  ]},
  { title: '3. NF-e — Nota Fiscal Eletrônica', items: [
    ['Abrir a listagem', 'Acesse Documentos → Nota Eletrônica. Use a pesquisa e os dados da listagem para localizar a nota e conferir número, série, data, destinatário, valor e situação.'],
    ['Preparar uma emissão', 'Escolha Emitir NF-e e confira empresa, destinatário, itens, quantidades, valores, natureza da operação e informações fiscais antes de transmitir. Revise os dados antes de confirmar.'],
    ['Entender a situação', 'Autorizada: confira e guarde o documento. Rejeitada: leia o retorno e corrija a causa. Em processamento ou pendente: consulte a situação antes de repetir para evitar duplicidade. Cancelada: consulte o evento e observe as regras fiscais.'],
    ['Ações sobre a nota', 'A listagem pode oferecer visualização, envio por e-mail, duplicação ou solicitação de cancelamento. O cancelamento depende do estado do documento, de justificativa e das regras fiscais vigentes.']
  ]},
  { title: '4. NFC-e — Nota Fiscal de Consumidor', items: [
    ['Abrir o PDV', 'Acesse Documentos → Nota do Consumidor ou o card NFC-e na Dashboard e inicie a venda pelo PDV.'],
    ['Conferir a venda', 'Adicione os produtos e confira quantidades, preços, descontos ou acréscimos, formas de pagamento e total. Informe os dados do consumidor quando necessário e revise tudo antes de concluir.'],
    ['Consultar o resultado', 'Depois da operação, confira número, data, valor e situação. Se houver rejeição, leia a mensagem e corrija a causa. Não considere uma nota rejeitada como documento autorizado.']
  ]},
  { title: '5. NFS-e — Nota Fiscal de Serviço', items: [
    ['Iniciar a emissão', 'Acesse Documentos → Nota de Serviço e escolha Emitir NFS-e. Selecione o tomador e confira os dados antes de preencher a nota.'],
    ['Revisar os dados do serviço', 'Confira descrição, competência, município aplicável, valor, descontos, retenções e demais informações tributárias solicitadas. Os campos variam conforme a integração municipal e o enquadramento do prestador.'],
    ['Acompanhar a nota', 'Na listagem, confira o tomador, valor e situação. Conforme o estado do registro, podem existir opções de visualização, edição de nota rejeitada ou geração a partir de rascunho. Verifique a situação antes de iniciar outra emissão.']
  ]},
  { title: '6. Empresa e certificado digital', items: [
    ['Dados da empresa', 'Em Configurações → Empresa, revise CNPJ, razão social, nome fantasia, endereço, contatos e inscrições. Confira os dados obtidos por consulta automática antes de salvar.'],
    ['Tributação', 'Regime tributário, inscrições, séries, numeração e parâmetros fiscais afetam as emissões. Altere-os somente após confirmar os dados com o contador ou responsável técnico.'],
    ['Certificado A1', 'Na aba Certificado Digital, selecione o arquivo .PFX ou .P12 da empresa, informe a senha e use Validar certificado. Confira a validade e a empresa correspondente. Se falhar, verifique arquivo, senha e vencimento. Nunca compartilhe o arquivo ou a senha por canais inseguros.'],
    ['Usuários e assinatura', 'As opções de gestão de usuários, plano e faturas dependem das permissões da conta. Conceda acesso somente a pessoas autorizadas.']
  ]},
  { title: '7. Relatórios e solução de problemas', items: [
    ['Relatórios', 'Abra Relatórios, escolha uma categoria disponível e confira os filtros e o período. A disponibilidade depende dos módulos liberados e dos dados existentes.'],
    ['Documento rejeitado', 'Abra o registro, leia a mensagem de retorno, confira os campos indicados e os cadastros/configurações relacionados. Corrija a causa antes de transmitir novamente.'],
    ['Não encontro um cadastro ou documento', 'Confirme a empresa ativa, revise a pesquisa e os filtros e confira se o registro foi salvo. Em documentos, verifique tipo, data e situação.'],
    ['Como pedir suporte', 'Informe a tela, o tipo de documento, a etapa realizada e a mensagem de erro. Oculte senhas e informações sensíveis. Nunca envie a senha do certificado.']
  ]},
];

const products = [
  { icon: FileText, title: 'Emissor Fiscal', description: 'Emissão e organização de documentos fiscais, conforme módulos habilitados.', tag: 'Manual disponível' },
  { icon: ShieldCheck, title: 'Certificado Digital', description: 'Identidade digital para empresas e profissionais, com orientação para emissão e renovação.', tag: 'Atendimento especializado' },
  { icon: Building2, title: 'SPC Brasil para empresas', description: 'Consultas e soluções para apoiar análise cadastral, acompanhamento e cobrança.', tag: 'Soluções empresariais' },
];

const PortalPublico = () => {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [openChapter, setOpenChapter] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const isManual = location.pathname.startsWith('/portal/manuais/emissor-fiscal');
  const isManualIndex = location.pathname.startsWith('/portal/manuais');
  const isServices = location.pathname.startsWith('/portal/servicos');
  const isBlog = location.pathname.startsWith('/portal/blog');
  const publicUrl = typeof window !== 'undefined' ? window.location.origin + '/portal' : 'https://crm.futuresolucoes.com.br/portal';
  const filteredManuals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return manuals;
    return manuals.filter(m => (m.title + ' ' + m.description + ' ' + m.category + ' ' + m.terms).toLowerCase().includes(term));
  }, [search]);

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copie o link público da Central Future Soluções:', publicUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[#080914] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080914]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/portal" className="flex items-center gap-3">
            <img src="/logo-future.png" alt="Future Soluções" className="h-9 w-auto rounded bg-white px-2 py-1" />
            <span className="hidden text-xs font-semibold uppercase tracking-[.2em] text-violet-200 sm:block">Central Future</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <Link className="transition hover:text-white" to="/portal">Início</Link>
            <Link className="transition hover:text-white" to="/portal/manuais">Manuais</Link>
            <Link className="transition hover:text-white" to="/portal/servicos">Soluções para empresas</Link>
            <Link className="transition hover:text-white" to="/portal/blog">Conteúdos</Link>
          </nav>
          <div className="hidden md:block">
            <button onClick={copyPublicLink} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-100 hover:bg-violet-400/20">
              {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Link copiado' : 'Copiar link público'}
            </button>
          </div>
          <button className="rounded-lg border border-white/10 p-2 md:hidden" onClick={() => setMobileMenu(v => !v)} aria-label="Abrir menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {mobileMenu && <div className="grid gap-1 border-t border-white/10 px-5 py-3 md:hidden"><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal">Início</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/manuais">Manuais</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/servicos">Soluções para empresas</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/blog">Conteúdos</Link><button onClick={copyPublicLink} className="mt-2 rounded-lg bg-violet-500 px-3 py-2 text-left font-semibold">{copied ? 'Link copiado' : 'Copiar link público'}</button></div>}
      </header>

      <main>
        {!isManual && !isManualIndex && !isServices && !isBlog && <>
          <section className="relative overflow-hidden border-b border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(124,58,237,.25),transparent_42%),radial-gradient(ellipse_at_85%_50%,rgba(59,130,246,.13),transparent_35%)]" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:py-28 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-200"><Sparkles size={14} /> Conhecimento e soluções em um só lugar</div>
                <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">Tecnologia para simplificar o dia a dia da sua <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">empresa.</span></h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Acesse manuais, encontre orientações práticas e conheça as soluções da Future Soluções para apoiar sua rotina empresarial.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/portal/manuais" className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3.5 font-bold shadow-lg shadow-violet-950/40 transition hover:bg-violet-400">Acessar os manuais <ArrowRight size={18} /></Link>
                  <Link to="/portal/servicos" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 font-semibold transition hover:bg-white/10">Conhecer soluções</Link>
                </div>
                <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400"><span className="inline-flex items-center gap-2"><BadgeCheck size={16} className="text-emerald-300" /> Conteúdo organizado</span><span className="inline-flex items-center gap-2"><MonitorSmartphone size={16} className="text-sky-300" /> Acesso público e responsivo</span></div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5 shadow-2xl shadow-violet-950/20 backdrop-blur">
                <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-200">Central de ajuda</p><h2 className="mt-1 text-xl font-bold">O que você procura?</h2></div><div className="rounded-2xl bg-violet-400/15 p-3 text-violet-200"><BookOpen size={24} /></div></div>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: certificado, NF-e, cadastro..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" /></label>
                <div className="mt-4 space-y-2">{filteredManuals.slice(0, 4).map(item => <Link key={item.title} to="/portal/manuais/emissor-fiscal" className="flex items-center gap-3 rounded-xl border border-white/5 px-3 py-3 transition hover:border-violet-300/30 hover:bg-white/5"><div className="rounded-lg bg-violet-400/10 p-2 text-violet-200"><FileText size={17} /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs text-slate-400">{item.category}</p></div><ArrowRight size={16} className="text-slate-500" /></Link>)}</div>
                <Link to="/portal/manuais" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-white">Ver todos os guias <ArrowRight size={15} /></Link>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div className="mb-8 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Soluções Future</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Mais clareza para cuidar do seu negócio</h2><p className="mt-3 leading-7 text-slate-400">Conheça nossas frentes de atendimento e encontre orientações para usar melhor as ferramentas disponíveis.</p></div>
            <div className="grid gap-4 md:grid-cols-3">{products.map(p => <article key={p.title} className="group rounded-2xl border border-white/10 bg-white/[.035] p-6 transition hover:-translate-y-1 hover:border-violet-300/30 hover:bg-white/[.06]"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-sky-500/15 text-violet-200"><p.icon size={24} /></div><h3 className="text-xl font-bold">{p.title}</h3><p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">{p.description}</p><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-violet-200">{p.tag}</p></article>)}</div>
          </section>
          <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><div className="flex flex-col justify-between gap-6 rounded-3xl border border-violet-300/20 bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-sky-500/10 p-7 md:flex-row md:items-center md:p-10"><div><h2 className="text-2xl font-bold">Precisa de uma orientação?</h2><p className="mt-2 max-w-2xl text-slate-300">Consulte o manual antes de começar e tenha os passos principais sempre à mão.</p></div><Link to="/portal/manuais" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-violet-100">Explorar central de ajuda <ArrowRight size={17} /></Link></div></section>
        </>}

        {isManualIndex && !isManual && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Central de ajuda</p><h1 className="mt-3 text-4xl font-black">Manuais e guias</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Encontre instruções para navegar no sistema, organizar cadastros e acompanhar documentos fiscais.</p><label className="mt-8 flex max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por assunto, tela ou documento..." className="w-full bg-transparent outline-none placeholder:text-slate-500" /></label><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredManuals.map((item, i) => <Link key={item.title} to="/portal/manuais/emissor-fiscal" className="rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:border-violet-300/30 hover:bg-white/[.06]"><div className="flex items-center justify-between"><span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">{item.category}</span><span className="text-xs text-slate-500">Guia {String(i + 1).padStart(2, '0')}</span></div><h2 className="mt-4 text-lg font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Abrir guia <ArrowRight size={15} /></span></Link>)}</div><p className="mt-8 rounded-xl border border-amber-200/15 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100/80">Observação: CT-e, CT-e OS e MDF-e aparecem na navegação do sistema de referência, mas seus fluxos ainda precisam de validação funcional. Por isso, não há aqui instruções de emissão desses documentos.</p></section>}

        {isManual && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><Link to="/portal/manuais" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Todos os manuais</Link><div className="grid gap-8 lg:grid-cols-[270px_1fr]"><aside className="h-fit rounded-2xl border border-white/10 bg-white/[.035] p-5 lg:sticky lg:top-24"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-400/15 p-3 text-violet-200"><BookOpen size={23} /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-200">Guia do usuário</p><h2 className="font-bold">Emissor Fiscal</h2></div></div><p className="mt-3 text-sm leading-6 text-slate-400">Manual de referência para os fluxos identificados no sistema.</p><div className="mt-5 space-y-1">{chapters.map((c, i) => <button key={c.title} onClick={() => { setOpenChapter(i); document.getElementById('chapter-' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">{c.title}</button>)}</div></aside><div><div className="rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-500/15 to-sky-500/10 p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">Manual público</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Manual do Emissor Fiscal</h1><p className="mt-4 max-w-3xl leading-7 text-slate-300">Guia para entender os menus, manter cadastros, revisar emissões e resolver dúvidas comuns. As opções podem variar conforme a empresa, as permissões e os módulos liberados.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Future Soluções</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Atualizado em outubro de 2026</span></div></div><div className="mt-5 rounded-xl border border-sky-200/15 bg-sky-200/5 p-4 text-sm leading-6 text-sky-100/90"><strong>Importante:</strong> este manual descreve os fluxos identificados no código de referência. Antes de realizar operações fiscais, confirme os dados com o responsável fiscal. CT-e, CT-e OS e MDF-e não são documentados como fluxos prontos, pois precisam de validação funcional.</div><div className="mt-6 space-y-4">{chapters.map((chapter, i) => <section id={'chapter-' + i} key={chapter.title} className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><button onClick={() => setOpenChapter(openChapter === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"><span className="text-lg font-bold">{chapter.title}</span><ChevronDown className={'shrink-0 text-violet-200 transition ' + (openChapter === i ? 'rotate-180' : '')} size={19} /></button>{openChapter === i && <div className="space-y-5 border-t border-white/10 px-5 py-5 md:px-6">{chapter.items.map(([title, body]) => <div key={title}><h3 className="font-semibold text-violet-100">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-300">{body}</p></div>)}</div>}</section>)}</div><div className="mt-6 rounded-2xl border border-white/10 p-5"><h2 className="font-bold">Precisa de suporte?</h2><p className="mt-2 text-sm leading-6 text-slate-400">Ao solicitar ajuda, informe a tela, a etapa realizada e a mensagem de erro. Não envie senhas nem o arquivo do certificado por canais inseguros.</p><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-white">Site da Future Soluções <ExternalLink size={15} /></a></div></div></div></section>}

        {isServices && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Para sua empresa</p><h1 className="mt-3 text-4xl font-black">Soluções Future Soluções</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Conheça nossas frentes de atendimento. As condições comerciais e a disponibilidade devem ser confirmadas diretamente com nossa equipe.</p><div className="mt-9 grid gap-5 md:grid-cols-3">{products.map(p => <article key={p.title} className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><p.icon size={28} className="text-violet-200" /><h2 className="mt-4 text-xl font-bold">{p.title}</h2><p className="mt-3 text-sm leading-7 text-slate-400">{p.description}</p><span className="mt-5 inline-block rounded-full bg-white/5 px-3 py-1.5 text-xs text-violet-100">{p.tag}</span></article>)}</div><div className="mt-9 rounded-2xl border border-violet-300/20 bg-violet-400/10 p-6"><h2 className="text-xl font-bold">Vamos encontrar a solução adequada?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Entre em contato pelos canais oficiais publicados no site da Future Soluções para confirmar escopo, valores e disponibilidade.</p><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 font-semibold hover:bg-violet-400">Visitar site oficial <ExternalLink size={16} /></a></div></section>}

        {isBlog && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Conteúdo e orientação</p><h1 className="mt-3 text-4xl font-black">Conteúdos para sua empresa</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Uma área preparada para reunir dicas práticas, orientações e novidades da Future Soluções.</p><div className="mt-8 grid gap-4 md:grid-cols-2"><Link to="/portal/manuais/emissor-fiscal" className="rounded-2xl border border-white/10 bg-white/[.035] p-6 hover:border-violet-300/30"><p className="text-xs font-bold uppercase tracking-wider text-violet-200">Guia prático</p><h2 className="mt-3 text-xl font-bold">Cuidados antes de emitir um documento fiscal</h2><p className="mt-2 text-sm leading-6 text-slate-400">Confira empresa, cadastros, informações tributárias e certificado antes de iniciar uma emissão.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Ler no manual <ArrowRight size={15} /></span></Link><Link to="/portal/servicos" className="rounded-2xl border border-white/10 bg-white/[.035] p-6 hover:border-violet-300/30"><p className="text-xs font-bold uppercase tracking-wider text-violet-200">Gestão empresarial</p><h2 className="mt-3 text-xl font-bold">Conheça as soluções para apoiar sua operação</h2><p className="mt-2 text-sm leading-6 text-slate-400">Veja as frentes de atendimento em certificado digital, documentos fiscais e soluções SPC Brasil.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Conhecer soluções <ArrowRight size={15} /></span></Link></div><p className="mt-8 text-sm text-slate-500">Novos artigos poderão ser adicionados nesta área conforme a produção de conteúdo da Future Soluções.</p></section>}
      </main>

      <footer className="border-t border-white/10 bg-black/20"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8"><div><p className="font-semibold text-slate-300">Future Soluções</p><p className="mt-1">Tecnologia, orientação e soluções para empresas.</p></div><div className="flex flex-wrap gap-5"><Link to="/portal/manuais" className="hover:text-white">Manuais</Link><Link to="/portal/servicos" className="hover:text-white">Soluções</Link><button onClick={copyPublicLink} className="inline-flex items-center gap-2 hover:text-white">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Link copiado' : 'Compartilhar portal'}</button></div><p>© {new Date().getFullYear()} Future Soluções</p></div></footer>
    </div>
  );
};

export default PortalPublico;
