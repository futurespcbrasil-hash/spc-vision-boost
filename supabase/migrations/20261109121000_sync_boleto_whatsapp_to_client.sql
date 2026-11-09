create or replace function public.sync_boleto_whatsapp_to_client()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  numero text;
begin
  numero := regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g');
  if new.client_id is not null and numero <> '' and new.user_id is not null then
    update public.boleto_clientes
       set whatsapp = case
         when length(numero) in (12, 13) and left(numero, 2) = '55' then substring(numero from 3)
         else numero
       end,
       updated_at = now()
     where id = new.client_id
       and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_boleto_whatsapp_to_client on public.boleto_envios;
create trigger trg_sync_boleto_whatsapp_to_client
after insert or update of client_id, whatsapp on public.boleto_envios
for each row execute function public.sync_boleto_whatsapp_to_client();
