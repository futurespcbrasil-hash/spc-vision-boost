import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Search, ShieldCheck,
  FileText, Building2, MonitorSmartphone,
  ChevronDown, ExternalLink, Sparkles, BadgeCheck, Menu, X
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
  {
    slug: 'emissor-fiscal', icon: FileText, title: 'Emissor Fiscal',
    description: 'Emita e organize documentos fiscais em uma rotina mais simples, com orientação da equipe Future.',
    tag: 'Notas fiscais em um só lugar',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=85',
    imageAlt: 'Mesa de trabalho com documentos e planejamento financeiro',
    eyebrow: 'Mais praticidade para sua rotina',
    headline: 'Sua empresa merece gastar menos tempo com a emissão de notas.',
    subheadline: 'Organize sua rotina fiscal com um emissor online, apoio especializado e recursos de emissão conforme os módulos contratados.',
    benefits: [
      ['Notas de produtos e serviços', 'Conheça os recursos disponíveis para NF-e, NFC-e e NFS-e, conforme o cenário da sua empresa.'],
      ['Acesso online', 'Consulte sua rotina fiscal em um sistema online, sem depender de arquivos espalhados.'],
      ['Apoio quando precisar', 'Conte com a equipe Future para entender a solução, preparar o acesso e orientar os primeiros passos.'],
      ['Plano com notas ilimitadas', 'Consulte a disponibilidade do plano promocional de R$ 60 por mês e os módulos incluídos para o seu negócio.']
    ],
    audience: 'Comércios, prestadores de serviço e empresas que precisam emitir documentos fiscais.',
    cta: 'Quero conhecer o Emissor Fiscal',
    whatsapp: 'Olá! Quero conhecer o Emissor Fiscal da Future Soluções e confirmar os módulos disponíveis e as condições comerciais.'
  },
  {
    slug: 'certificado-digital', icon: ShieldCheck, title: 'Certificado Digital',
    description: 'Emita ou renove seu certificado digital com orientação para escolher o modelo adequado.',
    tag: 'Identidade digital com orientação',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1400&q=85',
    imageAlt: 'Profissional utilizando computador em ambiente de trabalho seguro',
    eyebrow: 'Identidade digital para sua atividade',
    headline: 'Resolva seu certificado digital com orientação do início ao fim.',
    subheadline: 'A Future Soluções ajuda você a entender as opções de e-CPF e e-CNPJ, se preparar para a validação e acompanhar a emissão ou renovação.',
    benefits: [
      ['e-CPF e e-CNPJ', 'Encontre a opção adequada para sua identidade pessoal ou para a empresa, conforme a finalidade de uso.'],
      ['Emissão e renovação', 'Antecipe o vencimento e organize os próximos passos para evitar correria na rotina.'],
      ['Orientação no processo', 'Receba instruções sobre documentos, validação e etapas necessárias para o seu atendimento.'],
      ['Atendimento Future', 'Tire dúvidas com nossa equipe antes de iniciar o processo e confirme valores e disponibilidade.']
    ],
    audience: 'Empresas, profissionais, contadores e pessoas que precisam assinar ou acessar serviços digitais compatíveis.',
    cta: 'Falar sobre meu certificado',
    whatsapp: 'Olá! Quero informações sobre emissão ou renovação de Certificado Digital com a Future Soluções.'
  },
  {
    slug: 'spc-brasil', icon: Building2, title: 'SPC Brasil para empresas',
    description: 'Use informações cadastrais e de crédito para apoiar decisões comerciais e a gestão de recebíveis.',
    tag: 'Mais informação para decidir',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=85',
    imageAlt: 'Painel de dados e indicadores de negócios em um computador',
    eyebrow: 'Decisões comerciais com mais informação',
    headline: 'Venda com mais confiança. Conheça melhor antes de decidir.',
    subheadline: 'Conheça soluções SPC Brasil para apoiar consultas de CPF e CNPJ, análise cadastral, acompanhamento de crédito e processos de cobrança.',
    benefits: [
      ['Consultas de CPF e CNPJ', 'Acesse informações conforme o produto contratado para apoiar a avaliação cadastral de clientes e empresas.'],
      ['Apoio à análise de crédito', 'Use informações disponíveis como parte de uma análise responsável, junto aos critérios da sua empresa.'],
      ['Acompanhamento e prevenção', 'Conheça alternativas para acompanhar a carteira, identificar riscos e estruturar processos comerciais.'],
      ['Cobrança e recuperação', 'Entenda soluções disponíveis para organizar a abordagem de inadimplência e buscar a recuperação de valores.']
    ],
    audience: 'Lojas, prestadores de serviço, equipes comerciais e empresas que vendem a prazo ou precisam avaliar cadastros.',
    cta: 'Quero conhecer as soluções SPC',
    whatsapp: 'Olá! Quero conhecer as soluções SPC Brasil para empresas oferecidas pela Future Soluções.'
  }
];

const articles = [
  {
    slug: 'nfe-nota-fiscal-eletronica',
    title: 'NF-e: o que é a Nota Fiscal Eletrônica e quando usar',
    category: 'Documentos fiscais', readTime: '5 min',
    description: 'Entenda para que serve a NF-e, quais dados revisar antes da emissão e como reduzir erros em operações com produtos.',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Documentos e planejamento financeiro sobre uma mesa de trabalho',
    keywords: 'NF-e, nota fiscal eletrônica, emitir NF-e, nota fiscal de produto',
    intro: 'A Nota Fiscal Eletrônica (NF-e) documenta operações com mercadorias e é utilizada em diferentes operações comerciais, conforme as regras fiscais aplicáveis.',
    sections: [
      ['O que conferir antes de emitir', 'Confira os dados da empresa, destinatário, produtos, quantidades, valores, natureza da operação e informações fiscais com o contador ou responsável fiscal.'],
      ['Como evitar retrabalho', 'Mantenha os cadastros atualizados, revise os dados antes de transmitir e leia a mensagem de retorno quando o documento for rejeitado. Não repita a emissão sem verificar a situação anterior.'],
      ['Como a Future pode ajudar', 'O Emissor Fiscal reúne recursos para organizar cadastros e acompanhar documentos conforme os módulos habilitados. Consulte o manual e fale com a equipe para conhecer a solução.']
    ]
  },
  {
    slug: 'nfce-nota-fiscal-consumidor',
    title: 'NFC-e: como organizar as vendas no varejo',
    category: 'Documentos fiscais', readTime: '4 min',
    description: 'Veja os cuidados essenciais com produtos, quantidades, pagamentos e conferência de uma Nota Fiscal de Consumidor Eletrônica.',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Atendimento e pagamento em um ponto de venda',
    keywords: 'NFC-e, nota fiscal de consumidor, PDV, emissão NFC-e',
    intro: 'A NFC-e é usada em operações de venda ao consumidor final, de acordo com as regras estaduais e o enquadramento do estabelecimento.',
    sections: [
      ['Revise os itens da venda', 'Confira os produtos, quantidades, preços, descontos e total antes de concluir a operação. Mantenha o cadastro de produtos consistente.'],
      ['Confira o pagamento e o resultado', 'Revise a forma de pagamento e acompanhe a situação retornada pelo sistema. Uma tentativa rejeitada não deve ser tratada como documento autorizado.'],
      ['Prepare a equipe', 'Defina um procedimento simples de conferência no caixa e oriente os operadores a registrar a mensagem de erro para que a causa seja corrigida.']
    ]
  },
  {
    slug: 'nfse-nota-fiscal-servico',
    title: 'NFS-e: pontos importantes na emissão de nota de serviço',
    category: 'Documentos fiscais', readTime: '5 min',
    description: 'Saiba o que revisar na Nota Fiscal de Serviço Eletrônica: tomador, descrição, competência, município e informações tributárias.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Profissional revisando documentos em ambiente de escritório',
    keywords: 'NFS-e, nota fiscal de serviço, emitir nota de serviço, prestador de serviço',
    intro: 'A NFS-e registra a prestação de serviços. Os campos, regras e integrações podem variar conforme o município e o padrão utilizado.',
    sections: [
      ['Identifique corretamente o tomador', 'Confira CPF/CNPJ, nome ou razão social e demais dados solicitados antes de prosseguir.'],
      ['Descreva o serviço com clareza', 'Revise descrição, competência, valor, município e retenções aplicáveis. Confirme código de serviço e tributação com o contador.'],
      ['Acompanhe a situação', 'Depois de enviar, confira o retorno e guarde os dados do documento. Se houver rejeição, corrija a causa antes de tentar novamente.']
    ]
  },
  {
    slug: 'cte-conhecimento-transporte',
    title: 'CT-e: para que serve o Conhecimento de Transporte Eletrônico',
    category: 'Documentos fiscais', readTime: '4 min',
    description: 'Conheça a finalidade do CT-e e os dados que empresas de transporte precisam validar com seu responsável fiscal.',
    image: 'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Caminhão de carga em operação logística',
    keywords: 'CT-e, Conhecimento de Transporte Eletrônico, transporte de cargas, documento fiscal transporte',
    intro: 'O CT-e documenta prestações de serviço de transporte em situações previstas na legislação. Sua aplicação depende da operação e do enquadramento da empresa.',
    sections: [
      ['Quando é relevante', 'É associado a prestações de transporte de cargas e deve refletir a operação efetivamente realizada. Confirme a obrigatoriedade e o modelo aplicável com o contador.'],
      ['Informações que merecem atenção', 'Dados dos participantes, origem e destino, carga, valores e informações fiscais devem ser revisados com cuidado.'],
      ['Atenção sobre o sistema', 'O fluxo de emissão de CT-e no sistema de referência ainda precisa de validação funcional. Este artigo é informativo e não afirma que a emissão esteja disponível.']
    ]
  },
  {
    slug: 'cte-os-transporte-passageiros',
    title: 'CT-e OS: conheça o documento para outros serviços de transporte',
    category: 'Documentos fiscais', readTime: '4 min',
    description: 'Entenda em linhas gerais o CT-e OS, sua finalidade e por que é importante validar a operação antes de emitir documentos de transporte.',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Ônibus de transporte rodoviário em uma estrada',
    keywords: 'CT-e OS, transporte de passageiros, documento fiscal transporte, transporte rodoviário',
    intro: 'O CT-e OS é um modelo de documento fiscal eletrônico relacionado a determinadas prestações de transporte não enquadradas no CT-e de carga tradicional.',
    sections: [
      ['Identifique a operação', 'A natureza do serviço e as regras aplicáveis determinam o documento adequado. Não escolha o modelo apenas pelo nome da atividade.'],
      ['Valide os dados', 'Confirme com o contador os dados do prestador, tomador, percurso, valores e demais informações exigidas para a operação.'],
      ['Limite deste conteúdo', 'A emissão do CT-e OS no sistema de referência não foi validada como funcional. Use este texto como orientação geral, não como confirmação de disponibilidade no software.']
    ]
  },
  {
    slug: 'mdfe-manifesto-documentos-fiscais',
    title: 'MDF-e: o que é o Manifesto Eletrônico de Documentos Fiscais',
    category: 'Documentos fiscais', readTime: '4 min',
    description: 'Entenda a função do MDF-e no transporte de cargas e quais informações devem ser conferidas com o responsável fiscal.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Armazém logístico com mercadorias organizadas',
    keywords: 'MDF-e, Manifesto Eletrônico de Documentos Fiscais, transporte de cargas, logística fiscal',
    intro: 'O MDF-e reúne informações de documentos fiscais vinculados a determinadas operações de transporte, conforme a legislação aplicável.',
    sections: [
      ['Por que existe', 'O manifesto apoia o registro e o acompanhamento de informações relacionadas à carga e ao transporte em situações previstas nas regras fiscais.'],
      ['Antes de qualquer emissão', 'Confirme a necessidade do MDF-e, os documentos vinculados, dados do veículo, condutor e percurso com o responsável pela operação e o contador.'],
      ['Limite deste conteúdo', 'A emissão do MDF-e no sistema de referência ainda não foi validada funcionalmente. Não considere este artigo uma confirmação de que o módulo está pronto para uso.']
    ]
  },
  {
    slug: 'certificado-digital-empresa',
    title: 'Certificado Digital: por que sua empresa precisa cuidar da validade',
    category: 'Certificado Digital', readTime: '5 min',
    description: 'Descubra para que serve o certificado digital, como acompanhar o vencimento e como se preparar para renovar sem correria.',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Notebook e recursos de segurança digital em ambiente de trabalho',
    keywords: 'certificado digital, certificado digital A1, renovar certificado digital, e-CNPJ',
    intro: 'O certificado digital funciona como uma identidade eletrônica e pode ser utilizado para autenticação e assinatura em serviços que o aceitam, incluindo rotinas empresariais específicas.',
    sections: [
      ['Acompanhe a validade', 'Registre a data de vencimento e inicie o processo de renovação com antecedência para reduzir o risco de interrupções.'],
      ['Escolha o certificado adequado', 'A necessidade de e-CPF, e-CNPJ ou outro tipo depende do titular e da finalidade. Confirme requisitos, documentos e modalidade com um atendimento especializado.'],
      ['Proteja seus dados', 'Nunca compartilhe senhas ou arquivos privados por canais inseguros. O uso e o armazenamento devem seguir boas práticas de segurança.']
    ]
  },
  {
    slug: 'spc-brasil-consulta-cpf-cnpj',
    title: 'SPC Brasil: como consultas cadastrais podem apoiar decisões comerciais',
    category: 'SPC Brasil', readTime: '5 min',
    description: 'Conheça o papel das consultas de CPF e CNPJ na análise cadastral e saiba como usar informações de forma responsável.',
    image: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Relatórios financeiros e análise de dados empresariais',
    keywords: 'SPC Brasil, consulta CPF, consulta CNPJ, análise de crédito empresarial',
    intro: 'Consultas cadastrais e de crédito podem ajudar empresas a complementar sua análise comercial, respeitando as regras de acesso, finalidade e proteção de dados.',
    sections: [
      ['Use a informação como apoio', 'Considere os resultados junto com políticas internas, histórico comercial e demais critérios relevantes. Uma consulta isolada não substitui uma análise responsável.'],
      ['Respeite a finalidade e a privacidade', 'Acesse dados somente quando houver base e finalidade legítimas, mantenha controles de acesso e evite compartilhar resultados com pessoas não autorizadas.'],
      ['Conheça as opções disponíveis', 'A Future Soluções oferece atendimento para apresentar soluções SPC Brasil conforme o perfil e a necessidade da empresa. Recursos e condições dependem do plano contratado.']
    ]
  },
  {
    slug: 'prevencao-inadimplencia-empresas',
    title: 'Como reduzir riscos de inadimplência na sua empresa',
    category: 'Gestão empresarial', readTime: '5 min',
    description: 'Boas práticas para organizar análise de clientes, prazos, cobrança e acompanhamento de recebíveis com mais previsibilidade.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Painel de dados e indicadores usados na gestão de negócios',
    keywords: 'prevenção à inadimplência, gestão de crédito, cobrança empresarial, SPC Brasil empresas',
    intro: 'Uma política de crédito clara, combinada com acompanhamento frequente dos recebíveis, ajuda a empresa a identificar riscos e agir com organização.',
    sections: [
      ['Defina critérios antes da venda', 'Estabeleça regras proporcionais ao tipo de cliente, valor e prazo. Documente as condições comerciais e mantenha os dados cadastrais atualizados.'],
      ['Acompanhe vencimentos', 'Use lembretes, conciliação e uma rotina de contato respeitosa para identificar atrasos cedo e registrar cada tratativa.'],
      ['Avalie ferramentas de apoio', 'Soluções de consulta e monitoramento podem complementar a análise, desde que usadas de forma legítima e de acordo com as regras aplicáveis.']
    ]
  },
  {
    slug: 'cobranca-negativacao-responsavel',
    title: 'Cobrança empresarial: organização, registro e responsabilidade',
    category: 'Gestão empresarial', readTime: '5 min',
    description: 'Veja como estruturar uma rotina de cobrança, documentar contatos e avaliar soluções de recuperação de crédito de forma responsável.',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Profissional analisando números e documentos financeiros',
    keywords: 'cobrança empresarial, recuperação de crédito, negativação, SPC Brasil',
    intro: 'Uma rotina de cobrança bem organizada combina comunicação clara, histórico das tratativas e respeito às regras legais e de proteção de dados.',
    sections: [
      ['Registre cada etapa', 'Mantenha contrato, faturas, vencimentos, contatos e acordos organizados. Isso ajuda a equipe a dar continuidade ao atendimento.'],
      ['Comunique com clareza', 'Informe valores, origem do débito e canais de negociação de maneira objetiva e respeitosa. Evite exposição indevida de informações.'],
      ['Confirme os requisitos', 'Negativação e outros procedimentos de recuperação de crédito têm regras próprias. Valide documentação, prazos e requisitos antes de realizar qualquer ação.']
    ]
  }
];

const manualSteps: Record<string, string[]> = {
  'Empresa ativa': ['Entre no sistema com seu usuário autorizado.', 'Confira o nome da empresa exibido no topo da tela.', 'Se houver mais de uma empresa, selecione a correta antes de cadastrar ou emitir.', 'Após trocar de empresa, confirme novamente o contexto antes de continuar.'],
  'Dashboard': ['Abra a Dashboard pelo menu principal.', 'Localize o card do documento ou cadastro desejado.', 'Use o ícone para abrir a listagem quando esse comportamento estiver disponível.', 'Use o botão de ação do card para iniciar o fluxo correspondente e revise os dados antes de confirmar.'],
  'Clientes': ['Acesse Cadastros → Clientes.', 'Clique em Novo Cliente e preencha os campos solicitados.', 'Confira CPF/CNPJ, nome, endereço e contatos.', 'Salve e confirme se o registro aparece na listagem.'],
  'Produtos': ['Acesse Cadastros → Produtos e escolha a opção de novo cadastro.', 'Preencha identificação, código, unidade e preço.', 'Revise as informações fiscais com o responsável fiscal.', 'Salve e confira o cadastro antes de utilizá-lo em uma nota.'],
  'Abrir a listagem': ['Acesse a área de documentos fiscais e abra a listagem de NF-e.', 'Use pesquisa e filtros para localizar o registro.', 'Confira destinatário, número, data, valor e situação.', 'Abra os detalhes para revisar o retorno antes de executar outra ação.'],
  'Preparar uma emissão': ['Inicie a opção Emitir NF-e.', 'Selecione e confira o destinatário.', 'Adicione os itens e revise quantidades, valores e natureza da operação.', 'Confirme os dados fiscais com o responsável e só então transmita.'],
  'Abrir o PDV': ['Abra o card ou menu da NFC-e/PDV.', 'Adicione os produtos da venda.', 'Revise quantidades, preços, descontos e total.', 'Confira pagamento e dados do consumidor, quando aplicável, antes de concluir.'],
  'Iniciar a emissão': ['Abra a área de Nota de Serviço e escolha Emitir NFS-e.', 'Selecione o tomador correto.', 'Preencha descrição, competência, valores e informações solicitadas.', 'Revise os dados tributários com o responsável fiscal e acompanhe o retorno.'],
  'Certificado A1': ['Abra Configurações → Empresa e localize a aba Certificado Digital.', 'Selecione o arquivo de certificado fornecido para a empresa.', 'Informe a senha apenas no ambiente autorizado do sistema.', 'Use Validar certificado e confira titular e validade; não compartilhe o arquivo nem a senha.'],
  'Documento rejeitado': ['Abra o documento que retornou rejeição.', 'Leia a mensagem completa do sistema autorizador.', 'Confira os campos e cadastros relacionados ao erro.', 'Corrija a causa e verifique a situação antes de tentar transmitir novamente.']
};

const PortalPublico = () => {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const blogSlug = location.pathname.split('/').filter(Boolean)[2] || '';
  const selectedArticle = articles.find(article => article.slug === blogSlug);
  const productSlug = location.pathname.split('/').filter(Boolean)[2] || '';
  const selectedProduct = products.find(product => product.slug === productSlug);
  const isProductDetail = location.pathname.startsWith('/portal/solucoes/');
  const [openChapter, setOpenChapter] = useState<number | null>(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const isManual = location.pathname.startsWith('/portal/manuais/emissor-fiscal');
  const isManualIndex = location.pathname.startsWith('/portal/manuais');
  const isServices = location.pathname.startsWith('/portal/servicos');
  const isBlog = location.pathname.startsWith('/portal/blog');
  useEffect(() => {
    const title = selectedProduct ? selectedProduct.title + ' | Future Soluções' : selectedArticle ? selectedArticle.title + ' | Future Soluções' : isBlog ? 'Conteúdos para empresas | Future Soluções' : isManual ? 'Manual do Emissor Fiscal | Future Soluções' : isManualIndex ? 'Manuais e guias | Future Soluções' : 'Future Soluções | Manuais e soluções empresariais';
    document.title = title;
    let description = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = selectedProduct?.subheadline || selectedArticle?.description || (isBlog ? 'Artigos sobre documentos fiscais, certificado digital, SPC Brasil e gestão empresarial da Future Soluções.' : 'Acesse manuais e conheça soluções empresariais da Future Soluções em documentos fiscais, certificado digital e SPC Brasil.');
    let keywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
    if (!keywords) {
      keywords = document.createElement('meta');
      keywords.name = 'keywords';
      document.head.appendChild(keywords);
    }
    keywords.content = selectedProduct ? 'Future Soluções, ' + selectedProduct.title + ', Passo Fundo, atendimento empresarial' : selectedArticle?.keywords || 'Future Soluções, manual emissor fiscal, certificado digital, SPC Brasil, documentos fiscais';
  }, [selectedArticle, selectedProduct, isBlog, isManual, isManualIndex]);
  const filteredManuals = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return manuals;
    return manuals.filter(m => (m.title + ' ' + m.description + ' ' + m.category + ' ' + m.terms).toLowerCase().includes(term));
  }, [search]);

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
          <button className="rounded-lg border border-white/10 p-2 md:hidden" onClick={() => setMobileMenu(v => !v)} aria-label="Abrir menu">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
        {mobileMenu && <div className="grid gap-1 border-t border-white/10 px-5 py-3 md:hidden"><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal">Início</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/manuais">Manuais</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/servicos">Soluções para empresas</Link><Link className="rounded-lg px-3 py-2 hover:bg-white/5" to="/portal/blog">Conteúdos</Link></div>}
      </header>

      <main>
        {!isManual && !isManualIndex && !isServices && !isBlog && !isProductDetail && <>
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
            <div className="grid gap-5 md:grid-cols-3">{products.map(p => <Link key={p.slug} to={'/portal/solucoes/' + p.slug} aria-label={'Conheça ' + p.title} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] transition duration-300 hover:-translate-y-1 hover:border-violet-300/40 hover:bg-white/[.06] focus:outline-none focus:ring-2 focus:ring-violet-300"><div className="relative h-48 overflow-hidden"><img src={p.image} alt={p.imageAlt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#080914] via-[#080914]/10 to-transparent" /><div className="absolute bottom-4 left-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-[#080914]/80 text-violet-200 backdrop-blur"><p.icon size={23} /></div></div><div className="p-6 pt-3"><h3 className="text-xl font-bold">{p.title}</h3><p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">{p.description}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-violet-200">{p.tag}</span><span className="inline-flex items-center gap-2 text-sm font-bold text-white">Saiba mais <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></div></div></Link>)}</div>
          </section>
          <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8"><div className="flex flex-col justify-between gap-6 rounded-3xl border border-violet-300/20 bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-sky-500/10 p-7 md:flex-row md:items-center md:p-10"><div><h2 className="text-2xl font-bold">Precisa de uma orientação?</h2><p className="mt-2 max-w-2xl text-slate-300">Consulte o manual antes de começar e tenha os passos principais sempre à mão.</p></div><Link to="/portal/manuais" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-violet-100">Explorar central de ajuda <ArrowRight size={17} /></Link></div></section>
        </>}

        {isManualIndex && !isManual && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Central de ajuda</p><h1 className="mt-3 text-4xl font-black">Manuais e guias</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Encontre instruções para navegar no sistema, organizar cadastros e acompanhar documentos fiscais.</p><label className="mt-8 flex max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por assunto, tela ou documento..." className="w-full bg-transparent outline-none placeholder:text-slate-500" /></label><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredManuals.map((item, i) => <Link key={item.title} to="/portal/manuais/emissor-fiscal" className="rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:border-violet-300/30 hover:bg-white/[.06]"><div className="flex items-center justify-between"><span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">{item.category}</span><span className="text-xs text-slate-500">Guia {String(i + 1).padStart(2, '0')}</span></div><h2 className="mt-4 text-lg font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">Abrir guia <ArrowRight size={15} /></span></Link>)}</div><p className="mt-8 rounded-xl border border-amber-200/15 bg-amber-200/5 p-4 text-sm leading-6 text-amber-100/80">Observação: CT-e, CT-e OS e MDF-e aparecem na navegação do sistema de referência, mas seus fluxos ainda precisam de validação funcional. Por isso, não há aqui instruções de emissão desses documentos.</p></section>}

        {isManual && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><Link to="/portal/manuais" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Todos os manuais</Link><div className="grid gap-8 lg:grid-cols-[270px_1fr]"><aside className="h-fit rounded-2xl border border-white/10 bg-white/[.035] p-5 lg:sticky lg:top-24"><div className="flex items-center gap-3"><div className="rounded-xl bg-violet-400/15 p-3 text-violet-200"><BookOpen size={23} /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-200">Guia do usuário</p><h2 className="font-bold">Emissor Fiscal</h2></div></div><p className="mt-3 text-sm leading-6 text-slate-400">Manual de referência para os fluxos identificados no sistema.</p><div className="mt-5 space-y-1">{chapters.map((c, i) => <button key={c.title} onClick={() => { setOpenChapter(i); document.getElementById('chapter-' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">{c.title}</button>)}</div></aside><div><div className="rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-500/15 to-sky-500/10 p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">Manual público</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Manual do Emissor Fiscal</h1><p className="mt-4 max-w-3xl leading-7 text-slate-300">Guia para entender os menus, manter cadastros, revisar emissões e resolver dúvidas comuns. As opções podem variar conforme a empresa, as permissões e os módulos liberados.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Future Soluções</span><span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">Atualizado em outubro de 2026</span></div></div><div className="mt-5 rounded-xl border border-sky-200/15 bg-sky-200/5 p-4 text-sm leading-6 text-sky-100/90"><strong>Importante:</strong> este manual descreve os fluxos identificados no código de referência. Antes de realizar operações fiscais, confirme os dados com o responsável fiscal. CT-e, CT-e OS e MDF-e não são documentados como fluxos prontos, pois precisam de validação funcional.</div><div className="mt-6 space-y-4">{chapters.map((chapter, i) => <section id={'chapter-' + i} key={chapter.title} className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><button onClick={() => setOpenChapter(openChapter === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"><span className="text-lg font-bold">{chapter.title}</span><ChevronDown className={'shrink-0 text-violet-200 transition ' + (openChapter === i ? 'rotate-180' : '')} size={19} /></button>{openChapter === i && <div className="space-y-5 border-t border-white/10 px-5 py-5 md:px-6">{chapter.items.map(([title, body]) => <div key={title}><h3 className="font-semibold text-violet-100">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-300">{body}</p>{manualSteps[title] && <div className="mt-3 rounded-xl border border-violet-300/15 bg-violet-300/[.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-violet-200">Passo a passo</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">{manualSteps[title].map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol></div>}</div>)}</div>}</section>)}</div><div className="mt-6 rounded-2xl border border-white/10 p-5"><h2 className="font-bold">Precisa de suporte?</h2><p className="mt-2 text-sm leading-6 text-slate-400">Ao solicitar ajuda, informe a tela, a etapa realizada e a mensagem de erro. Não envie senhas nem o arquivo do certificado por canais inseguros.</p><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-white">Site da Future Soluções <ExternalLink size={15} /></a></div></div></div></section>}

        {isServices && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Para sua empresa</p><h1 className="mt-3 text-4xl font-black">Soluções Future Soluções</h1><p className="mt-4 max-w-2xl leading-7 text-slate-400">Conheça nossas frentes de atendimento. As condições comerciais e a disponibilidade devem ser confirmadas diretamente com nossa equipe.</p><div className="mt-9 grid gap-5 md:grid-cols-3">{products.map(p => <Link key={p.slug} to={'/portal/solucoes/' + p.slug} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] transition hover:-translate-y-1 hover:border-violet-300/30"><img src={p.image} alt={p.imageAlt} loading="lazy" className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><div className="p-6"><p.icon size={27} className="text-violet-200" /><h2 className="mt-4 text-xl font-bold">{p.title}</h2><p className="mt-3 text-sm leading-7 text-slate-400">{p.description}</p><span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-violet-100">{p.tag} <ArrowRight size={14} /></span></div></Link>)}</div><div className="mt-9 rounded-2xl border border-violet-300/20 bg-violet-400/10 p-6"><h2 className="text-xl font-bold">Vamos encontrar a solução adequada?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Entre em contato pelos canais oficiais publicados no site da Future Soluções para confirmar escopo, valores e disponibilidade.</p><a href="https://futuresolucoes.com.br/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 font-semibold hover:bg-violet-400">Visitar site oficial <ExternalLink size={16} /></a></div></section>}

        {isProductDetail && selectedProduct && <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <Link to="/portal/servicos" className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16} /> Todas as soluções</Link>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_.9fr]">
            <div>
              <p className="inline-flex rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-violet-200">{selectedProduct.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">{selectedProduct.headline}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{selectedProduct.subheadline}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={'https://wa.me/5554981028290?text=' + encodeURIComponent(selectedProduct.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3.5 font-bold shadow-lg shadow-violet-950/30 transition hover:bg-violet-400">{selectedProduct.cta} <ArrowRight size={18} /></a>
                {selectedProduct.slug === 'emissor-fiscal' && <Link to="/portal/manuais/emissor-fiscal" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 font-semibold transition hover:bg-white/10">Consultar manual <BookOpen size={17} /></Link>}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">Atendimento Future Soluções. Valores, disponibilidade, funcionalidades e condições serão confirmados pela equipe antes da contratação.</p>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-2 shadow-2xl shadow-violet-950/20">
              <img src={selectedProduct.image} alt={selectedProduct.imageAlt} className="h-[300px] w-full rounded-2xl object-cover sm:h-[390px]" />
              <div className="absolute inset-x-2 bottom-2 rounded-b-2xl bg-gradient-to-t from-[#080914] via-[#080914]/90 to-transparent px-6 pb-6 pt-14"><div className="flex items-center gap-3"><div className="rounded-xl border border-white/15 bg-white/10 p-3 text-violet-200 backdrop-blur"><selectedProduct.icon size={25} /></div><div><p className="font-bold">{selectedProduct.title}</p><p className="mt-1 text-sm text-slate-300">Uma solução com orientação especializada</p></div></div></div>
            </div>
          </div>
          <div className="mt-14 grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Como podemos ajudar</p><h2 className="mt-3 text-3xl font-black">Mais clareza para tomar o próximo passo.</h2><p className="mt-4 leading-7 text-slate-400">A equipe Future ajuda você a entender as opções, o que está incluído e quais etapas fazem sentido para sua empresa.</p><p className="mt-5 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-300"><strong className="text-white">Para quem é:</strong><br />{selectedProduct.audience}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">{selectedProduct.benefits.map(([title, body]) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200"><BadgeCheck size={21} /></div><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}</div>
          </div>
          <div className="mt-12 rounded-3xl border border-violet-300/20 bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-sky-500/10 p-7 md:p-10">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-200">Próximo passo</p><h2 className="mt-3 text-2xl font-black sm:text-3xl">Vamos conversar sobre o que sua empresa precisa?</h2><p className="mt-3 max-w-2xl leading-7 text-slate-300">Fale diretamente com a Future Soluções. Nossa equipe pode esclarecer dúvidas e confirmar opções, valores e disponibilidade.</p>
            <a href={'https://wa.me/5554981028290?text=' + encodeURIComponent(selectedProduct.whatsapp)} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 font-bold text-slate-950 transition hover:bg-violet-100">{selectedProduct.cta} <ArrowRight size={18} /></a>
          </div>
          {selectedProduct.slug === 'spc-brasil' && <p className="mt-5 text-xs leading-5 text-slate-500">SPC Brasil é uma marca de seu respectivo titular. A disponibilidade de consultas, produtos e condições depende da solução contratada e da confirmação da equipe Future.</p>}
        </section>}

        {isBlog && <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <Link to="/portal" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Início</Link>
          {selectedArticle ? <article className="mx-auto max-w-4xl">
            <Link to="/portal/blog" className="inline-flex items-center gap-2 text-sm text-violet-200 hover:text-white"><ArrowLeft size={15} /> Todos os conteúdos</Link>
            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10"><img src={selectedArticle.image} alt={selectedArticle.imageAlt} className="h-64 w-full object-cover sm:h-96" loading="lazy" /><div className="bg-white/[.035] p-6 sm:p-10">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider text-violet-200"><span>{selectedArticle.category}</span><span className="text-slate-500">•</span><span>{selectedArticle.readTime} de leitura</span></div>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{selectedArticle.title}</h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">{selectedArticle.description}</p>
              <p className="mt-6 leading-8 text-slate-300">{selectedArticle.intro}</p>
              <div className="mt-8 space-y-7">{selectedArticle.sections.map(([heading, paragraph]) => <section key={heading}><h2 className="text-xl font-bold text-white sm:text-2xl">{heading}</h2><p className="mt-3 leading-8 text-slate-300">{paragraph}</p></section>)}</div>
              <div className="mt-10 rounded-2xl border border-violet-300/20 bg-violet-400/[.07] p-5"><h2 className="text-lg font-bold">Quer conhecer as soluções da Future?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Fale com nossa equipe para entender as opções adequadas à realidade da sua empresa.</p><Link to="/portal/servicos" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold hover:bg-violet-400">Conhecer soluções <ArrowRight size={16} /></Link></div>
            </div></div>
          </article> : <>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Conteúdo e orientação</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">10 conteúdos para sua empresa</h1>
            <p className="mt-4 max-w-3xl leading-7 text-slate-400">Artigos práticos sobre NF-e, NFC-e, NFS-e, documentos de transporte, certificado digital, SPC Brasil e gestão de crédito. Cada conteúdo tem imagem, descrição e palavras-chave para facilitar a descoberta nos mecanismos de busca.</p>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{articles.map((article, index) => <article key={article.slug} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] transition hover:-translate-y-1 hover:border-violet-300/30">
              <Link to={'/portal/blog/' + article.slug} className="block h-full">
                <div className="relative overflow-hidden"><img src={article.image} alt={article.imageAlt} loading="lazy" className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-3 top-3 rounded-full border border-white/15 bg-[#080914]/85 px-3 py-1 text-xs font-semibold text-violet-100">{article.category}</span></div>
                <div className="p-5"><p className="text-xs text-slate-500">Artigo {String(index + 1).padStart(2, '0')} · {article.readTime}</p><h2 className="mt-3 text-xl font-bold leading-snug">{article.title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{article.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-200">Ler artigo <ArrowRight size={15} /></span></div>
              </Link>
            </article>)}</div>
          </>}
        </section>}
      </main>

      <footer className="border-t border-white/10 bg-black/20"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between lg:px-8"><div><p className="font-semibold text-slate-300">Future Soluções</p><p className="mt-1">Tecnologia, orientação e soluções para empresas.</p></div><div className="flex flex-wrap gap-5"><Link to="/portal/manuais" className="hover:text-white">Manuais</Link><Link to="/portal/servicos" className="hover:text-white">Soluções</Link></div><p>© {new Date().getFullYear()} Future Soluções</p></div></footer>
    </div>
  );
};

export default PortalPublico;
