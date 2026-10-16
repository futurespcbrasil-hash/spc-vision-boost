-- Todos os usuários autenticados do CRM podem visualizar e manter o cadastro
-- compartilhado de computadores do Future Remote. A sincronização global com o
-- MeshCentral continua restrita no endpoint administrativo da Edge Function.
drop policy if exists future_remote_admin_gestor_atendimento on public.future_remote_devices;
drop policy if exists future_remote_admin_or_gestor on public.future_remote_devices;

create policy future_remote_authenticated_users
on public.future_remote_devices
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
