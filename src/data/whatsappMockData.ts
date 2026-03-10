export interface WhatsAppAccount {
  id: string;
  name: string;
  number: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  type: 'text' | 'image' | 'document' | 'audio';
  fileName?: string;
}

export interface WhatsAppConversation {
  id: string;
  contactName: string;
  contactNumber: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  accountId: string;
  accountName: string;
  messages: WhatsAppMessage[];
  leadId?: string;
  leadCompany?: string;
  leadStage?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export const mockAccounts: WhatsAppAccount[] = [
  { id: '1', name: 'Vendas 1', number: '+55 11 99999-0001', status: 'connected', connectedAt: '2026-03-08T10:00:00' },
  { id: '2', name: 'Cobrança', number: '+55 11 99999-0002', status: 'connected', connectedAt: '2026-03-07T14:30:00' },
  { id: '3', name: 'Suporte', number: '+55 11 99999-0003', status: 'disconnected', connectedAt: '' },
];

export const mockConversations: WhatsAppConversation[] = [
  {
    id: '1', contactName: 'João Silva', contactNumber: '+55 11 98888-1111',
    lastMessage: 'Boa tarde, gostaria de saber mais sobre o SPC Score.', lastMessageTime: '14:32',
    unreadCount: 2, accountId: '1', accountName: 'Vendas 1',
    leadId: 'lead-1', leadCompany: 'Tech Solutions', leadStage: 'Negociação',
    messages: [
      { id: 'm1', text: 'Olá João! Como posso ajudar?', timestamp: '14:20', fromMe: true, type: 'text' },
      { id: 'm2', text: 'Boa tarde, gostaria de saber mais sobre o SPC Score.', timestamp: '14:32', fromMe: false, type: 'text' },
    ],
  },
  {
    id: '2', contactName: 'Maria Oliveira', contactNumber: '+55 21 97777-2222',
    lastMessage: 'Obrigada, vou analisar a proposta.', lastMessageTime: '13:15',
    unreadCount: 0, accountId: '1', accountName: 'Vendas 1',
    leadId: 'lead-2', leadCompany: 'Oliveira & Cia', leadStage: 'Proposta',
    messages: [
      { id: 'm3', text: 'Maria, segue a proposta comercial em anexo.', timestamp: '12:45', fromMe: true, type: 'text' },
      { id: 'm4', text: 'Obrigada, vou analisar a proposta.', timestamp: '13:15', fromMe: false, type: 'text' },
    ],
  },
  {
    id: '3', contactName: 'Carlos Santos', contactNumber: '+55 31 96666-3333',
    lastMessage: 'Segue o boleto atualizado.', lastMessageTime: '11:00',
    unreadCount: 1, accountId: '2', accountName: 'Cobrança',
    messages: [
      { id: 'm5', text: 'Carlos, seu boleto vence amanhã.', timestamp: '10:30', fromMe: true, type: 'text' },
      { id: 'm6', text: 'Pode me enviar atualizado?', timestamp: '10:45', fromMe: false, type: 'text' },
      { id: 'm7', text: 'Segue o boleto atualizado.', timestamp: '11:00', fromMe: true, type: 'document', fileName: 'boleto_carlos.pdf' },
    ],
  },
  {
    id: '4', contactName: 'Ana Costa', contactNumber: '+55 41 95555-4444',
    lastMessage: 'Perfeito, fechamos então!', lastMessageTime: '09:40',
    unreadCount: 0, accountId: '1', accountName: 'Vendas 1',
    leadId: 'lead-4', leadCompany: 'Costa Engenharia', leadStage: 'Fechamento',
    messages: [
      { id: 'm8', text: 'Ana, consegui o desconto que pediu.', timestamp: '09:20', fromMe: true, type: 'text' },
      { id: 'm9', text: 'Perfeito, fechamos então!', timestamp: '09:40', fromMe: false, type: 'text' },
    ],
  },
];

export const mockTemplates: WhatsAppTemplate[] = [
  {
    id: '1', name: 'Boas-vindas',
    content: 'Olá {nome}! Bem-vindo(a) ao SPC Brasil. Como posso ajudá-lo(a) hoje?',
    createdAt: '2026-03-01',
  },
  {
    id: '2', name: 'Envio de Boleto',
    content: 'Olá {nome}, tudo bem?\n\nSegue seu boleto referente ao serviço deste mês.\n\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nSegue o boleto:\n{boleto_link}',
    createdAt: '2026-03-02',
  },
  {
    id: '3', name: 'Follow-up Proposta',
    content: 'Olá {nome}! Tudo bem?\n\nGostaria de saber se teve a oportunidade de analisar nossa proposta para a {empresa}.\n\nFico à disposição para esclarecer qualquer dúvida!',
    createdAt: '2026-03-03',
  },
];
