-- Allow Atendimento to see and operate the shared Future Remote computer inventory,
-- matching the access already granted to the owner and Gestor.
drop policy if exists future_remote_admin_or_gestor on public.future_remote_devices;
drop policy if exists future_remote_admin_gestor_atendimento on public.future_remote_devices;

create policy future_remote_admin_gestor_atendimento
on public.future_remote_devices
for all
to authenticated
using (
  lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  or has_role((select auth.uid()), 'gestor'::app_role)
  or has_role((select auth.uid()), 'atendimento'::app_role)
)
with check (
  lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'dalprapf1@gmail.com'
  or has_role((select auth.uid()), 'gestor'::app_role)
  or has_role((select auth.uid()), 'atendimento'::app_role)
);
