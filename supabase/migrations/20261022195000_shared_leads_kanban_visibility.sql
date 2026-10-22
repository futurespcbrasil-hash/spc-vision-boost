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
