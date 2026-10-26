-- This helper is invoked by a PostgreSQL trigger, not directly through the Data API.
-- Restrict RPC execution while preserving the existing trigger.
REVOKE ALL ON FUNCTION public.link_whatsapp_chat_to_existing_lead() FROM PUBLIC, anon, authenticated;
