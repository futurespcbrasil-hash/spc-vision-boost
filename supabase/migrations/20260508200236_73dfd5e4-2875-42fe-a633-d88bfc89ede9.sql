DROP POLICY IF EXISTS "Users see own leads" ON public.leads;
DROP POLICY IF EXISTS "Users insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Users update own leads" ON public.leads;
DROP POLICY IF EXISTS "Users delete own leads" ON public.leads;

CREATE POLICY "Users view own leads and managers view team leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users create own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own leads"
ON public.leads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own schedule events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users insert own events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users update own events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users delete own events" ON public.schedule_events;

CREATE POLICY "Users view own schedule and managers view team schedule"
ON public.schedule_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users create own schedule events"
ON public.schedule_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own schedule events"
ON public.schedule_events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own schedule events"
ON public.schedule_events
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own stages" ON public.kanban_stages;
DROP POLICY IF EXISTS "Users insert own stages" ON public.kanban_stages;
DROP POLICY IF EXISTS "Users update own stages" ON public.kanban_stages;
DROP POLICY IF EXISTS "Users delete own stages" ON public.kanban_stages;

CREATE POLICY "Users view own stages and managers view team stages"
ON public.kanban_stages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users create own stages"
ON public.kanban_stages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stages"
ON public.kanban_stages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own stages"
ON public.kanban_stages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own sectors" ON public.sectors;
DROP POLICY IF EXISTS "Users insert own sectors" ON public.sectors;
DROP POLICY IF EXISTS "Users update own sectors" ON public.sectors;
DROP POLICY IF EXISTS "Users delete own sectors" ON public.sectors;

CREATE POLICY "Users view own sectors and managers view team sectors"
ON public.sectors
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users create own sectors"
ON public.sectors
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sectors"
ON public.sectors
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own sectors"
ON public.sectors
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;

CREATE POLICY "Users view own events and managers view team events"
ON public.events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users create own events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own events"
ON public.events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own events"
ON public.events
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);