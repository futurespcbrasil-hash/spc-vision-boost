-- WhatsApp ownership transfer: immutable history and private notifications for the previous assignee.
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  previous_assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  new_assignee uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_assignment_history_chat_time
  ON public.whatsapp_chat_assignment_history(chat_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_assignment_history_previous_assignee
  ON public.whatsapp_chat_assignment_history(previous_assignee, changed_at DESC);

ALTER TABLE public.whatsapp_chat_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users read WhatsApp assignment history" ON public.whatsapp_chat_assignment_history;
CREATE POLICY "Authorized users read WhatsApp assignment history"
  ON public.whatsapp_chat_assignment_history
  FOR SELECT TO authenticated
  USING (
    changed_by = auth.uid()
    OR previous_assignee = auth.uid()
    OR new_assignee = auth.uid()
    OR public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.whatsapp_chats c
      JOIN public.whatsapp_instances i ON i.id = c.instance_id
      WHERE c.id = whatsapp_chat_assignment_history.chat_id
        AND i.owner_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  chat_id uuid REFERENCES public.whatsapp_chats(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_user_unread
  ON public.whatsapp_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own WhatsApp notifications" ON public.whatsapp_notifications;
CREATE POLICY "Users read own WhatsApp notifications"
  ON public.whatsapp_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own WhatsApp notifications read" ON public.whatsapp_notifications;
CREATE POLICY "Users mark own WhatsApp notifications read"
  ON public.whatsapp_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.whatsapp_chat_assignment_history TO authenticated;
GRANT SELECT, UPDATE ON public.whatsapp_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.take_over_whatsapp_chat(p_chat_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chat public.whatsapp_chats%ROWTYPE;
  v_user uuid := auth.uid();
  v_previous uuid;
  v_agent_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.';
  END IF;

  SELECT c.*
    INTO v_chat
  FROM public.whatsapp_chats c
  JOIN public.whatsapp_instances i ON i.id = c.instance_id
  WHERE c.id = p_chat_id
    AND (
      public.has_role(v_user, 'gestor'::public.app_role)
      OR c.assigned_to = v_user
      OR i.owner_id = v_user
    )
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversa não encontrada ou sem permissão para assumir este atendimento.';
  END IF;

  v_previous := v_chat.assigned_to;
  IF v_previous = v_user THEN
    RETURN jsonb_build_object('chat_id', v_chat.id, 'previous_assignee', v_previous, 'new_assignee', v_user, 'changed', false);
  END IF;

  SELECT COALESCE(NULLIF(trim(p.display_name), ''), split_part(COALESCE(p.email, ''), '@', 1), 'Atendimento')
    INTO v_agent_name
  FROM public.profiles p
  WHERE p.user_id = v_user
  LIMIT 1;
  v_agent_name := COALESCE(NULLIF(v_agent_name, ''), 'Atendimento');

  UPDATE public.whatsapp_chats
  SET assigned_to = v_user, updated_at = now()
  WHERE id = v_chat.id;

  INSERT INTO public.whatsapp_chat_assignment_history (chat_id, previous_assignee, new_assignee, changed_by)
  VALUES (v_chat.id, v_previous, v_user, v_user);

  IF v_previous IS NOT NULL AND v_previous <> v_user THEN
    INSERT INTO public.whatsapp_notifications (user_id, title, body, chat_id, created_by)
    VALUES (
      v_previous,
      'Atendimento transferido',
      COALESCE(NULLIF(trim(v_chat.contact_name), ''), v_chat.contact_number, 'Uma conversa')
        || ' foi assumida por ' || v_agent_name || '.',
      v_chat.id,
      v_user
    );
  END IF;

  RETURN jsonb_build_object(
    'chat_id', v_chat.id,
    'previous_assignee', v_previous,
    'new_assignee', v_user,
    'changed', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.take_over_whatsapp_chat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_over_whatsapp_chat(uuid) TO authenticated;

-- Keep notification inserts restricted to the security-definer transfer function.
