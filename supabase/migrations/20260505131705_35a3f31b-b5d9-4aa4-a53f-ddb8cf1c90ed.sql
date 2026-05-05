ALTER TABLE public.kanban_stages ADD COLUMN funnel TEXT NOT NULL DEFAULT 'spc';
ALTER TABLE public.leads ADD COLUMN funnel TEXT NOT NULL DEFAULT 'spc';
ALTER TABLE public.kanban_stages DROP CONSTRAINT IF EXISTS kanban_stages_user_id_key_key;
ALTER TABLE public.kanban_stages ADD CONSTRAINT kanban_stages_user_funnel_key_unique UNIQUE (user_id, funnel, key);
CREATE INDEX IF NOT EXISTS idx_leads_funnel ON public.leads(funnel);
CREATE INDEX IF NOT EXISTS idx_kanban_stages_funnel ON public.kanban_stages(funnel);