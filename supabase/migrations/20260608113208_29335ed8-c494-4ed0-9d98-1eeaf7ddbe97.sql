
CREATE TABLE public.metas_faturamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referencia TEXT NOT NULL,
  ordem INT NOT NULL,
  ponto_zero NUMERIC NOT NULL DEFAULT 40889.37,
  faturamento NUMERIC,
  salario NUMERIC NOT NULL DEFAULT 2800,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ordem)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_faturamento TO authenticated;
GRANT ALL ON public.metas_faturamento TO service_role;
ALTER TABLE public.metas_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own metas" ON public.metas_faturamento FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER metas_faturamento_updated_at BEFORE UPDATE ON public.metas_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
