-- Tighten function ACLs explicitly for Supabase API roles and optimize new RLS predicates.
REVOKE ALL ON FUNCTION public.set_whatsapp_chat_kanban_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_whatsapp_chat_kanban_status(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.take_over_whatsapp_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_over_whatsapp_chat(uuid) TO authenticated;

-- Trigger-only helper: callers must not be able to invoke it through PostgREST RPC.
REVOKE ALL ON FUNCTION public.sync_whatsapp_agent_preference_name() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users view all leads" ON public.leads;
CREATE POLICY "Authenticated users view all leads"
  ON public.leads FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view all kanban stages" ON public.kanban_stages;
CREATE POLICY "Authenticated users view all kanban stages"
  ON public.kanban_stages FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view all sectors" ON public.sectors;
CREATE POLICY "Authenticated users view all sectors"
  ON public.sectors FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view WhatsApp agent colors" ON public.whatsapp_agent_preferences;
CREATE POLICY "Authenticated users view WhatsApp agent colors"
  ON public.whatsapp_agent_preferences FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users insert own WhatsApp agent preferences" ON public.whatsapp_agent_preferences;
CREATE POLICY "Users insert own WhatsApp agent preferences"
  ON public.whatsapp_agent_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own WhatsApp agent preferences" ON public.whatsapp_agent_preferences;
CREATE POLICY "Users update own WhatsApp agent preferences"
  ON public.whatsapp_agent_preferences FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users read own WhatsApp notifications" ON public.whatsapp_notifications;
CREATE POLICY "Users read own WhatsApp notifications"
  ON public.whatsapp_notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users mark own WhatsApp notifications read" ON public.whatsapp_notifications;
CREATE POLICY "Users mark own WhatsApp notifications read"
  ON public.whatsapp_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authorized users read WhatsApp assignment history" ON public.whatsapp_chat_assignment_history;
CREATE POLICY "Authorized users read WhatsApp assignment history"
  ON public.whatsapp_chat_assignment_history
  FOR SELECT TO authenticated
  USING (
    changed_by = (SELECT auth.uid())
    OR previous_assignee = (SELECT auth.uid())
    OR new_assignee = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.whatsapp_chats c
      JOIN public.whatsapp_instances i ON i.id = c.instance_id
      WHERE c.id = whatsapp_chat_assignment_history.chat_id
        AND i.owner_id = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_whatsapp_assignment_history_changed_by
  ON public.whatsapp_chat_assignment_history(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_assignment_history_new_assignee
  ON public.whatsapp_chat_assignment_history(new_assignee, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_chat_id
  ON public.whatsapp_notifications(chat_id)
  WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_created_by
  ON public.whatsapp_notifications(created_by, created_at DESC)
  WHERE created_by IS NOT NULL;
