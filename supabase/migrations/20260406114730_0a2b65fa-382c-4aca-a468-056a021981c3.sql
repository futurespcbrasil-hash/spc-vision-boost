
-- Drop existing leads policies
DROP POLICY IF EXISTS "Users see own or unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users update own or unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users delete own or unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;

-- Recreate leads policies without NULL fallback
CREATE POLICY "Vendedores see own leads"
ON public.leads FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users insert own leads"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own leads"
ON public.leads FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own leads"
ON public.leads FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Drop existing schedule_events policies
DROP POLICY IF EXISTS "Users see own or unassigned events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users update own or unassigned events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users delete own or unassigned events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users insert own events" ON public.schedule_events;

-- Recreate schedule_events policies
CREATE POLICY "Vendedores see own events"
ON public.schedule_events FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users insert own events"
ON public.schedule_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own events"
ON public.schedule_events FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own events"
ON public.schedule_events FOR DELETE TO authenticated
USING (auth.uid() = user_id);
