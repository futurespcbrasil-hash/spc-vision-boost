-- WhatsApp: link chats to CRM leads, allow safe status changes, and store personal agent colors.
ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_lead_id
  ON public.whatsapp_chats(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Atendimento',
  color text NOT NULL DEFAULT '#8B5CF6',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_agent_preferences_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

ALTER TABLE public.whatsapp_agent_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view WhatsApp agent colors" ON public.whatsapp_agent_preferences;
CREATE POLICY "Authenticated users view WhatsApp agent colors"
  ON public.whatsapp_agent_preferences FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users insert own WhatsApp agent preferences" ON public.whatsapp_agent_preferences;
CREATE POLICY "Users insert own WhatsApp agent preferences"
  ON public.whatsapp_agent_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own WhatsApp agent preferences" ON public.whatsapp_agent_preferences;
CREATE POLICY "Users update own WhatsApp agent preferences"
  ON public.whatsapp_agent_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_agent_preferences TO authenticated;

-- Seed preferences for existing profiles; no private profile fields are exposed.
INSERT INTO public.whatsapp_agent_preferences (user_id, display_name, color)
SELECT p.user_id, COALESCE(NULLIF(trim(p.display_name), ''), 'Atendimento'), CASE (ascii(substr(md5(p.user_id::text), 1, 1)) % 8)
  WHEN 0 THEN '#8B5CF6'
  WHEN 1 THEN '#10B981'
  WHEN 2 THEN '#3B82F6'
  WHEN 3 THEN '#F59E0B'
  WHEN 4 THEN '#EF4444'
  WHEN 5 THEN '#EC4899'
  WHEN 6 THEN '#6366F1'
  ELSE '#14B8A6'
END
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET display_name = EXCLUDED.display_name;

CREATE OR REPLACE FUNCTION public.sync_whatsapp_agent_preference_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.whatsapp_agent_preferences (user_id, display_name, color)
  VALUES (NEW.user_id, COALESCE(NULLIF(trim(NEW.display_name), ''), 'Atendimento'), CASE (ascii(substr(md5(NEW.user_id::text), 1, 1)) % 8)
  WHEN 0 THEN '#8B5CF6'
  WHEN 1 THEN '#10B981'
  WHEN 2 THEN '#3B82F6'
  WHEN 3 THEN '#F59E0B'
  WHEN 4 THEN '#EF4444'
  WHEN 5 THEN '#EC4899'
  WHEN 6 THEN '#6366F1'
  ELSE '#14B8A6'
END)
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_whatsapp_agent_preference_name ON public.profiles;
CREATE TRIGGER sync_whatsapp_agent_preference_name
AFTER INSERT OR UPDATE OF display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_whatsapp_agent_preference_name();

-- Safely connect only unambiguous exact phone matches, avoiding accidental lead merges.
WITH candidates AS (
  SELECT c.id AS chat_id, min(l.id::text)::uuid AS lead_id
  FROM public.whatsapp_chats c
  JOIN public.leads l
    ON (
      regexp_replace(COALESCE(l.whatsapp, ''), '\D', '', 'g') = regexp_replace(COALESCE(c.contact_number, ''), '\D', '', 'g')
      OR regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') = regexp_replace(COALESCE(c.contact_number, ''), '\D', '', 'g')
    )
  WHERE c.lead_id IS NULL
    AND length(regexp_replace(COALESCE(c.contact_number, ''), '\D', '', 'g')) >= 10
  GROUP BY c.id
  HAVING count(DISTINCT l.id) = 1
)
UPDATE public.whatsapp_chats c
SET lead_id = candidates.lead_id
FROM candidates
WHERE c.id = candidates.chat_id;
UPDATE public.whatsapp_chats c
SET funnel_stage = l.status
FROM public.leads l
WHERE l.id = c.lead_id
  AND (c.funnel_stage IS NULL OR c.funnel_stage = '');

CREATE OR REPLACE FUNCTION public.set_whatsapp_chat_kanban_status(
  p_chat_id uuid,
  p_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chat public.whatsapp_chats%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_user uuid := auth.uid();
  v_stage text := trim(COALESCE(p_stage, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar autenticado.';
  END IF;
  IF v_stage = '' OR length(v_stage) > 100 THEN
    RAISE EXCEPTION 'Selecione uma coluna válida do Kanban.';
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
    RAISE EXCEPTION 'Conversa não encontrada ou sem permissão para alterar o status.';
  END IF;

  IF v_chat.lead_id IS NULL THEN
    RAISE EXCEPTION 'Este contato ainda não está vinculado a um lead. Use “Lead no Funil” primeiro.';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = v_chat.lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O lead vinculado não foi encontrado. Cadastre ou vincule novamente o contato.';
  END IF;

  IF NOT (
    v_stage = ANY (ARRAY[
      'lead_novo','contato_realizado','comparacao_enviada','em_negociacao',
      'fechamento','venda_ganha','venda_perdida','nao_utiliza_consulta','retornar_contato'
    ]::text[])
    OR EXISTS (
      SELECT 1 FROM public.kanban_stages ks
      WHERE ks.key = v_stage AND ks.funnel = COALESCE(v_lead.funnel, 'spc')
    )
  ) THEN
    RAISE EXCEPTION 'A coluna selecionada não pertence ao funil deste lead.';
  END IF;

  UPDATE public.leads
  SET status = v_stage, updated_at = now()
  WHERE id = v_lead.id;

  UPDATE public.whatsapp_chats
  SET funnel_stage = v_stage, updated_at = now()
  WHERE id = v_chat.id;

  RETURN jsonb_build_object(
    'chat_id', v_chat.id,
    'lead_id', v_lead.id,
    'status', v_stage,
    'funnel', COALESCE(v_lead.funnel, 'spc')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_whatsapp_chat_kanban_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_whatsapp_chat_kanban_status(uuid, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_agent_preferences') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_agent_preferences;
  END IF;
END $$;
