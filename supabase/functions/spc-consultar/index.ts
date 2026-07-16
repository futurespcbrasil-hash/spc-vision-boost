// Edge function: SPC Brasil consulta (mock)
// Retorna estrutura ampla para validar renderização dinâmica.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const { tipoDocumento = 'CPF', documento = '', tipoConsulta = 'SPC_MAXI' } = body ?? {}

    // Mock com múltiplos grupos, listas e objetos aninhados
    const mock = {
      requisicao: {
        tipoDocumento,
        documento,
        tipoConsulta,
        dataConsulta: new Date().toISOString(),
        protocolo: 'MOCK-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      },
      dadosCadastrais: {
        nome: 'JOÃO DA SILVA SANTOS',
        cpf: documento || '000.000.000-00',
        nascimento: '1985-04-12',
        idade: 40,
        sexo: 'Masculino',
        nomeMae: 'MARIA DOS SANTOS',
        nomePai: 'JOSÉ DA SILVA',
        estadoCivil: 'Casado',
        escolaridade: 'Superior Completo',
        profissao: 'Engenheiro',
        renda: 8500.00,
        situacaoReceitaFederal: 'REGULAR',
        dataInscricaoRF: '2001-03-15',
      },
      enderecos: [
        { tipo: 'Residencial', logradouro: 'Rua das Flores', numero: '123', complemento: 'Apto 401', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000' },
        { tipo: 'Comercial', logradouro: 'Av. Paulista', numero: '1000', complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', cep: '01310-100' },
      ],
      telefones: [
        { tipo: 'Celular', ddd: '11', numero: '98888-1234', operadora: 'Vivo' },
        { tipo: 'Residencial', ddd: '11', numero: '3333-4567', operadora: '' },
      ],
      emails: [
        { email: 'joao.silva@email.com', principal: true },
        { email: 'joao@empresa.com.br', principal: false },
      ],
      score: {
        pontuacao: 742,
        faixa: 'B',
        probabilidadeInadimplencia: '8,5%',
        descricao: 'Bom pagador. Baixo risco de inadimplência nos próximos 12 meses.',
        variaveis: [
          { nome: 'Tempo de relacionamento', valor: '12 anos' },
          { nome: 'Consultas recentes', valor: '3' },
          { nome: 'Pendências ativas', valor: '0' },
        ],
        mensagens: ['Score calculado com base em 24 meses de histórico.'],
      },
      pendenciasFinanceiras: [
        { empresa: 'LOJAS EXEMPLO S/A', contrato: '123456', valor: 450.75, data: '2024-08-10', natureza: 'Cartão de Crédito', situacao: 'Aberta', origem: 'SPC', cidade: 'São Paulo', uf: 'SP' },
        { empresa: 'FINANCIADORA XYZ', contrato: '987654', valor: 1280.00, data: '2024-11-22', natureza: 'Financiamento', situacao: 'Aberta', origem: 'SPC', cidade: 'Rio de Janeiro', uf: 'RJ' },
      ],
      protestos: [
        { cartorio: '3º Ofício de Protestos - SP', valor: 2500.00, data: '2023-06-14', cidade: 'São Paulo', uf: 'SP' },
      ],
      cheques: [],
      cadastroPositivo: {
        status: 'Ativo',
        dataAdesao: '2020-01-15',
        historicoPagamentos: [
          { mes: '2026-05', pontualidade: '100%' },
          { mes: '2026-04', pontualidade: '100%' },
          { mes: '2026-03', pontualidade: '95%' },
        ],
      },
      scr: {
        totalOperacoes: 4,
        totalVencer: 12500.00,
        totalVencido: 0,
        instituicoes: ['BANCO A', 'BANCO B'],
      },
      participacoesEmpresas: [
        { cnpj: '12.345.678/0001-90', razaoSocial: 'EMPRESA EXEMPLO LTDA', qualificacao: 'Sócio-Administrador', dataEntrada: '2015-03-01' },
      ],
      consultasRecentes: [
        { data: '2026-06-01', consulente: 'BANCO XPTO', finalidade: 'Concessão de crédito' },
        { data: '2026-05-20', consulente: 'LOJA ABC', finalidade: 'Crediário' },
      ],
      alertas: [
        { tipo: 'INFO', mensagem: 'Documento sem restrições graves.' },
      ],
      mensagens: [
        'Consulta realizada com sucesso.',
        'Este é um resultado mock para validação da integração.',
      ],
    }

    return new Response(JSON.stringify(mock), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
