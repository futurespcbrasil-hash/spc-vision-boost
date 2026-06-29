GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_spc TO authenticated;
GRANT ALL ON public.parceiros_spc TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_indicados TO authenticated;
GRANT ALL ON public.clientes_indicados TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_indicadas TO authenticated;
GRANT ALL ON public.vendas_indicadas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated;
GRANT ALL ON public.notas TO service_role;