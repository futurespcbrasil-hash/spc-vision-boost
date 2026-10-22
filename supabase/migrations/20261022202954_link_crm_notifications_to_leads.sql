ALTER TABLE public.whatsapp_notifications
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid();
DECLARE stage_name text;
BEGIN
  SELECT s.label INTO stage_name FROM public.kanban_stages s
  WHERE s.funnel = NEW.funnel AND s.key = NEW.status ORDER BY s.position LIMIT 1;
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.lead_assignment_history(lead_id, previous_assignee, new_assignee, changed_by)
      VALUES (NEW.id, NULL, NEW.assigned_to, actor);
      IF NEW.assigned_to IS DISTINCT FROM actor THEN
        INSERT INTO public.whatsapp_notifications(user_id, title, body, created_by, lead_id)
        VALUES (NEW.assigned_to, 'Novo lead direcionado a você',
          'O lead "' || COALESCE(NEW.name, 'Sem nome') || '" foi atribuído a você no funil ' ||
          COALESCE(NEW.funnel, 'Comercial') || ', etapa ' || COALESCE(stage_name, NEW.status, 'Lead Novo') || '.',
          actor, NEW.id);
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
        'O lead "' || COALESCE(NEW.name, 'Sem nome') || '" foi direcionado para você no funil ' ||
        COALESCE(NEW.funnel, 'Comercial') || ', etapa ' || COALESCE(stage_name, NEW.status, 'Lead Novo') || '.',
        actor, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_lead_assignment_change() FROM PUBLIC, anon, authenticated;
