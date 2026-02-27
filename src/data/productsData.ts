export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  price: string;
  features: string[];
}

export type ProductCategory = {
  key: string;
  label: string;
  icon: string;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { key: 'cheque', label: 'Cheque PF / PJ', icon: 'FileCheck' },
  { key: 'cadastro', label: 'Cadastro', icon: 'UserSearch' },
  { key: 'credito_pf_pj', label: 'Crédito PF / PJ', icon: 'CreditCard' },
  { key: 'imobiliario', label: 'Imobiliário', icon: 'Building2' },
  { key: 'credito_pj', label: 'Crédito PJ', icon: 'Briefcase' },
  { key: 'positivo', label: 'Crédito + Cadastro Positivo', icon: 'TrendingUp' },
  { key: 'agro', label: 'Agro PF / PJ', icon: 'Wheat' },
  { key: 'adicionais', label: 'Adicionais', icon: 'PlusCircle' },
  { key: 'insumos', label: 'Insumos & Antifraude', icon: 'Shield' },
];

export const PRODUCTS: Product[] = [
  // CHEQUE PF / PJ
  {
    id: '4', code: '4', name: 'SóCheque', category: 'cheque',
    description: 'Informações de Cheques Sem Fundos do Banco Central + cheque lojista SPC Brasil + informações cadastrais.',
    price: 'R$ 0,66',
    features: ['Cheques Sem Fundos (Banco Central)', 'Cheque Lojista SPC Brasil', 'Informações Cadastrais'],
  },
  {
    id: '15', code: '15', name: 'SPCheque Analítica', category: 'cheque',
    description: 'Informa se o cheque foi sustado, cancelado, roubado ou extraviado + CCF + cheque lojista SPC Brasil + informações cadastrais.',
    price: 'R$ 2,65',
    features: ['Cheque Sustado/Cancelado/Roubado/Extraviado', 'CCF', 'Cheque Lojista SPC Brasil', 'Informações Cadastrais'],
  },
  // CADASTRO
  {
    id: '11', code: '11', name: 'Confirme PF', category: 'cadastro',
    description: 'Informações Receita Federal, nome completo, nome da mãe, título de eleitor e endereço.',
    price: 'R$ 1,32',
    features: ['Dados Receita Federal', 'Nome Completo', 'Nome da Mãe', 'Título de Eleitor', 'Endereço'],
  },
  {
    id: '5', code: '5', name: 'Confirme PJ', category: 'cadastro',
    description: 'Informações Receita Federal, razão social, data de fundação, controle societário, quadro administrativo, capital social, endereço e I.E.',
    price: 'R$ 3,59',
    features: ['Dados Receita Federal', 'Razão Social', 'Data de Fundação', 'Controle Societário', 'Quadro Administrativo', 'Capital Social', 'Endereço', 'Inscrição Estadual'],
  },
  {
    id: '89', code: '89', name: 'SPC Busca', category: 'cadastro',
    description: 'Permite localizar o número de CPF ou CNPJ, através do nome, razão social ou nome fantasia.',
    price: 'R$ 2,37',
    features: ['Localização de CPF', 'Localização de CNPJ', 'Busca por Nome/Razão Social/Nome Fantasia'],
  },
  {
    id: '332', code: '332', name: 'SPC Localiza PJ', category: 'cadastro',
    description: 'Informações pessoa jurídica Receita Federal, razão social, data de fundação, endereço, telefone fixo e celular.',
    price: 'R$ 2,32',
    features: ['Dados Receita Federal PJ', 'Razão Social', 'Data de Fundação', 'Endereço', 'Telefone Fixo', 'Celular'],
  },
  {
    id: '331', code: '331', name: 'SPC Localiza PF', category: 'cadastro',
    description: 'Informações pessoa física Receita Federal, nome completo, nome da mãe, título de eleitor, endereço, telefone fixo e celular.',
    price: 'R$ 2,05',
    features: ['Dados Receita Federal PF', 'Nome Completo', 'Nome da Mãe', 'Título de Eleitor', 'Endereço', 'Telefone Fixo', 'Celular'],
  },
  // CRÉDITO PF / PJ
  {
    id: '323', code: '323', name: 'SPC Mix Mais', category: 'credito_pf_pj',
    description: 'Dados cadastrais + capital social + registros no SPC Brasil + protesto nacional + cheque lojista + CCF + histórico de consultas + SPCheque Analítica.',
    price: 'R$ 9,05',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Protesto Nacional', 'Cheque Lojista', 'CCF', 'Histórico de Consultas', 'SPCheque Analítica'],
  },
  {
    id: 'spc-maxi', code: 'SPC BRASIL', name: 'SPC Maxi', category: 'credito_pf_pj',
    description: 'Dados cadastrais + capital social + registros SPC Brasil + protesto nacional + cheque lojista + CCF + histórico de consultas + SPCheque Analítica + pendências financeiras Serasa Experian.',
    price: 'R$ 15,84',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Protesto Nacional', 'Cheque Lojista', 'CCF', 'Histórico de Consultas', 'SPCheque Analítica', 'Pendências Financeiras Serasa'],
  },
  // IMOBILIÁRIO
  {
    id: '320', code: '320', name: 'Consulta Completa de CPF', category: 'imobiliario',
    description: 'SPCheque Analítica + pendências financeiras Serasa + Ações + Participações em Empresas + Score de Crédito + Renda Presumida.',
    price: 'R$ 24,19',
    features: ['SPCheque Analítica', 'Pendências Financeiras Serasa', 'Ações', 'Participações em Empresas', 'Score de Crédito', 'Renda Presumida'],
  },
  // CRÉDITO PJ
  {
    id: '337', code: '337', name: 'SPC Relatório Completo', category: 'credito_pj',
    description: 'Dados cadastrais, capital social, histórico de consulta, histórico de pagamentos, relacionamento com fornecedores, registro SPC Brasil, pendências Serasa, protestos, ações cíveis, cheques sem fundos, controle societário e alerta de inconsistências comerciais.',
    price: 'R$ 47,76',
    features: ['Dados Cadastrais', 'Capital Social', 'Histórico de Consulta', 'Histórico de Pagamentos', 'Relacionamento com Fornecedores', 'Registro SPC Brasil', 'Pendências Serasa', 'Protestos Nacionais', 'Ações Cíveis', 'Recuperação e Falências', 'Cheques sem Fundos', 'Controle Societário', 'Quadro Administrativo', 'Alerta de Inconsistências'],
  },
  {
    id: '940', code: '940', name: 'SPC Relatório Avançado', category: 'credito_pj',
    description: 'Relatório Completo + Score PJ+. Dados cadastrais, histórico de pagamentos, pendências Serasa, protestos, ações cíveis, controle societário e Score PJ+.',
    price: 'R$ 50,92',
    features: ['Tudo do Relatório Completo', 'Score PJ+', 'Análise Avançada de Risco'],
  },
  {
    id: '461', code: '461', name: 'SPC Relatório + Perfil Financeiro PJ', category: 'credito_pj',
    description: 'SPC Relatório Completo + resumo das principais informações financeiras obtidas a partir da Demonstração Contábil mais atual.',
    price: 'R$ 60,26',
    features: ['Tudo do Relatório Completo', 'Perfil Financeiro', 'Demonstração Contábil', 'Resumo Financeiro'],
  },
  {
    id: '930', code: '930', name: 'SPC Mais', category: 'credito_pj',
    description: 'Dados cadastrais + capital social + registros SPC Brasil + protesto estadual + Score de Crédito 12 meses + CCF + cheque lojista + histórico de consultas.',
    price: 'R$ 7,08',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Protesto Estadual', 'Score de Crédito 12 Meses', 'CCF', 'Cheque Lojista', 'Histórico de Consultas'],
  },
  // CRÉDITO + CADASTRO POSITIVO
  {
    id: '674', code: '674', name: 'SPC + Positivo Básica PF', category: 'positivo',
    description: 'Dados cadastrais + registros SPC Brasil + protesto nacional + cheque lojista + CCF + histórico de consultas + Score + Positivo + índice de pontualidade.',
    price: 'R$ 11,82',
    features: ['Dados Cadastrais', 'Registros SPC Brasil', 'Protesto Nacional', 'Cheque Lojista', 'CCF', 'Histórico de Consultas', 'Score', 'Cadastro Positivo', 'Índice de Pontualidade'],
  },
  {
    id: '675', code: '675', name: 'SPC + Positivo Intermediária PF', category: 'positivo',
    description: 'Dados cadastrais + registros SPC Brasil + pendências Serasa + protesto + CCF + score + positivo + limite de crédito + renda presumida + pontualidade + comportamento em gastos + operações SCR.',
    price: 'R$ 21,66',
    features: ['Dados Cadastrais', 'Registros SPC Brasil', 'Pendências Serasa', 'Protesto Nacional', 'CCF', 'Score + Positivo', 'Limite de Crédito', 'Renda Presumida', 'Pontualidade', 'Comportamento em Gastos', 'Operações SCR', 'Comprometimento Renda'],
  },
  {
    id: '676', code: '676', name: 'SPC + Positivo Avançada PF', category: 'positivo',
    description: 'Dados cadastrais + registros SPC Brasil + pendências Serasa + score + positivo + limite de crédito + renda presumida + participações + histórico de pagamento positivo + operações SCR.',
    price: 'R$ 33,20',
    features: ['Dados Cadastrais', 'Registros SPC Brasil', 'Pendências Serasa', 'Score + Positivo', 'Limite de Crédito', 'Renda Presumida', 'Participações em Empresas', 'Histórico Pagamento Positivo', 'Histórico Operações SCR', 'Comprometimento Renda'],
  },
  {
    id: '677', code: '677', name: 'SPC + Positivo Básica PJ', category: 'positivo',
    description: 'Dados cadastrais + capital social + registros SPC Brasil + protesto nacional + CCF + cheque lojista + Score 12 meses + histórico de consultas + pontualidade + gasto financeiro estimado PJ.',
    price: 'R$ 15,84',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Protesto Nacional', 'CCF', 'Cheque Lojista', 'Score 12 Meses', 'Histórico de Consultas', 'Pontualidade', 'Gasto Financeiro Estimado'],
  },
  {
    id: '678', code: '678', name: 'SPC + Positivo Intermediária I PJ', category: 'positivo',
    description: 'Dados cadastrais + capital social + registros SPC + pendências Serasa + protesto + CCF + Score 12 meses + controle societário + pontualidade + comportamento em gastos + operações SCR.',
    price: 'R$ 21,15',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Pendências Serasa', 'Protesto Nacional', 'CCF', 'Score 12 Meses', 'Controle Societário', 'Quadro Administrativo', 'Pontualidade', 'Comportamento em Gastos', 'Operações SCR'],
  },
  {
    id: '680', code: '680', name: 'SPC + Positivo Intermediária II PJ', category: 'positivo',
    description: 'Dados cadastrais + capital social + registros SPC + pendências Serasa + protesto + Ação + CCF + Score 12 meses + limite de crédito PJ + pontualidade + comportamento em gastos + operações SCR.',
    price: 'R$ 43,04',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Pendências Serasa', 'Protesto Nacional', 'Ações', 'CCF', 'Score 12 Meses', 'Limite de Crédito PJ', 'Pontualidade', 'Comportamento em Gastos', 'Operações SCR'],
  },
  {
    id: '679', code: '679', name: 'SPC + Positivo Avançada PJ', category: 'positivo',
    description: 'Dados cadastrais + capital social + registros SPC + pendências Serasa + protesto + Ação + Score PJ + controle societário + limite de crédito PJ + histórico pagamento positivo + operações SCR.',
    price: 'R$ 63,93',
    features: ['Dados Cadastrais', 'Capital Social', 'Registros SPC Brasil', 'Pendências Serasa', 'Protesto Nacional', 'Ações', 'Score PJ', 'Controle Societário', 'Quadro Administrativo', 'Limite de Crédito PJ', 'Histórico Pagamento Positivo', 'Operações SCR', 'Gasto Financeiro Estimado'],
  },
  // AGRO
  {
    id: '932', code: '932', name: 'SPC Agro Completo PF', category: 'agro',
    description: 'Dados cadastrais + registro SPC + pendências Serasa + histórico operações agronegócio + score agro + operações SCR + protesto + ações + participações + alerta óbito + grupo econômico.',
    price: 'R$ 73,89',
    features: ['Dados Cadastrais', 'Registro SPC Brasil', 'Pendências Serasa', 'Histórico Operações Agronegócio', 'Score Agro', 'Operações SCR', 'Protesto Nacional', 'Ações', 'Participações em Empresas', 'PEP', 'Alerta Óbito', 'Mercado de Capitais', 'Grupo Econômico'],
  },
  {
    id: '933', code: '933', name: 'SPC Agro Completo PJ', category: 'agro',
    description: 'Dados cadastrais + capital social + registro SPC + pendências Serasa + histórico operações agronegócio + score agro + operações SCR + protesto + ações + participações + CADIN + grupo econômico.',
    price: 'R$ 89,62',
    features: ['Dados Cadastrais', 'Capital Social', 'Registro SPC Brasil', 'Pendências Serasa', 'Histórico Operações Agronegócio', 'Score Agro', 'Operações SCR', 'Protesto Nacional', 'Ações', 'Participações em Empresas/Sócios', 'CADIN', 'Mercado de Capitais', 'Grupo Econômico'],
  },
  // ADICIONAIS
  { id: '168', code: '168', name: '+ Pefin Serasa', category: 'adicionais', description: 'Pendências financeiras Serasa Experian.', price: 'R$ 6,54', features: ['Pendências Financeiras Serasa'] },
  { id: '318', code: '318', name: '+ Participação em Empresas', category: 'adicionais', description: 'Informações de participações societárias.', price: 'R$ 4,93', features: ['Participações Societárias'] },
  { id: '268', code: '268', name: '+ Controle Societário', category: 'adicionais', description: 'Controle societário da empresa.', price: 'R$ 4,93', features: ['Controle Societário'] },
  { id: '267', code: '267', name: '+ Quadro Administrativo', category: 'adicionais', description: 'Quadro administrativo da empresa.', price: 'R$ 3,04', features: ['Quadro Administrativo'] },
  { id: '314', code: '314', name: '+ Ação', category: 'adicionais', description: 'Ações judiciais.', price: 'R$ 8,47', features: ['Ações Judiciais'] },
  { id: '316', code: '316', name: '+ Renda Presumida', category: 'adicionais', description: 'Renda presumida do consumidor.', price: 'R$ 2,90', features: ['Renda Presumida'] },
  { id: '144', code: '144', name: '+ Score de Crédito', category: 'adicionais', description: 'Score de crédito do consumidor.', price: 'R$ 2,18', features: ['Score de Crédito'] },
  { id: '328', code: '328', name: '+ Limite de Crédito Sugerido PF', category: 'adicionais', description: 'Limite de crédito sugerido para pessoa física.', price: 'R$ 3,53', features: ['Limite de Crédito Sugerido PF'] },
  { id: '400', code: '400', name: '+ Faturamento Presumido PJ', category: 'adicionais', description: 'Faturamento presumido da empresa.', price: 'R$ 21,38', features: ['Faturamento Presumido PJ'] },
  { id: '403', code: '403', name: '+ Limite de Crédito PJ', category: 'adicionais', description: 'Limite de crédito para pessoa jurídica.', price: 'R$ 21,38', features: ['Limite de Crédito PJ'] },
  { id: '402', code: '402', name: '+ Alerta de Identidade PF', category: 'adicionais', description: 'Alerta de identidade para prevenção de fraude.', price: 'R$ 11,62', features: ['Alerta de Identidade PF'] },
  { id: '452', code: '452', name: '+ Gasto Estimado PJ', category: 'adicionais', description: 'Gasto estimado da empresa.', price: 'R$ 26,18', features: ['Gasto Estimado PJ'] },
  { id: '451', code: '451', name: '+ Risco de Crédito do Setor PJ', category: 'adicionais', description: 'Análise de risco de crédito do setor.', price: 'R$ 26,18', features: ['Risco de Crédito do Setor'] },
  { id: '458', code: '458', name: '+ Quadro Social e Adm Completo', category: 'adicionais', description: 'Quadro social e administrativo mais completo.', price: 'R$ 26,18', features: ['Quadro Social Completo', 'Quadro Administrativo Completo'] },
  { id: '489', code: '489', name: '+ Comprometimento de Renda PF', category: 'adicionais', description: 'Comprometimento de renda mensal PF.', price: 'R$ 21,90', features: ['Comprometimento de Renda Mensal'] },
  { id: '467', code: '467', name: '+ Índice Relacionamento Mercado PF', category: 'adicionais', description: 'Índice de relacionamento no mercado PF.', price: 'R$ 14,59', features: ['Índice Relacionamento Mercado PF'] },
  { id: '475', code: '475', name: '+ Índice Relacionamento Mercado PJ', category: 'adicionais', description: 'Índice de relacionamento no mercado PJ.', price: 'R$ 17,54', features: ['Índice Relacionamento Mercado PJ'] },
  { id: '499', code: '499', name: '+ Score de Recuperação PF', category: 'adicionais', description: 'Score de recuperação de crédito PF.', price: 'R$ 2,90', features: ['Score de Recuperação PF'] },
  { id: '585', code: '585', name: '+ Perfil Comportamental', category: 'adicionais', description: 'Perfil comportamental do consumidor.', price: 'R$ 7,15', features: ['Perfil Comportamental'] },
  { id: '681', code: '681', name: '+ Classificação Risco Débitos Ativos', category: 'adicionais', description: 'Classificação de risco dos débitos ativos.', price: 'R$ 4,33', features: ['Classificação Risco Débitos'] },
  { id: '692', code: '692', name: '+ Grupo Econômico', category: 'adicionais', description: 'Informações do grupo econômico.', price: 'R$ 8,44', features: ['Grupo Econômico'] },
  { id: '708', code: '708', name: '+ Dívidas Órgãos Públicos - CADIN', category: 'adicionais', description: 'Dívidas com órgãos públicos (CADIN).', price: 'R$ 12,27', features: ['CADIN'] },
  { id: '723', code: '723', name: '+ Score de Recuperação PJ', category: 'adicionais', description: 'Score de recuperação de crédito PJ.', price: 'R$ 4,36', features: ['Score de Recuperação PJ'] },
  { id: '750', code: '750', name: '+ Score PJ MEI', category: 'adicionais', description: 'Score específico para MEI.', price: 'R$ 6,59', features: ['Score PJ MEI'] },
  { id: '439', code: '439', name: '+ Status Receita Federal Online', category: 'adicionais', description: 'Status na Receita Federal em tempo real.', price: 'R$ 0,51', features: ['Status RF Online'] },
  { id: '838', code: '838', name: '+ Operações SCR', category: 'adicionais', description: 'Operações no Sistema de Informações de Crédito.', price: 'R$ 7,73', features: ['Operações SCR'] },
  { id: '839', code: '839', name: '+ Histórico de Operações SCR', category: 'adicionais', description: 'Histórico completo de operações no SCR.', price: 'R$ 16,69', features: ['Histórico Operações SCR'] },
  { id: '901', code: '901', name: '+ Inscrição Estadual', category: 'adicionais', description: 'Consulta de Inscrição Estadual.', price: 'R$ 1,65', features: ['Inscrição Estadual'] },
  { id: '943', code: '943', name: '+ Quantidade de Funcionários', category: 'adicionais', description: 'Quantidade de funcionários da empresa.', price: 'R$ 0,44', features: ['Quantidade de Funcionários'] },
  // INSUMOS & ANTIFRAUDE
  { id: 'ins-1', code: '-', name: 'Insumos Participações em Empresas e Sócios', category: 'insumos', description: 'Participações em empresas e sócios detalhado.', price: 'R$ 10,62', features: ['Participações em Empresas', 'Dados dos Sócios'] },
  { id: 'ins-2', code: '-', name: 'Histórico Operações em Agronegócios', category: 'insumos', description: 'Histórico de operações no agronegócio.', price: 'R$ 18,10', features: ['Histórico Agronegócio'] },
  { id: 'ins-3', code: '-', name: 'Score Agro', category: 'insumos', description: 'Score específico para o agronegócio.', price: 'R$ 22,49', features: ['Score Agro'] },
  { id: 'ins-4', code: '-', name: 'Participação no Mercado de Capitais', category: 'insumos', description: 'Participação no mercado de capitais.', price: 'R$ 6,38', features: ['Mercado de Capitais'] },
  { id: 'ins-5', code: '-', name: 'Índice de Pontualidade de Pagamento', category: 'insumos', description: 'Índice de pontualidade nos pagamentos.', price: 'R$ 7,15', features: ['Pontualidade de Pagamento'] },
  { id: 'ins-6', code: '-', name: 'Índice de Comportamento em Gastos', category: 'insumos', description: 'Índice de comportamento em gastos.', price: 'R$ 7,15', features: ['Comportamento em Gastos'] },
  { id: 'ins-7', code: '-', name: 'Movimentação no Cadastro Positivo', category: 'insumos', description: 'Movimentação no cadastro positivo.', price: 'R$ 4,71', features: ['Movimentação Cadastro Positivo'] },
  { id: 'ins-8', code: '-', name: 'Índice de Consultas por Segmento', category: 'insumos', description: 'Índice de consultas segmentado.', price: 'R$ 4,71', features: ['Consultas por Segmento'] },
  { id: 'ins-9', code: '-', name: 'Score + Positivo', category: 'insumos', description: 'Score combinado com dados positivos.', price: 'R$ 17,61', features: ['Score + Positivo'] },
  { id: 'ins-10', code: '-', name: 'Score PJ +', category: 'insumos', description: 'Score avançado para pessoa jurídica.', price: 'R$ 9,51', features: ['Score PJ+'] },
  { id: 'ins-11', code: '-', name: 'Histórico de Pagamento Positivo', category: 'insumos', description: 'Histórico detalhado de pagamentos positivos.', price: 'R$ 15,45', features: ['Histórico Pagamento Positivo'] },
  { id: 'ins-12', code: '-', name: 'Gasto Financeiro Estimado PJ', category: 'insumos', description: 'Gasto financeiro estimado da empresa.', price: 'R$ 15,67', features: ['Gasto Financeiro Estimado'] },
  { id: 'ins-13', code: '-', name: 'Renda Presumida + Positivo', category: 'insumos', description: 'Renda presumida com dados positivos.', price: 'R$ 3,02', features: ['Renda Presumida + Positivo'] },
  { id: 'ins-14', code: '-', name: 'Renda Presumida Plus', category: 'insumos', description: 'Renda presumida versão plus.', price: 'R$ 0,60', features: ['Renda Presumida Plus'] },
  { id: 'ins-15', code: '-', name: 'Score + Positivo Financeiro', category: 'insumos', description: 'Score positivo segmento financeiro.', price: 'R$ 9,17', features: ['Score Positivo Financeiro'] },
  { id: 'ins-16', code: '-', name: 'Score + Positivo Varejo', category: 'insumos', description: 'Score positivo segmento varejo.', price: 'R$ 9,17', features: ['Score Positivo Varejo'] },
  { id: 'ins-17', code: '-', name: 'Pessoas Expostas Politicamente - PEP', category: 'insumos', description: 'Verificação de Pessoa Exposta Politicamente.', price: 'R$ 1,33', features: ['PEP'] },
  { id: 'ins-18', code: '-', name: 'Score de Similaridade Cadastral', category: 'insumos', description: 'Score de similaridade para prevenção de fraude.', price: 'R$ 1,35', features: ['Similaridade Cadastral'] },
  { id: 'ins-19', code: '-', name: 'Alerta de CPF Suspeito', category: 'insumos', description: 'Alerta de CPF suspeito de fraude.', price: 'R$ 3,15', features: ['Alerta CPF Suspeito'] },
  { id: 'ins-20', code: '-', name: 'Análise de Documentos SPC', category: 'insumos', description: 'Análise de autenticidade de documentos.', price: 'R$ 7,68', features: ['Análise de Documentos'] },
  { id: 'ins-21', code: '-', name: 'SPC Valida Celular', category: 'insumos', description: 'Validação de número de celular.', price: 'R$ 2,11', features: ['Validação de Celular'] },
  { id: 'ins-22', code: '-', name: 'Alerta Óbito', category: 'insumos', description: 'Alerta de óbito para prevenção de fraude.', price: 'R$ 1,94', features: ['Alerta Óbito'] },
  { id: 'ins-23', code: '-', name: 'Alerta de Identidade à Fraude', category: 'insumos', description: 'Alerta de identidade para prevenção de fraude.', price: 'R$ 1,35', features: ['Alerta Identidade Fraude'] },
  { id: 'ins-24', code: '-', name: 'Registro e Notificação Inteligente', category: 'insumos', description: 'Registro e notificação inteligente de devedores.', price: 'R$ 8,97', features: ['Registro e Notificação'] },
];
