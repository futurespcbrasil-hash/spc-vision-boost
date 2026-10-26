create or replace function public.normalize_crm_phone(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(digits) in (12, 13) and left(digits, 2) = '55' then
      case when length(substr(digits, 3)) = 11 and substr(substr(digits, 3), 3, 1) = '9'
        then left(substr(digits, 3), 2) || substr(substr(digits, 3), 4)
        else substr(digits, 3)
      end
    when length(digits) = 11 and substr(digits, 3, 1) = '9' then left(digits, 2) || substr(digits, 4)
    else digits
  end
  from (select regexp_replace(coalesce(value, ''), '\\D', '', 'g') as digits) normalized
$$;

create or replace function public.link_whatsapp_chat_to_existing_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_ids uuid[];
  matching_count integer;
  matching_name text;
  phone_key text;
begin
  if new.lead_id is not null or coalesce(new.is_group, false) then
    return new;
  end if;

  phone_key := public.normalize_crm_phone(new.contact_number);
  if length(phone_key) < 8 then
    return new;
  end if;

  select array_agg(candidate.id), count(*), min(candidate.name)
    into matching_ids, matching_count, matching_name
  from (
    select distinct l.id, l.name
    from public.leads l
    where public.normalize_crm_phone(l.whatsapp) = phone_key
       or public.normalize_crm_phone(l.phone) = phone_key
  ) candidate;

  if matching_count = 1 then
    new.lead_id := matching_ids[1];
    if coalesce(new.contact_name, '') = ''
       or new.contact_name = new.contact_number
       or new.contact_name ~ '^[+0-9(). -]+$' then
      new.contact_name := matching_name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_whatsapp_chat_to_existing_lead on public.whatsapp_chats;
create trigger trg_link_whatsapp_chat_to_existing_lead
before insert or update of contact_number, lead_id, is_group
on public.whatsapp_chats
for each row execute function public.link_whatsapp_chat_to_existing_lead();

comment on function public.link_whatsapp_chat_to_existing_lead() is
'Links a WhatsApp chat to a unique existing CRM lead by normalized phone number; does not create duplicate leads.';
