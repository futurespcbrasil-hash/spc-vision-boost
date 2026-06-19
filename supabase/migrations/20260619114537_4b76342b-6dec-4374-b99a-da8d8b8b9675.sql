
-- Vendas mensais por cliente indicado
CREATE TABLE public.vendas_indicadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_indicado_id UUID NOT NULL REFERENCES public.clientes_indicados(id) ON DELETE CASCADE,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_indicadas TO authenticated;
GRANT ALL ON public.vendas_indicadas TO service_role;
ALTER TABLE public.vendas_indicadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor ve suas vendas, gestor ve todas" ON public.vendas_indicadas FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Usuario insere proprias vendas" ON public.vendas_indicadas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario atualiza proprias, gestor todas" ON public.vendas_indicadas FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Usuario deleta proprias, gestor todas" ON public.vendas_indicadas FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_vendas_indicadas_updated BEFORE UPDATE ON public.vendas_indicadas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Post-its / Notas
CREATE TABLE public.notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT,
  cor TEXT NOT NULL DEFAULT 'amarelo',
  data_lembrete DATE,
  concluido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated;
GRANT ALL ON public.notas TO service_role;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprias notas" ON public.notas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
