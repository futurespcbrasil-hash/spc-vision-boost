CREATE POLICY "Users delete own WhatsApp notifications"
ON public.whatsapp_notifications
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));
