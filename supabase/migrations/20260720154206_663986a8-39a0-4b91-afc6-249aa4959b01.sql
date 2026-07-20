
-- contacts: só autenticados com sessão
DROP POLICY IF EXISTS "Autenticados gerenciam contatos" ON public.whatsapp_contacts;
CREATE POLICY "Autenticados gerenciam contatos" ON public.whatsapp_contacts
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- chats insert
DROP POLICY IF EXISTS "Autenticado cria chats" ON public.whatsapp_chats;
CREATE POLICY "Autenticado cria chats" ON public.whatsapp_chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- messages insert
DROP POLICY IF EXISTS "Autenticado insere mensagens" ON public.whatsapp_messages;
CREATE POLICY "Autenticado insere mensagens" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- chat_labels
DROP POLICY IF EXISTS "Autenticados gerenciam chat_labels" ON public.whatsapp_chat_labels;
CREATE POLICY "Autenticados gerenciam chat_labels" ON public.whatsapp_chat_labels
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
