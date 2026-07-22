-- =====================================================================
-- MIGRAÇÃO: Adicionar allowed_sectors em user_roles + color em sectors
-- Cole este script no SQL Editor do seu Supabase e clique em Run
-- =====================================================================

-- 1. Adicionar coluna allowed_sectors (array de chaves de setores)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS allowed_sectors text[] DEFAULT '{}';

-- 2. Adicionar coluna color nos setores (se não existir)
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#8B5CF6';

-- 3. Remover RLS bloqueante em user_roles (se houver)
DROP POLICY IF EXISTS "Permitir acesso a roles" ON public.user_roles;

-- 4. Recriar policy liberada para leitura e escrita
CREATE POLICY "Permitir acesso a roles" ON public.user_roles
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Garantir que sectors também tem policy liberada
DROP POLICY IF EXISTS "Permitir acesso a setores" ON public.sectors;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso a setores" ON public.sectors
  FOR ALL USING (true) WITH CHECK (true);

-- Pronto! As colunas foram adicionadas.
