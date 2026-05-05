CREATE TABLE public.kanban_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.kanban_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stages" ON public.kanban_stages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own stages" ON public.kanban_stages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own stages" ON public.kanban_stages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own stages" ON public.kanban_stages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_kanban_stages_updated_at
  BEFORE UPDATE ON public.kanban_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();