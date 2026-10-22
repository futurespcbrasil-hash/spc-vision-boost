-- Shared read access for cross-profile collaboration in Leads, Kanban stages, and sectors.
-- Mutations remain controlled by the existing owner/manager policies.
DROP POLICY IF EXISTS "Users view own leads and managers view team leads" ON public.leads;
CREATE POLICY "Authenticated users view all leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users view own stages and managers view team stages" ON public.kanban_stages;
CREATE POLICY "Authenticated users view all kanban stages"
  ON public.kanban_stages
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users view own sectors and managers view team sectors" ON public.sectors;
CREATE POLICY "Authenticated users view all sectors"
  ON public.sectors
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Managers retain their existing team-management capability in the UI and database.
DROP POLICY IF EXISTS "Managers manage all kanban stages" ON public.kanban_stages;
CREATE POLICY "Managers manage all kanban stages"
  ON public.kanban_stages
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'gestor'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'gestor'::public.app_role));

-- Publish shared CRM data so open tabs receive changes without a manual reload.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kanban_stages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_stages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sectors') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sectors;
  END IF;
END $$;
