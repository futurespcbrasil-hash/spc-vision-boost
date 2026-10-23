-- SPC lead metadata: plan value and competing bureau
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS plan_value numeric(12,2), ADD COLUMN IF NOT EXISTS biro text;
