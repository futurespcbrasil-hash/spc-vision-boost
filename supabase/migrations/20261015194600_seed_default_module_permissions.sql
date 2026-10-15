WITH module_catalog(module_key) AS (
  VALUES
  ('dashboard'),('crm'),('leads'),('agenda'),('relatorios'),('metas'),('notas'),('chat'),
  ('consultas_spc'),('consulta_cnpj'),('consulta_sintegra'),('consulta_cnpj_lote'),
  ('whatsapp'),('future_remote'),('comissoes'),('parceiros'),('financeiro'),
  ('produtos'),('comparador'),('gerar_link'),('revendas'),('perfil'),('usuarios')
),
account_roles AS (
  SELECT u.id AS user_id,
    lower(u.email) = 'dalprapf1@gmail.com' AS is_owner,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='gestor'::public.app_role) AS is_gestor,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='atendimento'::public.app_role) AS is_atendimento
  FROM auth.users u
),
defaults AS (
  SELECT ar.user_id, mc.module_key,
    CASE
      WHEN ar.is_owner OR ar.is_gestor THEN true
      WHEN ar.is_atendimento THEN mc.module_key = ANY(ARRAY['dashboard','leads','agenda','chat','whatsapp','financeiro','perfil'])
      ELSE mc.module_key = ANY(ARRAY['dashboard','crm','leads','agenda','relatorios','metas','notas','chat','consultas_spc','consulta_cnpj','consulta_sintegra','comparador','gerar_link','perfil'])
    END AS can_access
  FROM account_roles ar CROSS JOIN module_catalog mc
)
INSERT INTO public.user_module_permissions (user_id, module_key, can_access)
SELECT user_id, module_key, can_access FROM defaults
ON CONFLICT (user_id, module_key) DO NOTHING;
