-- dalprapf1 may see all referred clients in the commissions overview.
-- The personal /indicacoes/clientes page explicitly filters by the current user,
-- and other users remain restricted by RLS to their own records.
drop policy if exists "Usuário vê próprias indicações e gestor vê todas" on public.atendimento_indicacoes;
drop policy if exists "Usuário vê próprias indicações, gestor e dalprapf1 veem todas" on public.atendimento_indicacoes;

create policy "Usuário vê próprias indicações, gestor e dalprapf1 veem todas"
on public.atendimento_indicacoes for select to authenticated
using (
  user_id = (select auth.uid())
  or has_role((select auth.uid()), 'gestor'::app_role)
  or (select auth.uid()) = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid
);
