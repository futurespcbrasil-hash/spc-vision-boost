CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_name text;
BEGIN
  IF COALESCE(NEW.raw_app_meta_data->>'provisioned_by_admin', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Cadastro público desativado. Solicite acesso ao administrador do CRM SPC.';
  END IF;

  requested_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, requested_name, NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.vendedores_comissoes (nome, user_id, email)
  VALUES (requested_name, NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
