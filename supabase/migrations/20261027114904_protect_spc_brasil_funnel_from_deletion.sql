CREATE POLICY "Protect SPC Brasil funnel from deletion"
ON public.sectors
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (key <> 'spc' AND lower(trim(label)) <> 'spc brasil');
