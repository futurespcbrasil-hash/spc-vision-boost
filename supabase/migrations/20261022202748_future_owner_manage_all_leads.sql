CREATE POLICY "Future owner manages all leads"
ON public.leads
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid)
WITH CHECK ((SELECT auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid);
