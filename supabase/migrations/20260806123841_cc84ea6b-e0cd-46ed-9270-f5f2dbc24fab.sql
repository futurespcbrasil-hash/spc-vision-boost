CREATE TABLE public.vendedores_comissoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nome text NOT NULL,
    cidade text,
    percentual_comissao numeric NOT NULL DEFAULT 0,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores_comissoes TO authenticated;
GRANT ALL ON public.vendedores_comissoes TO service_role;

-- RLS
ALTER TABLE public.vendedores_comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores podem gerenciar tudo"
    ON public.vendedores_comissoes
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores podem ver"
    ON public.vendedores_comissoes
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'vendedor'));
