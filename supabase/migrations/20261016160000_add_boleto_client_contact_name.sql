-- Nome da pessoa responsável pelo recebimento dos boletos.
-- Mantém compatibilidade com cadastros existentes e permite preencher o contato no submenu Clientes.
ALTER TABLE public.boleto_clientes
  ADD COLUMN IF NOT EXISTS contato_nome text;

COMMENT ON COLUMN public.boleto_clientes.contato_nome IS
  'Nome da pessoa de contato para envio de boletos e cobranças.';
