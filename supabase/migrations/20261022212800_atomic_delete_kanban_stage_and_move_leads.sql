CREATE OR REPLACE FUNCTION public.delete_kanban_stage(p_funnel text, p_stage_key text, p_fallback_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE stage_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT user_id INTO stage_owner FROM public.kanban_stages
  WHERE funnel = p_funnel AND key = p_stage_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;
  IF NOT (
    auth.uid() = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR stage_owner = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized to delete this stage'; END IF;
  IF p_stage_key = p_fallback_key OR NOT EXISTS (
    SELECT 1 FROM public.kanban_stages WHERE funnel = p_funnel AND key = p_fallback_key
  ) THEN RAISE EXCEPTION 'Invalid fallback stage'; END IF;
  UPDATE public.leads SET status = p_fallback_key WHERE funnel = p_funnel AND status = p_stage_key;
  DELETE FROM public.kanban_stages WHERE funnel = p_funnel AND key = p_stage_key;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_kanban_stage(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_kanban_stage(text, text, text) TO authenticated;
