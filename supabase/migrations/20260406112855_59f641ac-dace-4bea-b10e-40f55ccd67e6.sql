
-- Drop existing UPDATE/DELETE policies on leads
DROP POLICY IF EXISTS "Users update own or unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users delete own or unassigned leads" ON public.leads;

-- Recreate UPDATE policy: only own or unassigned, NO gestor override
CREATE POLICY "Users update own or unassigned leads"
ON public.leads FOR UPDATE TO authenticated
USING ((user_id IS NULL) OR (auth.uid() = user_id));

-- Recreate DELETE policy: only own or unassigned, NO gestor override
CREATE POLICY "Users delete own or unassigned leads"
ON public.leads FOR DELETE TO authenticated
USING ((user_id IS NULL) OR (auth.uid() = user_id));

-- Drop existing UPDATE/DELETE policies on schedule_events
DROP POLICY IF EXISTS "Users update own or unassigned events" ON public.schedule_events;
DROP POLICY IF EXISTS "Users delete own or unassigned events" ON public.schedule_events;

-- Recreate UPDATE policy for events: only own or unassigned
CREATE POLICY "Users update own or unassigned events"
ON public.schedule_events FOR UPDATE TO authenticated
USING ((user_id IS NULL) OR (auth.uid() = user_id));

-- Recreate DELETE policy for events: only own or unassigned
CREATE POLICY "Users delete own or unassigned events"
ON public.schedule_events FOR DELETE TO authenticated
USING ((user_id IS NULL) OR (auth.uid() = user_id));
