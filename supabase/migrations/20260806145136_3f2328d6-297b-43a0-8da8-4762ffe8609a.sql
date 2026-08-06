CREATE TABLE IF NOT EXISTS public.importacoes_comissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    nome_importacao TEXT NOT NULL,
    mes_referencia DATE,
    dados_processados JSONB NOT NULL,
    total_vendas NUMERIC(15,2) DEFAULT 0,
    total_comissao NUMERIC(15,2) DEFAULT 0,
    quantidade_vendas INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_comissoes TO authenticated;
GRANT ALL ON public.importacoes_comissoes TO service_role;

ALTER TABLE public.importacoes_comissoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'importacoes_comissoes' AND policyname = 'Gestores podem gerenciar todas as importações'
    ) THEN
        CREATE POLICY "Gestores podem gerenciar todas as importações"
        ON public.importacoes_comissoes
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'gestor'))
        WITH CHECK (public.has_role(auth.uid(), 'gestor'));
    END IF;
END
$$;
