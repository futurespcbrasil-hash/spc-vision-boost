export const USER_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Painel inicial' },
  { key: 'crm', label: 'Funil comercial', description: 'Etapas e oportunidades' },
  { key: 'leads', label: 'Leads', description: 'Cadastro e acompanhamento de leads' },
  { key: 'agenda', label: 'Agenda', description: 'Compromissos e tarefas' },
  { key: 'relatorios', label: 'Relatórios', description: 'Relatórios comerciais' },
  { key: 'metas', label: 'Metas', description: 'Metas e desempenho' },
  { key: 'notas', label: 'Notas', description: 'Anotações internas' },
  { key: 'chat', label: 'Chat interno', description: 'Mensagens internas' },
  { key: 'consultas_spc', label: 'Consulta SPC', description: 'Consultas de crédito' },
  { key: 'consulta_cnpj', label: 'Consulta Receita/CNPJ', description: 'Consulta cadastral de CNPJ' },
  { key: 'consulta_sintegra', label: 'Consulta Sintegra', description: 'Consulta estadual' },
  { key: 'consulta_cnpj_lote', label: 'Consulta CNPJ em lote', description: 'Consultas em lote' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Conversas e ajustes' },
  { key: 'future_remote', label: 'Future Remote', description: 'Computadores, histórico e suporte' },
  { key: 'comissoes', label: 'Comissões', description: 'Relatórios e cadastro de vendedores' },
  { key: 'parceiros', label: 'Parceiros SPC', description: 'Parceiros, indicações e relatórios' },
  { key: 'indicacoes_atendimento', label: 'Indicações (Atendimento)', description: 'Cadastro de clientes indicados pelo Atendimento' },
  { key: 'financeiro', label: 'Financeiro', description: 'Boletos e clientes financeiros' },
  { key: 'produtos', label: 'Produtos', description: 'Catálogo de produtos' },
  { key: 'comparador', label: 'Comparador', description: 'Comparações comerciais' },
  { key: 'gerar_link', label: 'Gerar link', description: 'Links de comparação' },
  { key: 'revendas', label: 'Revendas', description: 'Gestão de revendas' },
  { key: 'perfil', label: 'Meu perfil', description: 'Dados pessoais' },
  { key: 'usuarios', label: 'Usuários', description: 'Contas, perfis e permissões' },
] as const;

export type UserModuleKey = typeof USER_MODULES[number]['key'];

export const DEFAULT_MODULES_BY_ROLE: Record<'vendedor' | 'gestor' | 'atendimento', UserModuleKey[]> = {
  vendedor: [
    'dashboard', 'crm', 'leads', 'agenda', 'relatorios', 'metas', 'notas', 'chat',
    'consultas_spc', 'consulta_cnpj', 'consulta_sintegra', 'comparador', 'gerar_link', 'perfil',
  ],
  gestor: USER_MODULES.map((module) => module.key) as UserModuleKey[],
  atendimento: ['dashboard', 'leads', 'agenda', 'chat', 'whatsapp', 'financeiro', 'perfil', 'indicacoes_atendimento'],
};
