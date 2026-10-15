-- Keep public signup roles in sync with auth metadata and create seller records.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  requested_role text;
  requested_name text;
BEGIN
  requested_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), split_part(COALESCE(NEW.email, ''), '@', 1));
  requested_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'gestor' THEN 'gestor'
    ELSE 'vendedor'
  END;

  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, requested_name, NEW.email)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF requested_role = 'vendedor' THEN
    INSERT INTO public.vendedores_comissoes (nome, user_id, email)
    VALUES (requested_name, NEW.id, NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;
