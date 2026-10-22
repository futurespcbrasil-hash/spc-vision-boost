-- Allow the designated Future Soluções owner to manage shared Kanban stages
-- without changing the account's day-to-day seller role.
CREATE POLICY "Future owner manages all kanban stages"
ON public.kanban_stages
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid)
WITH CHECK ((SELECT auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid);
