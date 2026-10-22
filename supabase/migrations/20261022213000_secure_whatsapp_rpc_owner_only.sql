-- SECURITY DEFINER RPCs must not bypass per-owner WhatsApp privacy.
CREATE OR REPLACE FUNCTION public.set_whatsapp_chat_kanban_status(p_chat_id uuid, p_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chat public.whatsapp_chats%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_user uuid := auth.uid();
  v_stage text := trim(COALESCE(p_stage, ''));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Você precisa estar autenticado.'; END IF;
  IF v_stage = '' OR length(v_stage) > 100 THEN RAISE EXCEPTION 'Selecione uma coluna válida do Kanban.'; END IF;
  SELECT c.* INTO v_chat FROM public.whatsapp_chats c JOIN public.whatsapp_instances i ON i.id = c.instance_id
  WHERE c.id = p_chat_id AND i.owner_id = v_user FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada ou sem permissão para alterar o status.'; END IF;
  IF v_chat.lead_id IS NULL THEN RAISE EXCEPTION 'Este contato ainda não está vinculado a um lead. Use “Lead no Funil” primeiro.'; END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = v_chat.lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O lead vinculado não foi encontrado. Cadastre ou vincule novamente o contato.'; END IF;
  IF NOT (v_stage = ANY (ARRAY['lead_novo','contato_realizado','comparacao_enviada','em_negociacao','fechamento','venda_ganha','venda_perdida','nao_utiliza_consulta','retornar_contato']::text[])
    OR EXISTS (SELECT 1 FROM public.kanban_stages ks WHERE ks.key = v_stage AND ks.funnel = COALESCE(v_lead.funnel, 'spc'))) THEN
    RAISE EXCEPTION 'A coluna selecionada não pertence ao funil deste lead.';
  END IF;
  UPDATE public.leads SET status = v_stage, updated_at = now() WHERE id = v_lead.id;
  UPDATE public.whatsapp_chats SET funnel_stage = v_stage, updated_at = now() WHERE id = v_chat.id;
  RETURN jsonb_build_object('chat_id', v_chat.id, 'lead_id', v_lead.id, 'status', v_stage, 'funnel', COALESCE(v_lead.funnel, 'spc'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.take_over_whatsapp_chat(p_chat_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chat public.whatsapp_chats%ROWTYPE;
  v_user uuid := auth.uid();
  v_previous uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Você precisa estar autenticado.'; END IF;
  SELECT c.* INTO v_chat FROM public.whatsapp_chats c JOIN public.whatsapp_instances i ON i.id = c.instance_id
  WHERE c.id = p_chat_id AND i.owner_id = v_user FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada ou sem permissão para assumir este atendimento.'; END IF;
  v_previous := v_chat.assigned_to;
  IF v_previous = v_user THEN RETURN jsonb_build_object('chat_id', v_chat.id, 'previous_assignee', v_previous, 'new_assignee', v_user, 'changed', false); END IF;
  -- Preserve private ownership; do not notify another user with this chat identity or ID.
  UPDATE public.whatsapp_chats SET assigned_to = v_user, updated_at = now() WHERE id = v_chat.id;
  INSERT INTO public.whatsapp_chat_assignment_history (chat_id, previous_assignee, new_assignee, changed_by) VALUES (v_chat.id, v_previous, v_user, v_user);
  RETURN jsonb_build_object('chat_id', v_chat.id, 'previous_assignee', v_previous, 'new_assignee', v_user, 'changed', true);
END;
$function$;
