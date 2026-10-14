alter table public.future_remote_devices
  add column if not exists request_id uuid references public.future_remote_requests(id) on delete set null,
  add column if not exists linked_at timestamptz;

update public.future_remote_devices d
set request_id = r.id,
    linked_at = coalesce(d.linked_at, r.updated_at, now()),
    client_name = r.client_name,
    client_company = r.client_company,
    updated_at = now()
from public.future_remote_requests r
where r.mesh_device_id = d.mesh_device_id
  and (d.request_id is distinct from r.id
       or d.client_name is distinct from r.client_name
       or d.client_company is distinct from r.client_company);

create index if not exists future_remote_devices_request_id_idx
  on public.future_remote_devices(request_id);

create or replace function public.link_future_remote_device(
  p_request_id uuid,
  p_device_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_device public.future_remote_devices%rowtype;
  v_request public.future_remote_requests%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_email <> 'dalprapf1@gmail.com'
     and not public.has_role(auth.uid(), 'gestor'::public.app_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_request
  from public.future_remote_requests
  where id = p_request_id
  for update;

  if not found or v_request.status in ('finalizado', 'cancelado', 'expirado') then
    raise exception 'request_not_available' using errcode = 'P0001';
  end if;

  select * into v_device
  from public.future_remote_devices
  where id = p_device_id
  for update;

  if not found then
    raise exception 'device_not_found' using errcode = 'P0001';
  end if;

  if v_device.request_id is not null and v_device.request_id <> p_request_id then
    raise exception 'device_already_linked' using errcode = 'P0001';
  end if;

  if v_request.mesh_device_id is not null and v_request.mesh_device_id <> v_device.mesh_device_id then
    raise exception 'request_already_linked' using errcode = 'P0001';
  end if;

  update public.future_remote_requests
  set mesh_device_id = v_device.mesh_device_id,
      computer_name = v_device.device_name,
      linked_at = now(),
      updated_at = now()
  where id = p_request_id;

  update public.future_remote_devices
  set request_id = p_request_id,
      linked_at = now(),
      client_name = v_request.client_name,
      client_company = v_request.client_company,
      updated_at = now()
  where id = p_device_id;
end;
$$;

revoke all on function public.link_future_remote_device(uuid, uuid) from public, anon;
grant execute on function public.link_future_remote_device(uuid, uuid) to authenticated;
