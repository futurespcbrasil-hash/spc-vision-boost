CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); actor_name text; stage_name text;
BEGIN
  SELECT p.display_name INTO actor_name FROM public.profiles p WHERE p.user_id = actor;
  SELECT s.label INTO stage_name FROM public.kanban_stages s
  WHERE s.funnel = NEW.funnel AND s.key = NEW.status ORDER BY s.position LIMIT 1;
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.lead_assignment_history(lead_id, previous_assignee, new_assignee, changed_by)
      VALUES (NEW.id, NULL, NEW.assigned_to, actor);
      IF NEW.assigned_to IS DISTINCT FROM actor THEN
        INSERT INTO public.whatsapp_notifications(user_id, title, body, created_by, lead_id)
        VALUES (NEW.assigned_to, 'Novo lead direcionado a você',
          COALESCE(actor_name, 'Um usuário') || ' direcionou o lead "' || COALESCE(NEW.name, 'Sem nome') ||
          '" para você no funil ' || COALESCE(NEW.funnel, 'Comercial') || ', etapa ' ||
          COALESCE(stage_name, NEW.status, 'Lead Novo') || '.', actor, NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.lead_assignment_history(lead_id, previous_assignee, new_assignee, changed_by)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, actor);
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO public.whatsapp_notifications(user_id, title, body, created_by, lead_id)
      VALUES (NEW.assigned_to, 'Lead direcionado a você',
        COALESCE(actor_name, 'Um usuário') || ' direcionou o lead "' || COALESCE(NEW.name, 'Sem nome') ||
        '" para você no funil ' || COALESCE(NEW.funnel, 'Comercial') || ', etapa ' ||
        COALESCE(stage_name, NEW.status, 'Lead Novo') || '.', actor, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_lead_assignment_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_lead_from_interaction_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.interactions IS DISTINCT FROM OLD.interactions THEN NEW.last_interaction_at := now(); END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_lead_from_interaction_log() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lead_interactions_touch_timestamp ON public.leads;
CREATE TRIGGER lead_interactions_touch_timestamp
BEFORE UPDATE OF interactions ON public.leads
FOR EACH ROW WHEN (NEW.interactions IS DISTINCT FROM OLD.interactions)
EXECUTE FUNCTION public.touch_lead_from_interaction_log();
