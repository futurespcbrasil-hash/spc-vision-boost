
-- Update leads SELECT policy to include null user_id
DROP POLICY IF EXISTS "Vendedores see own leads" ON public.leads;
CREATE POLICY "Users see own or unassigned leads"
  ON public.leads FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

-- Update leads INSERT to allow setting user_id
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Update leads UPDATE
DROP POLICY IF EXISTS "Vendedores update own leads" ON public.leads;
CREATE POLICY "Users update own or unassigned leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

-- Update leads DELETE
DROP POLICY IF EXISTS "Vendedores delete own leads" ON public.leads;
CREATE POLICY "Users delete own or unassigned leads"
  ON public.leads FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

-- Update schedule_events SELECT
DROP POLICY IF EXISTS "Users see own or gestor sees all schedule_events" ON public.schedule_events;
CREATE POLICY "Users see own or unassigned events"
  ON public.schedule_events FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

-- Update schedule_events INSERT
DROP POLICY IF EXISTS "Users insert own schedule_events" ON public.schedule_events;
CREATE POLICY "Users insert own events"
  ON public.schedule_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Update schedule_events UPDATE
DROP POLICY IF EXISTS "Users update own schedule_events" ON public.schedule_events;
CREATE POLICY "Users update own or unassigned events"
  ON public.schedule_events FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

-- Update schedule_events DELETE
DROP POLICY IF EXISTS "Users delete own schedule_events" ON public.schedule_events;
CREATE POLICY "Users delete own or unassigned events"
  ON public.schedule_events FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));
