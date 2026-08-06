ALTER TABLE public.vendedores_comissoes 
ADD COLUMN email text,
ADD COLUMN chave_pix text,
ADD COLUMN dados_bancarios text;

COMMENT ON COLUMN public.vendedores_comissoes.email IS 'Email do vendedor';
COMMENT ON COLUMN public.vendedores_comissoes.chave_pix IS 'Chave PIX para pagamento';
COMMENT ON COLUMN public.vendedores_comissoes.dados_bancarios IS 'Dados bancários para depósito';