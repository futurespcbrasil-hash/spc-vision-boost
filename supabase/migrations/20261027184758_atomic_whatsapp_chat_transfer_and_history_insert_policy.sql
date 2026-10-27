-- Keep the assignment history writable only by the owner of the WhatsApp instance.
CREATE POLICY "WhatsApp assignment history instance owner insert"
ON public.whatsapp_chat_assignment_history
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_chats c
    JOIN public.whatsapp_instances i ON i.id = c.instance_id
    WHERE c.id = whatsapp_chat_assignment_history.chat_id
      AND i.owner_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = whatsapp_chat_assignment_history.new_assignee
  )
);

CREATE OR REPLACE FUNCTION public.transfer_whatsapp_chat(p_chat_id uuid, p_assignee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_chat public.whatsapp_chats%ROWTYPE;
  v_previous uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Você precisa estar autenticado.'; END IF;
  IF p_assignee IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_assignee) THEN
    RAISE EXCEPTION 'Usuário de destino inválido.';
  END IF;
  SELECT c.* INTO v_chat FROM public.whatsapp_chats c
  JOIN public.whatsapp_instances i ON i.id = c.instance_id
  WHERE c.id = p_chat_id AND i.owner_id = v_user FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada ou sem permissão para transferir este atendimento.'; END IF;
  v_previous := v_chat.assigned_to;
  IF v_previous = p_assignee THEN
    RETURN jsonb_build_object('chat_id', v_chat.id, 'previous_assignee', v_previous, 'new_assignee', p_assignee, 'changed', false);
  END IF;
  UPDATE public.whatsapp_chats SET assigned_to = p_assignee, updated_at = now() WHERE id = v_chat.id;
  IF v_chat.lead_id IS NOT NULL THEN
    UPDATE public.leads SET assigned_to = p_assignee WHERE id = v_chat.lead_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'O lead vinculado não foi encontrado; transferência cancelada.'; END IF;
  END IF;
  INSERT INTO public.whatsapp_chat_assignment_history (chat_id, previous_assignee, new_assignee, changed_by)
  VALUES (v_chat.id, v_previous, p_assignee, v_user);
  RETURN jsonb_build_object('chat_id', v_chat.id, 'previous_assignee', v_previous, 'new_assignee', p_assignee, 'changed', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.transfer_whatsapp_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_whatsapp_chat(uuid, uuid) TO authenticated;
