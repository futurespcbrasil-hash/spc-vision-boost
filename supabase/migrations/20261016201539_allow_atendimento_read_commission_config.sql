create policy "Atendimento consulta configuração de comissão"
on public.atendimento_comissao_config
for select
to authenticated
using (
  has_role((select auth.uid()), 'atendimento'::app_role)
  or has_role((select auth.uid()), 'gestor'::app_role)
  or lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
);
