-- Create sectors table for sector/funnel customization
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sectors" ON public.sectors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sectors" ON public.sectors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sectors" ON public.sectors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sectors" ON public.sectors FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_sectors_updated_at
BEFORE UPDATE ON public.sectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();