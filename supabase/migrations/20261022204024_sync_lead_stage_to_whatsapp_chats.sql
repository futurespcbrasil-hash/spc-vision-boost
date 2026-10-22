CREATE OR REPLACE FUNCTION public.sync_lead_stage_to_whatsapp_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.funnel IS DISTINCT FROM OLD.funnel THEN
    UPDATE public.whatsapp_chats SET funnel_stage = NEW.status WHERE lead_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_lead_stage_to_whatsapp_chats() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_lead_stage_to_whatsapp_chats_trigger ON public.leads;
CREATE TRIGGER sync_lead_stage_to_whatsapp_chats_trigger
AFTER UPDATE OF status, funnel ON public.leads
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.funnel IS DISTINCT FROM OLD.funnel)
EXECUTE FUNCTION public.sync_lead_stage_to_whatsapp_chats();
