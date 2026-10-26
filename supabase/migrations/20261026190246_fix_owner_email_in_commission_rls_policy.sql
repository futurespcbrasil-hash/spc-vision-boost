DROP POLICY IF EXISTS "Gestor altera configuração de comissão Atendimento" ON public.atendimento_comissao_config;
CREATE POLICY "Gestor altera configuração de comissão Atendimento"
  ON public.atendimento_comissao_config
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role))
    OR lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  )
  WITH CHECK (
    (SELECT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role))
    OR lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  );
