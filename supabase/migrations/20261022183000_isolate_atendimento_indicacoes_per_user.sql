-- Ensure each non-gestor sees and manages only their own referred clients.
-- The dalprapf1 account is not a global exception; it follows the same ownership rule.
drop policy if exists "Atendimento vê próprias indicações e gestor vê todas" on public.atendimento_indicacoes;
drop policy if exists "Atendimento e gestores inserem indicações" on public.atendimento_indicacoes;
drop policy if exists "Atendimento atualiza próprias indicações e gestor todas" on public.atendimento_indicacoes;
drop policy if exists "Atendimento exclui próprias indicações e gestor todas" on public.atendimento_indicacoes;

create policy "Usuário vê próprias indicações e gestor vê todas"
on public.atendimento_indicacoes for select to authenticated
using (user_id = (select auth.uid()) or has_role((select auth.uid()), 'gestor'::app_role));

create policy "Usuário insere próprias indicações e gestor pode inserir"
on public.atendimento_indicacoes for insert to authenticated
with check (user_id = (select auth.uid()) or has_role((select auth.uid()), 'gestor'::app_role));

create policy "Usuário atualiza próprias indicações e gestor todas"
on public.atendimento_indicacoes for update to authenticated
using (user_id = (select auth.uid()) or has_role((select auth.uid()), 'gestor'::app_role))
with check (user_id = (select auth.uid()) or has_role((select auth.uid()), 'gestor'::app_role));

create policy "Usuário exclui próprias indicações e gestor todas"
on public.atendimento_indicacoes for delete to authenticated
using (user_id = (select auth.uid()) or has_role((select auth.uid()), 'gestor'::app_role));
