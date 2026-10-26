-- Add indexes for foreign keys reported by the database performance advisor.
CREATE INDEX IF NOT EXISTS idx_atendimento_comissao_config_updated_by
  ON public.atendimento_comissao_config (updated_by);
CREATE INDEX IF NOT EXISTS idx_future_remote_device_access_device_id
  ON public.future_remote_device_access (device_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_changed_by
  ON public.lead_assignment_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_lead_id
  ON public.lead_assignment_history (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_new_assignee
  ON public.lead_assignment_history (new_assignee);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_previous_assignee
  ON public.lead_assignment_history (previous_assignee);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON public.leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flow_sessions_assigned_to
  ON public.whatsapp_flow_sessions (assigned_to);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flow_sessions_chat_id
  ON public.whatsapp_flow_sessions (chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flow_sessions_flow_id
  ON public.whatsapp_flow_sessions (flow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_created_by
  ON public.whatsapp_flows (created_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_lead_id
  ON public.whatsapp_notifications (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_service_sessions_created_by
  ON public.whatsapp_service_sessions (created_by);

-- Preserve existing access rules while allowing PostgreSQL to evaluate auth.uid()
-- once per statement rather than repeatedly for each row.
DROP POLICY IF EXISTS "future_remote_authenticated_users" ON public.future_remote_devices;
CREATE POLICY "future_remote_authenticated_users"
  ON public.future_remote_devices
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can view their own email suppressions" ON public.email_marketing_suppressions;
CREATE POLICY "Users can view their own email suppressions"
  ON public.email_marketing_suppressions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can add their own email suppressions" ON public.email_marketing_suppressions;
CREATE POLICY "Users can add their own email suppressions"
  ON public.email_marketing_suppressions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
