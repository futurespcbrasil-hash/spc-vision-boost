-- Adicionar colunas para persistência de metadados na tabela de importações
ALTER TABLE public.importacoes_comissoes 
ADD COLUMN IF NOT EXISTS dados_vendedores JSONB,
ADD COLUMN IF NOT EXISTS audit_log JSONB;

-- Garantir que as permissões continuam corretas (mesmo que a tabela já exista)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_comissoes TO authenticated;
GRANT ALL ON public.importacoes_comissoes TO service_role;
