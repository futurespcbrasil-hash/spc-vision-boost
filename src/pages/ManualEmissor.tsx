import { BookOpen, AlertTriangle, FileText, Building2, ShieldCheck, BarChart3, HelpCircle, ChevronRight } from 'lucide-react';

const sections = [
  { id: 'acesso', title: '1. Acesso e navegação', icon: BookOpen, items: [
    ['Empresa ativa', 'Confira a empresa selecionada antes de cadastrar informações ou emitir documentos.'],
    ['Menu lateral', 'Use os menus para localizar cadastros, documentos fiscais, relatórios e configurações. As opções podem variar conforme o perfil e a liberação de cada módulo.'],
    ['Segurança', 'Não compartilhe sua senha, o arquivo do certificado digital ou a senha dele.']
  ]},
  { id: 'dashboard', title: '2. Dashboard', icon: BarChart3, items: [
    ['Cards de documentos', 'Conforme o módulo disponível, o ícone abre a listagem e o botão de emissão inicia um novo documento.'],
    ['NF-e', 'Nota Fiscal Eletrônica de produtos. Confira destinatário, itens, quantidades, valores, natureza da operação e informações fiscais antes de transmitir.'],
    ['NFC-e', 'Nota Fiscal de Consumidor Eletrônica. Revise itens, quantidades, descontos, pagamentos e total antes de concluir a venda.'],
    ['NFS-e', 'Nota Fiscal de Serviço Eletrônica. Confira tomador, descrição do serviço, valores e informações tributárias exigidas pelo município.'],
    ['Clientes e Produtos', 'Os atalhos levam às listagens e aos cadastros correspondentes. Mantenha os dados atualizados antes de emitir.']
  ]},
  { id: 'cadastros', title: '3. Cadastros', icon: Building2, items: [
    ['Produtos', 'Acesse Cadastros → Produtos, crie o registro e confira nome, código, unidade, preço e dados tributários aplicáveis.'],
    ['Serviços', 'Acesse Cadastros → Serviços. Confira descrição, preço e código de tributação municipal com o contador ou responsável fiscal.'],
    ['Clientes', 'Acesse Cadastros → Clientes → Novo Cliente. Revise nome, CPF/CNPJ, e-mail, telefone e demais dados solicitados.'],
    ['Fornecedores', 'Acesse Cadastros → Fornecedores e confira razão social, CPF/CNPJ, inscrições e contatos.'],
    ['Veículos e Condutores', 'Preencha os dados conforme os documentos oficiais. Esses cadastros podem ser necessários para módulos de transporte quando liberados.'],
    ['Natureza de operação e Grupo tributário', 'CFOP, finalidade e parâmetros tributários devem corresponder à operação real. Confirme com o contador antes de alterar.']
  ]},
  { id: 'documentos', title: '4. Documentos fiscais', icon: FileText, items: [
    ['Antes de emitir', 'Confirme empresa ativa, cadastros envolvidos, configurações fiscais e certificado digital. A autorização depende dos dados, do ambiente fiscal e das regras da SEFAZ ou do município.'],
    ['Documento autorizado', 'Abra o registro e confira a situação. Guarde os documentos fiscais correspondentes conforme os procedimentos da empresa.'],
    ['Documento rejeitado', 'Leia a mensagem de retorno, corrija a informação indicada e retransmita somente após verificar a causa.'],
    ['Em processamento ou pendente', 'Consulte a situação antes de tentar novamente, para evitar duplicidade.'],
    ['Cancelamento', 'Só solicite quando permitido, com justificativa adequada e observando o prazo e as regras fiscais aplicáveis.']
  ]},
  { id: 'configuracoes', title: '5. Configurações da empresa', icon: ShieldCheck, items: [
    ['Dados da empresa', 'Revise CNPJ, razão social, nome fantasia, endereço, contatos e inscrições. Confira os dados retornados por consultas automáticas antes de salvar.'],
    ['Tributação', 'Não altere regime tributário, inscrições ou alíquotas sem orientação do contador ou responsável fiscal.'],
    ['Certificado Digital A1', 'Na aba Certificado Digital, selecione o arquivo .PFX ou .P12, informe a senha e utilize a opção de validação. Confira validade e empresa correspondente.'],
    ['Notas fiscais', 'Séries, numeração, ambiente de emissão, impressão, e-mail e parâmetros municipais devem ser configurados com dados oficiais e orientação técnica.'],
    ['Usuários e assinatura', 'Administre acessos e consulte plano/faturas conforme as permissões disponíveis na conta. Conceda acesso somente a pessoas autorizadas.']
  ]},
  { id: 'relatorios', title: '6. Relatórios', icon: BarChart3, items: [
    ['Consulta', 'Acesse Relatórios, selecione a categoria disponível e confira os filtros e o período antes de analisar os resultados.'],
    ['Conferência', 'A disponibilidade dos relatórios depende dos módulos habilitados e dos dados existentes. Confira os resultados antes de utilizá-los em decisões fiscais ou gerenciais.']
  ]},
  { id: 'problemas', title: '7. Solução de problemas e suporte', icon: HelpCircle, items: [
    ['Certificado não validado ou vencido', 'Confira arquivo, senha, empresa correspondente e validade. Se estiver vencido, providencie a renovação. Nunca envie a senha por canais inseguros.'],
    ['Cadastro ou documento não aparece', 'Confira se está na empresa correta, revise a busca e confirme se o registro foi salvo. Em documentos, verifique tipo, data e situação.'],
    ['Ao pedir suporte', 'Informe a tela, tipo de documento, etapa realizada e mensagem de erro. Oculte senhas e outras informações sensíveis.']
  ]}
];

const ManualEmissor = () => (
  <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
    <header className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center gap-3 text-primary"><BookOpen size={28} /><span className="text-sm font-semibold uppercase tracking-wide">Central de ajuda</span></div>
      <h1 className="mt-3 text-3xl font-bold text-foreground">Manual do Emissor Fiscal</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">Guia de uso do sistema para consultar os menus, manter cadastros, entender os documentos fiscais e resolver dúvidas comuns.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">Future Soluções</span>
        <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">Guia do usuário</span>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/40">
          <section.icon size={20} className="shrink-0 text-primary" />
          <span className="text-sm font-medium text-foreground">{section.title}</span>
          <ChevronRight size={16} className="ml-auto shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>

    <div className="space-y-5">
      {sections.map((section) => (
        <section id={section.id} key={section.id} className="scroll-mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground"><section.icon size={21} className="text-primary" />{section.title}</h2>
          <div className="space-y-4">
            {section.items.map(([title, body]) => (
              <article key={title} className="border-b border-border/70 pb-4 last:border-0 last:pb-0">
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>

    <aside className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <AlertTriangle size={21} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <h2 className="font-semibold text-foreground">Atenção: módulos de transporte</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">CT-e, CT-e OS e MDF-e exigem confirmação de disponibilidade e validação funcional antes do uso em produção. Não presuma que a presença de um menu significa que o módulo está liberado. Regras fiscais devem ser confirmadas com o contador ou responsável técnico.</p>
      </div>
    </aside>
    <p className="pb-4 text-center text-xs text-muted-foreground">Future Soluções — Manual orientativo. A disponibilidade de funções pode variar conforme perfil, empresa e módulos habilitados.</p>
  </div>
);

export default ManualEmissor;
