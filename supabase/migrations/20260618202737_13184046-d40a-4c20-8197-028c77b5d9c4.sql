
-- Enum tipo de parceiro
DO $$ BEGIN
  CREATE TYPE public.tipo_parceiro_spc AS ENUM ('contabilidade','software','certificadora','consultoria','outro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela parceiros_spc
CREATE TABLE public.parceiros_spc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  responsavel text,
  whatsapp text,
  email text,
  cidade text,
  endereco text,
  observacoes text,
  tipo_parceiro public.tipo_parceiro_spc NOT NULL DEFAULT 'outro',
  percentual_comissao numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_spc TO authenticated;
GRANT ALL ON public.parceiros_spc TO service_role;

ALTER TABLE public.parceiros_spc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor ve seus parceiros, gestor ve todos (select)"
  ON public.parceiros_spc FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Usuario insere proprios parceiros"
  ON public.parceiros_spc FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario atualiza proprios, gestor atualiza todos"
  ON public.parceiros_spc FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Usuario deleta proprios, gestor deleta todos"
  ON public.parceiros_spc FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_parceiros_spc_updated
  BEFORE UPDATE ON public.parceiros_spc
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela clientes_indicados
CREATE TABLE public.clientes_indicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.parceiros_spc(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  responsavel text,
  telefone text,
  whatsapp text,
  email text,
  cidade text,
  data_indicacao date NOT NULL DEFAULT CURRENT_DATE,
  produto_vendido text,
  valor_venda numeric(12,2) NOT NULL DEFAULT 0,
  comissao_gerada numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_indicados TO authenticated;
GRANT ALL ON public.clientes_indicados TO service_role;

ALTER TABLE public.clientes_indicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedor ve seus indicados, gestor ve todos (select)"
  ON public.clientes_indicados FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Usuario insere proprios indicados"
  ON public.clientes_indicados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario atualiza proprios indicados, gestor todos"
  ON public.clientes_indicados FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Usuario deleta proprios indicados, gestor todos"
  ON public.clientes_indicados FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_clientes_indicados_updated
  BEFORE UPDATE ON public.clientes_indicados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clientes_indicados_parceiro ON public.clientes_indicados(parceiro_id);
CREATE INDEX idx_parceiros_spc_user ON public.parceiros_spc(user_id);
CREATE INDEX idx_clientes_indicados_user ON public.clientes_indicados(user_id);
