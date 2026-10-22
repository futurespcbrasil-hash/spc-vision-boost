CREATE OR REPLACE FUNCTION public.assign_lead_to_user(p_lead_id uuid, p_assignee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_assignee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = p_assignee
  ) THEN RAISE EXCEPTION 'Invalid assignee'; END IF;
  UPDATE public.leads SET assigned_to = p_assignee WHERE id = p_lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_lead_to_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_lead_to_user(uuid, uuid) TO authenticated;
