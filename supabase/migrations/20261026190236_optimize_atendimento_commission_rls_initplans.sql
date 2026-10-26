-- Wrap stable role checks in scalar subqueries so Postgres can evaluate them
-- once per statement instead of repeatedly for every row.
DROP POLICY IF EXISTS "Atendimento consulta configuração de comissão" ON public.atendimento_comissao_config;
CREATE POLICY "Atendimento consulta configuração de comissão"
  ON public.atendimento_comissao_config
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'atendimento'::public.app_role))
    OR (SELECT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role))
    OR lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  );

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
    OR lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail@gmail.com'
  );

DROP POLICY IF EXISTS "Gestor consulta configuração de comissão Atendimento" ON public.atendimento_comissao_config;
CREATE POLICY "Gestor consulta configuração de comissão Atendimento"
  ON public.atendimento_comissao_config
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'gestor'::public.app_role))
    OR lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  );
