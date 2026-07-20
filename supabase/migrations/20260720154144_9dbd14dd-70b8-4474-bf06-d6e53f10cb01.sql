
-- ============ WHATSAPP INSTANCES ============
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ryze_instance_id TEXT,
  token_instance TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone TEXT,
  qr_code TEXT,
  last_status_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores veem todas as instancias" ON public.whatsapp_instances
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Usuarios veem suas instancias" ON public.whatsapp_instances
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Usuarios gerenciam suas instancias" ON public.whatsapp_instances
  FOR ALL TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WHATSAPP CONTACTS ============
CREATE TABLE public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  wa_number TEXT NOT NULL,
  name TEXT,
  push_name TEXT,
  avatar_url TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, wa_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem contatos" ON public.whatsapp_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam contatos" ON public.whatsapp_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WHATSAPP CHATS ============
CREATE TABLE public.whatsapp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  wa_chat_id TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  contact_name TEXT,
  avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  funnel_stage TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, wa_chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chats TO authenticated;
GRANT ALL ON public.whatsapp_chats TO service_role;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor ve todos os chats" ON public.whatsapp_chats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Atendente ve chats atribuidos ou livres" ON public.whatsapp_chats
  FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Gestor gerencia todos os chats" ON public.whatsapp_chats
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Atendente atualiza seus chats" ON public.whatsapp_chats
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid() OR assigned_to IS NULL)
  WITH CHECK (assigned_to = auth.uid() OR assigned_to IS NULL);
CREATE POLICY "Autenticado cria chats" ON public.whatsapp_chats
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_whatsapp_chats_instance ON public.whatsapp_chats(instance_id);
CREATE INDEX idx_whatsapp_chats_assigned ON public.whatsapp_chats(assigned_to);
CREATE INDEX idx_whatsapp_chats_last_msg ON public.whatsapp_chats(last_message_at DESC);

CREATE TRIGGER update_whatsapp_chats_updated_at BEFORE UPDATE ON public.whatsapp_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ WHATSAPP MESSAGES ============
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  sender TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  media_url TEXT,
  media_mime TEXT,
  media_filename TEXT,
  status TEXT DEFAULT 'sent',
  error TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, wa_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor ve todas as mensagens" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Atendente ve mensagens dos seus chats" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.whatsapp_chats c
            WHERE c.id = chat_id AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL))
  );
CREATE POLICY "Autenticado insere mensagens" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Gestor atualiza mensagens" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_whatsapp_messages_chat ON public.whatsapp_messages(chat_id, timestamp DESC);

-- ============ LABELS ============
CREATE TABLE public.whatsapp_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_labels TO authenticated;
GRANT ALL ON public.whatsapp_labels TO service_role;
ALTER TABLE public.whatsapp_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam suas etiquetas" ON public.whatsapp_labels
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

CREATE TABLE public.whatsapp_chat_labels (
  chat_id UUID NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.whatsapp_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chat_labels TO authenticated;
GRANT ALL ON public.whatsapp_chat_labels TO service_role;
ALTER TABLE public.whatsapp_chat_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam chat_labels" ON public.whatsapp_chat_labels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ QUICK REPLIES ============
CREATE TABLE public.whatsapp_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_quick_replies TO authenticated;
GRANT ALL ON public.whatsapp_quick_replies TO service_role;
ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gerenciam suas quick replies" ON public.whatsapp_quick_replies
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_whatsapp_quick_replies_updated_at BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
