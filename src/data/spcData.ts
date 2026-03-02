export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email?: string;
  cpfCnpj: string;
  type: 'PF' | 'PJ';
  origin: string;
  product: string;
  status: KanbanStage;
  observations: string;
  interactions: Interaction[];
  createdAt: string;
}

export interface Interaction {
  id: string;
  date: string;
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note';
  content: string;
}

export type KanbanStage = 
  | 'lead_novo'
  | 'contato_realizado'
  | 'comparacao_enviada'
  | 'em_negociacao'
  | 'fechamento'
  | 'venda_ganha'
  | 'venda_perdida';

export const KANBAN_STAGES: { key: KanbanStage; label: string; color: string }[] = [
  { key: 'lead_novo', label: 'Lead Novo', color: 'bg-kanban-lead' },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'bg-kanban-contact' },
  { key: 'comparacao_enviada', label: 'Comparação Enviada', color: 'bg-kanban-sent' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-kanban-negotiation' },
  { key: 'fechamento', label: 'Fechamento', color: 'bg-kanban-closing' },
  { key: 'venda_ganha', label: 'Venda Ganha', color: 'bg-kanban-won' },
  { key: 'venda_perdida', label: 'Venda Perdida', color: 'bg-kanban-lost' },
];

export interface ComparisonProduct {
  name: string;
  provider: 'spc' | 'serasa' | 'equifax';
  features: Record<string, boolean | string>;
}

export interface ScheduleEvent {
  id: string;
  leadId: string;
  leadName: string;
  date: string;
  time: string;
  note: string;
  done: boolean;
}

export const COMPARISON_DATA: { spc: ComparisonProduct; competitor: ComparisonProduct; category: string }[] = [
  {
    category: 'Relatório Completo PF',
    spc: {
      name: 'SPC Maxi',
      provider: 'spc',
      features: {
        'Dados Cadastrais': true,
        'Pendências Financeiras': true,
        'Protestos': true,
        'Cheques sem Fundo (CCF)': true,
        'Histórico de Consultas': true,
        'Score de Crédito': true,
        'Dados Positivos': true,
        'Renda Presumida': true,
        'Participações Societárias': true,
        'Base Integrada Serasa': true,
      },
    },
    competitor: {
      name: 'CredNet Serasa',
      provider: 'serasa',
      features: {
        'Dados Cadastrais': true,
        'Pendências Financeiras': true,
        'Protestos': true,
        'Cheques sem Fundo (CCF)': true,
        'Histórico de Consultas': true,
        'Score de Crédito': true,
        'Dados Positivos': false,
        'Renda Presumida': false,
        'Participações Societárias': false,
        'Base Integrada Serasa': false,
      },
    },
  },
  {
    category: 'Relatório Completo PJ',
    spc: {
      name: 'SPC Relatório Completo PJ',
      provider: 'spc',
      features: {
        'Dados Cadastrais': true,
        'Quadro Societário': true,
        'Pendências': true,
        'Protestos': true,
        'Cheques sem Fundo': true,
        'Ações Judiciais': true,
        'Faturamento Presumido': true,
        'Score Empresarial': true,
        'Dados Positivos PJ': true,
        'Análise de Risco': true,
      },
    },
    competitor: {
      name: 'Relato Serasa PJ',
      provider: 'serasa',
      features: {
        'Dados Cadastrais': true,
        'Quadro Societário': true,
        'Pendências': true,
        'Protestos': true,
        'Cheques sem Fundo': true,
        'Ações Judiciais': true,
        'Faturamento Presumido': false,
        'Score Empresarial': true,
        'Dados Positivos PJ': false,
        'Análise de Risco': false,
      },
    },
  },
  {
    category: 'Positivo Avançado PJ',
    spc: {
      name: 'SPC Positivo Avançado PJ',
      provider: 'spc',
      features: {
        'Dados Positivos Completos': true,
        'Histórico de Pagamentos': true,
        'Pontualidade': true,
        'Compromissos Assumidos': true,
        'Limite de Crédito Sugerido': true,
        'Comportamento de Pagamento': true,
        'Visão 360°': true,
        'Integração com Score': true,
      },
    },
    competitor: {
      name: 'Equifax Positivo PJ',
      provider: 'equifax',
      features: {
        'Dados Positivos Completos': true,
        'Histórico de Pagamentos': true,
        'Pontualidade': true,
        'Compromissos Assumidos': false,
        'Limite de Crédito Sugerido': false,
        'Comportamento de Pagamento': true,
        'Visão 360°': false,
        'Integração com Score': false,
      },
    },
  },
];

export const SALES_ARGUMENTS: { category: string; icon: string; arguments: { title: string; text: string }[] }[] = [
  {
    category: 'Contra Serasa',
    icon: '📌',
    arguments: [
      {
        title: 'Base de dados mais completa',
        text: 'O SPC Brasil integra dados da base Serasa, entregando uma visão mais completa do consumidor. Ou seja, com o SPC você tem TUDO que a Serasa oferece, e muito mais.',
      },
      {
        title: 'Dados Positivos inclusos',
        text: 'O SPC já inclui dados positivos (Cadastro Positivo) em seus relatórios sem custo adicional. Na Serasa, esse módulo é cobrado separadamente.',
      },
      {
        title: 'Melhor custo-benefício',
        text: 'Comparando produto a produto, o SPC Brasil entrega mais informações por um valor competitivo. Você paga menos e recebe mais dados para tomar decisões.',
      },
      {
        title: 'Renda presumida e participações',
        text: 'Nossos relatórios incluem renda presumida e participações societárias, dados essenciais para análise de crédito que a Serasa não inclui no pacote básico.',
      },
    ],
  },
  {
    category: 'Contra Equifax',
    icon: '📌',
    arguments: [
      {
        title: 'Cobertura nacional superior',
        text: 'O SPC Brasil possui a maior rede de informações comerciais do país, com dados de mais de 2.700 Câmaras de Dirigentes Lojistas.',
      },
      {
        title: 'Integração de bases',
        text: 'Enquanto a Equifax trabalha com base própria limitada, o SPC integra múltiplas fontes incluindo dados da Serasa, oferecendo visão 360° do cliente.',
      },
      {
        title: 'Score mais preciso',
        text: 'O Score SPC é construído com a maior base de dados do Brasil, o que resulta em uma previsão de inadimplência mais assertiva.',
      },
    ],
  },
  {
    category: 'Objeção de Preço',
    icon: '💰',
    arguments: [
      {
        title: 'Custo por informação',
        text: 'Se dividir o valor do relatório pela quantidade de informações que ele entrega, o SPC tem o menor custo por dado do mercado. Cada real investido retorna em segurança na decisão.',
      },
      {
        title: 'Economia com inadimplência',
        text: 'Um relatório de R$15 pode evitar uma inadimplência de R$5.000. O custo do relatório é insignificante comparado ao prejuízo de uma venda mal feita.',
      },
      {
        title: 'Pacotes e volumes',
        text: 'Para volumes maiores, temos condições especiais. Quanto mais você consulta, menor o custo unitário. Podemos montar um pacote sob medida.',
      },
    ],
  },
  {
    category: 'Por que SPC entrega mais',
    icon: '🏆',
    arguments: [
      {
        title: 'Maior base de dados do Brasil',
        text: 'Com mais de 180 milhões de registros, o SPC Brasil possui a maior e mais completa base de informações de crédito do país.',
      },
      {
        title: 'Rede CDL nacional',
        text: 'A rede de CDLs alimenta o SPC com dados exclusivos do comércio varejista que nenhum outro bureau possui.',
      },
      {
        title: 'Atualização em tempo real',
        text: 'Os dados são atualizados em tempo real, garantindo que sua consulta reflita a situação atual do consumidor ou empresa.',
      },
    ],
  },
];

export const MOCK_LEADS: Lead[] = [];

export const MOCK_SCHEDULE: ScheduleEvent[] = [];
