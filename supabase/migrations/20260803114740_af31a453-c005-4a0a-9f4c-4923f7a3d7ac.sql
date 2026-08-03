create policy "whatsapp media auth read" on storage.objects for select to authenticated using (bucket_id = 'whatsapp-media');
create policy "whatsapp media auth insert" on storage.objects for insert to authenticated with check (bucket_id = 'whatsapp-media');
create policy "whatsapp media auth update" on storage.objects for update to authenticated using (bucket_id = 'whatsapp-media');
create policy "whatsapp media auth delete" on storage.objects for delete to authenticated using (bucket_id = 'whatsapp-media');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'vendedor'))
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN others THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendedor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END;

  RETURN NEW;
END;
$function$;