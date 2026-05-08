DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own leads and managers view team leads" ON public.leads;
CREATE POLICY "Users view own leads and managers view team leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  )
);

DROP POLICY IF EXISTS "Users view own schedule and managers view team schedule" ON public.schedule_events;
CREATE POLICY "Users view own schedule and managers view team schedule"
ON public.schedule_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  )
);

DROP POLICY IF EXISTS "Users view own stages and managers view team stages" ON public.kanban_stages;
CREATE POLICY "Users view own stages and managers view team stages"
ON public.kanban_stages
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  )
);

DROP POLICY IF EXISTS "Users view own sectors and managers view team sectors" ON public.sectors;
CREATE POLICY "Users view own sectors and managers view team sectors"
ON public.sectors
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  )
);

DROP POLICY IF EXISTS "Users view own events and managers view team events" ON public.events;
CREATE POLICY "Users view own events and managers view team events"
ON public.events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
  )
);

DROP POLICY IF EXISTS "Allow all access to imported_tables" ON public.imported_tables;
DROP POLICY IF EXISTS "Authenticated users can manage imported tables" ON public.imported_tables;
CREATE POLICY "Authenticated users can manage imported tables"
ON public.imported_tables
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;