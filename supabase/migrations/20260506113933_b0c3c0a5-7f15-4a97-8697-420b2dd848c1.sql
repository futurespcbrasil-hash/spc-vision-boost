DROP POLICY IF EXISTS "Vendedores see own leads" ON public.leads;
CREATE POLICY "Users see own leads" ON public.leads FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendedores see own events" ON public.schedule_events;
CREATE POLICY "Users see own schedule events" ON public.schedule_events FOR SELECT TO authenticated USING (auth.uid() = user_id);