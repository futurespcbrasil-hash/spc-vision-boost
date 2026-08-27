CREATE TABLE public.cnpj_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  encontrados integer NOT NULL DEFAULT 0,
  ativos integer NOT NULL DEFAULT 0,
  com_telefone integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnpj_lotes TO authenticated;
GRANT ALL ON public.cnpj_lotes TO service_role;
ALTER TABLE public.cnpj_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam seus lotes" ON public.cnpj_lotes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gestores visualizam todos os lotes" ON public.cnpj_lotes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_cnpj_lotes_updated BEFORE UPDATE ON public.cnpj_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cnpj_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.cnpj_lotes(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  razao_social text,
  nome_fantasia text,
  situacao text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  telefone text,
  telefone_2 text,
  email text,
  socios jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  data_consulta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnpj_consultas TO authenticated;
GRANT ALL ON public.cnpj_consultas TO service_role;
ALTER TABLE public.cnpj_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam suas consultas cnpj" ON public.cnpj_consultas
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gestores visualizam todas as consultas cnpj" ON public.cnpj_consultas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_cnpj_consultas_updated BEFORE UPDATE ON public.cnpj_consultas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cnpj_consultas_lote ON public.cnpj_consultas(lote_id);
CREATE INDEX idx_cnpj_consultas_user ON public.cnpj_consultas(user_id);
CREATE INDEX idx_cnpj_lotes_user ON public.cnpj_lotes(user_id);