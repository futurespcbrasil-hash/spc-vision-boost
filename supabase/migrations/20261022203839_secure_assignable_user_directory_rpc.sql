CREATE OR REPLACE FUNCTION public.get_assignable_users()
RETURNS TABLE(user_id uuid, display_name text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN QUERY SELECT p.user_id, p.display_name, p.email
  FROM public.profiles p WHERE p.user_id IS NOT NULL ORDER BY p.display_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_assignable_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assignable_users() TO authenticated;
