ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendimento';

CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own module permissions" ON public.user_module_permissions;
CREATE POLICY "Users can view own module permissions"
ON public.user_module_permissions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can manage module permissions" ON public.user_module_permissions;
CREATE POLICY "Managers can manage module permissions"
ON public.user_module_permissions FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'dalprapf1@gmail.com'
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'dalprapf1@gmail.com'
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_name text;
BEGIN
  requested_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, requested_name, NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email = EXCLUDED.email;

  -- Cadastro público não pode conceder privilégios elevados.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.vendedores_comissoes (nome, user_id, email)
  VALUES (requested_name, NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
