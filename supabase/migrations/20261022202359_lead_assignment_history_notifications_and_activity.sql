ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  previous_assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  new_assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view lead assignment history"
ON public.lead_assignment_history FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE OR REPLACE FUNCTION public.log_lead_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.lead_assignment_history(lead_id, previous_assignee, new_assignee, changed_by)
      VALUES (NEW.id, NULL, NEW.assigned_to, actor);
      IF NEW.assigned_to IS DISTINCT FROM actor THEN
        INSERT INTO public.whatsapp_notifications(user_id, title, body, created_by)
        VALUES (NEW.assigned_to, 'Novo lead direcionado a você',
          'O lead "' || COALESCE(NEW.name, 'Sem nome') || '" foi atribuído a você no funil ' ||
          COALESCE(NEW.funnel, 'Comercial') || ', etapa ' || COALESCE(NEW.status, 'Lead Novo') || '.', actor);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.lead_assignment_history(lead_id, previous_assignee, new_assignee, changed_by)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, actor);
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO public.whatsapp_notifications(user_id, title, body, created_by)
      VALUES (NEW.assigned_to, 'Lead direcionado a você',
        'O lead "' || COALESCE(NEW.name, 'Sem nome') || '" foi direcionado para você no funil ' ||
        COALESCE(NEW.funnel, 'Comercial') || ', etapa ' || COALESCE(NEW.status, 'Lead Novo') || '.', actor);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_assignment_change_log ON public.leads;
CREATE TRIGGER lead_assignment_change_log
AFTER INSERT OR UPDATE OF assigned_to ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_assignment_change();

CREATE OR REPLACE FUNCTION public.touch_lead_from_whatsapp_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.leads l
  SET last_interaction_at = COALESCE(NEW.timestamp, NEW.created_at, now())
  FROM public.whatsapp_chats c
  WHERE c.id = NEW.chat_id AND c.lead_id = l.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_message_touch_lead ON public.whatsapp_messages;
CREATE TRIGGER whatsapp_message_touch_lead
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_lead_from_whatsapp_message();

UPDATE public.leads l SET last_interaction_at = x.last_at
FROM (
  SELECT c.lead_id, max(COALESCE(m.timestamp, m.created_at)) AS last_at
  FROM public.whatsapp_chats c JOIN public.whatsapp_messages m ON m.chat_id = c.id
  WHERE c.lead_id IS NOT NULL GROUP BY c.lead_id
) x WHERE l.id = x.lead_id AND l.last_interaction_at IS NULL;

GRANT SELECT ON public.lead_assignment_history TO authenticated;
