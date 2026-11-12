CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.whatsapp_chat_merge_audit (
  source_chat_id uuid PRIMARY KEY,
  target_chat_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  source_chat_snapshot jsonb NOT NULL,
  target_chat_snapshot jsonb NOT NULL,
  source_messages_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_labels_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_assignment_history_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_notifications_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_flow_sessions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_service_sessions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  merged_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.whatsapp_chat_merge_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE private.whatsapp_chat_merge_audit TO service_role;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_instance_phone
  ON public.whatsapp_chats (instance_id, contact_number)
  WHERE coalesce(is_group, false) = false;
CREATE INDEX IF NOT EXISTS idx_leads_phone_lookup
  ON public.leads (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_lookup
  ON public.leads (whatsapp) WHERE whatsapp IS NOT NULL;

CREATE OR REPLACE FUNCTION public.increment_whatsapp_chat_unread_count(
  p_chat_id uuid,
  p_instance_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.whatsapp_chats
  SET unread_count = coalesce(unread_count, 0) + 1,
      updated_at = now()
  WHERE id = p_chat_id AND instance_id = p_instance_id
  RETURNING unread_count INTO new_count;
  RETURN new_count;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_whatsapp_chat_unread_count(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_whatsapp_chat_unread_count(uuid, uuid) TO service_role;

DO $$
DECLARE
  pair record;
  source_row public.whatsapp_chats%ROWTYPE;
  target_row public.whatsapp_chats%ROWTYPE;
  messages_snapshot jsonb;
  labels_snapshot jsonb;
  assignment_snapshot jsonb;
  notifications_snapshot jsonb;
  flow_snapshot jsonb;
  service_snapshot jsonb;
  merged_count integer := 0;
BEGIN
  FOR pair IN
    WITH normalized AS (
      SELECT
        id,
        instance_id,
        wa_chat_id,
        CASE
          WHEN left(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g'), 2) = '55'
            AND length(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g')) IN (12, 13)
          THEN substring(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g') FROM 3)
          ELSE regexp_replace(coalesce(contact_number, ''), '\D', '', 'g')
        END AS phone
      FROM public.whatsapp_chats
      WHERE coalesce(is_group, false) = false
    ),
    duplicate_pairs AS (
      SELECT
        instance_id,
        (array_agg(id) FILTER (WHERE wa_chat_id LIKE '%@lid'))[1] AS target_id,
        (array_agg(id) FILTER (WHERE wa_chat_id LIKE '%@c.us'))[1] AS source_id
      FROM normalized
      WHERE length(phone) BETWEEN 10 AND 11
      GROUP BY instance_id, phone
      HAVING count(*) = 2
         AND count(*) FILTER (WHERE wa_chat_id LIKE '%@lid') = 1
         AND count(*) FILTER (WHERE wa_chat_id LIKE '%@c.us') = 1
    )
    SELECT source_id, target_id FROM duplicate_pairs
  LOOP
    SELECT * INTO target_row
    FROM public.whatsapp_chats
    WHERE id = pair.target_id
    FOR UPDATE;

    SELECT * INTO source_row
    FROM public.whatsapp_chats
    WHERE id = pair.source_id
    FOR UPDATE;

    IF target_row.id IS NULL OR source_row.id IS NULL
       OR target_row.instance_id <> source_row.instance_id
       OR target_row.wa_chat_id NOT LIKE '%@lid'
       OR source_row.wa_chat_id NOT LIKE '%@c.us' THEN
      RAISE EXCEPTION 'Conversa duplicada mudou durante a consolidação; operação cancelada.';
    END IF;

    IF target_row.lead_id IS NOT NULL AND source_row.lead_id IS NOT NULL
       AND target_row.lead_id <> source_row.lead_id THEN
      RAISE EXCEPTION 'Conversas % e % apontam para leads diferentes; operação cancelada.',
        target_row.id, source_row.id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.whatsapp_flow_sessions WHERE chat_id = source_row.id)
       AND EXISTS (SELECT 1 FROM public.whatsapp_flow_sessions WHERE chat_id = target_row.id) THEN
      RAISE EXCEPTION 'Ambas as conversas % e % possuem sessões de fluxo; operação cancelada.',
        target_row.id, source_row.id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.whatsapp_service_sessions
               WHERE chat_id = source_row.id AND closed_at IS NULL)
       AND EXISTS (SELECT 1 FROM public.whatsapp_service_sessions
                   WHERE chat_id = target_row.id AND closed_at IS NULL) THEN
      RAISE EXCEPTION 'Ambas as conversas % e % possuem atendimento ativo; operação cancelada.',
        target_row.id, source_row.id;
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO messages_snapshot
    FROM public.whatsapp_messages x WHERE x.chat_id = source_row.id;
    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO labels_snapshot
    FROM public.whatsapp_chat_labels x WHERE x.chat_id = source_row.id;
    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO assignment_snapshot
    FROM public.whatsapp_chat_assignment_history x WHERE x.chat_id = source_row.id;
    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO notifications_snapshot
    FROM public.whatsapp_notifications x WHERE x.chat_id = source_row.id;
    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO flow_snapshot
    FROM public.whatsapp_flow_sessions x WHERE x.chat_id = source_row.id;
    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO service_snapshot
    FROM public.whatsapp_service_sessions x WHERE x.chat_id = source_row.id;

    INSERT INTO private.whatsapp_chat_merge_audit (
      source_chat_id, target_chat_id, instance_id,
      source_chat_snapshot, target_chat_snapshot,
      source_messages_snapshot, source_labels_snapshot,
      source_assignment_history_snapshot, source_notifications_snapshot,
      source_flow_sessions_snapshot, source_service_sessions_snapshot
    ) VALUES (
      source_row.id, target_row.id, target_row.instance_id,
      to_jsonb(source_row), to_jsonb(target_row),
      messages_snapshot, labels_snapshot, assignment_snapshot,
      notifications_snapshot, flow_snapshot, service_snapshot
    );

    UPDATE public.whatsapp_messages
    SET chat_id = target_row.id
    WHERE chat_id = source_row.id AND instance_id = target_row.instance_id;

    INSERT INTO public.whatsapp_chat_labels (chat_id, label_id, created_at)
    SELECT target_row.id, label_id, created_at
    FROM public.whatsapp_chat_labels
    WHERE chat_id = source_row.id
    ON CONFLICT (chat_id, label_id) DO NOTHING;
    DELETE FROM public.whatsapp_chat_labels WHERE chat_id = source_row.id;

    UPDATE public.whatsapp_chat_assignment_history
    SET chat_id = target_row.id
    WHERE chat_id = source_row.id;

    UPDATE public.whatsapp_notifications
    SET chat_id = target_row.id
    WHERE chat_id = source_row.id;

    UPDATE public.whatsapp_flow_sessions
    SET chat_id = target_row.id, wa_chat_id = target_row.wa_chat_id, updated_at = now()
    WHERE chat_id = source_row.id;

    UPDATE public.whatsapp_service_sessions
    SET chat_id = target_row.id, instance_id = target_row.instance_id, updated_at = now()
    WHERE chat_id = source_row.id;

    UPDATE public.whatsapp_chats
    SET
      contact_number = coalesce(nullif(target_row.contact_number, ''), nullif(source_row.contact_number, '')),
      contact_name = CASE
        WHEN nullif(btrim(source_row.contact_name), '') IS NOT NULL
          AND btrim(source_row.contact_name) !~ '^[+0-9[:space:]().-]+$'
          AND (nullif(btrim(target_row.contact_name), '') IS NULL
               OR btrim(target_row.contact_name) ~ '^[+0-9[:space:]().-]+$')
        THEN source_row.contact_name
        ELSE coalesce(nullif(btrim(target_row.contact_name), ''), nullif(btrim(source_row.contact_name), ''), 'Contato do WhatsApp')
      END,
      avatar_url = coalesce(target_row.avatar_url, source_row.avatar_url),
      last_message = CASE
        WHEN source_row.last_message_at IS NOT NULL
          AND (target_row.last_message_at IS NULL OR source_row.last_message_at > target_row.last_message_at)
        THEN source_row.last_message
        ELSE coalesce(target_row.last_message, source_row.last_message)
      END,
      last_message_at = greatest(target_row.last_message_at, source_row.last_message_at),
      unread_count = coalesce(target_row.unread_count, 0) + coalesce(source_row.unread_count, 0),
      assigned_to = coalesce(target_row.assigned_to, source_row.assigned_to),
      lead_id = coalesce(target_row.lead_id, source_row.lead_id),
      funnel_stage = coalesce(target_row.funnel_stage, source_row.funnel_stage),
      is_pinned = coalesce(target_row.is_pinned, false) OR coalesce(source_row.is_pinned, false),
      archived = coalesce(target_row.archived, false) AND coalesce(source_row.archived, false),
      created_at = least(target_row.created_at, source_row.created_at),
      updated_at = now()
    WHERE id = target_row.id;

    DELETE FROM public.whatsapp_chats WHERE id = source_row.id;
    merged_count := merged_count + 1;
  END LOOP;

  RAISE NOTICE 'Conversas LID/C.US consolidadas: %', merged_count;
END;
$$;