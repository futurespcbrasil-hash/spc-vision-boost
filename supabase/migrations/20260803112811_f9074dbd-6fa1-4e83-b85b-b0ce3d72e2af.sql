DELETE FROM public.whatsapp_messages WHERE chat_id IN (SELECT id FROM public.whatsapp_chats WHERE last_message_at IS NULL);
DELETE FROM public.whatsapp_chats WHERE last_message_at IS NULL;