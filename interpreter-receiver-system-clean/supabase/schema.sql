-- Interpreter Receiver Rental System
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  event_date date,
  location text,
  registration_open boolean not null default true,
  active boolean not null default true,
  receiver_digits integer not null default 3 check (receiver_digits between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  public_token uuid not null default gen_random_uuid() unique,
  member_no text not null,
  full_name text not null,
  email text,
  phone text,
  language text not null,
  ui_language text not null default 'en',
  consent boolean not null default false,
  consent_at timestamptz,
  status text not null default 'registered'
    check (status in ('registered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_no)
);

create table if not exists public.receivers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  receiver_no text not null,
  status text not null default 'available'
    check (status in ('available', 'rented', 'maintenance', 'damaged', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, receiver_no)
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  receiver_id uuid not null references public.receivers(id) on delete restrict,
  status text not null default 'rented'
    check (status in ('rented', 'returned', 'damaged', 'lost')),
  rented_at timestamptz not null default now(),
  returned_at timestamptz,
  staff_name text not null,
  return_staff_name text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists rentals_one_active_per_registration
  on public.rentals(registration_id)
  where status = 'rented';

create unique index if not exists rentals_one_active_per_receiver
  on public.rentals(receiver_id)
  where status = 'rented';

create index if not exists registrations_event_idx
  on public.registrations(event_id);

create index if not exists registrations_member_idx
  on public.registrations(event_id, member_no);

create index if not exists receivers_event_status_idx
  on public.receivers(event_id, status);

create index if not exists rentals_event_status_idx
  on public.rentals(event_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

drop trigger if exists receivers_set_updated_at on public.receivers;
create trigger receivers_set_updated_at
before update on public.receivers
for each row execute function public.set_updated_at();

create or replace function public.rent_receiver(
  p_event_id uuid,
  p_registration_id uuid,
  p_receiver_no text,
  p_staff_name text
)
returns table (
  rental_id uuid,
  receiver_no text,
  member_no text,
  full_name text,
  language text,
  rented_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver public.receivers%rowtype;
  v_registration public.registrations%rowtype;
  v_rental public.rentals%rowtype;
begin
  if nullif(trim(p_staff_name), '') is null then
    raise exception 'Staff name is required';
  end if;

  select * into v_registration
  from public.registrations
  where id = p_registration_id
    and event_id = p_event_id
    and status = 'registered';

  if not found then
    raise exception 'Registration not found or unavailable';
  end if;

  if exists (
    select 1 from public.rentals
    where registration_id = p_registration_id and status = 'rented'
  ) then
    raise exception 'This member already has an active receiver';
  end if;

  select * into v_receiver
  from public.receivers
  where event_id = p_event_id
    and receiver_no = trim(p_receiver_no)
  for update;

  if not found then
    raise exception 'Receiver number not found';
  end if;

  if v_receiver.status <> 'available' then
    raise exception 'Receiver is not available';
  end if;

  insert into public.rentals (
    event_id, registration_id, receiver_id, status, staff_name
  ) values (
    p_event_id, p_registration_id, v_receiver.id, 'rented', trim(p_staff_name)
  )
  returning * into v_rental;

  update public.receivers
  set status = 'rented'
  where id = v_receiver.id;

  return query
  select
    v_rental.id,
    v_receiver.receiver_no,
    v_registration.member_no,
    v_registration.full_name,
    v_registration.language,
    v_rental.rented_at;
end;
$$;

create or replace function public.return_receiver(
  p_event_id uuid,
  p_receiver_no text,
  p_return_status text,
  p_staff_name text,
  p_notes text default null
)
returns table (
  rental_id uuid,
  receiver_no text,
  member_no text,
  full_name text,
  language text,
  return_status text,
  returned_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver public.receivers%rowtype;
  v_registration public.registrations%rowtype;
  v_rental public.rentals%rowtype;
  v_receiver_status text;
begin
  if p_return_status not in ('returned', 'damaged', 'lost') then
    raise exception 'Invalid return status';
  end if;

  if nullif(trim(p_staff_name), '') is null then
    raise exception 'Staff name is required';
  end if;

  select * into v_receiver
  from public.receivers
  where event_id = p_event_id
    and receiver_no = trim(p_receiver_no)
  for update;

  if not found then
    raise exception 'Receiver number not found';
  end if;

  select * into v_rental
  from public.rentals
  where receiver_id = v_receiver.id
    and status = 'rented'
  order by rented_at desc
  limit 1
  for update;

  if not found then
    raise exception 'This receiver is not currently rented';
  end if;

  select * into v_registration
  from public.registrations
  where id = v_rental.registration_id;

  update public.rentals
  set
    status = p_return_status,
    returned_at = now(),
    return_staff_name = trim(p_staff_name),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = v_rental.id
  returning * into v_rental;

  v_receiver_status := case
    when p_return_status = 'returned' then 'available'
    when p_return_status = 'damaged' then 'damaged'
    else 'lost'
  end;

  update public.receivers
  set status = v_receiver_status
  where id = v_receiver.id;

  return query
  select
    v_rental.id,
    v_receiver.receiver_no,
    v_registration.member_no,
    v_registration.full_name,
    v_registration.language,
    v_rental.status,
    v_rental.returned_at;
end;
$$;

create or replace function public.setup_event(
  p_code text,
  p_name text,
  p_event_date date,
  p_location text,
  p_receiver_start integer,
  p_receiver_end integer,
  p_receiver_digits integer default 3,
  p_registration_open boolean default true
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Event code and name are required';
  end if;

  if p_receiver_start < 0 or p_receiver_end < p_receiver_start then
    raise exception 'Invalid receiver range';
  end if;

  if p_receiver_end - p_receiver_start + 1 > 5000 then
    raise exception 'Receiver range is too large';
  end if;

  insert into public.events (
    code, name, event_date, location, registration_open, active, receiver_digits
  ) values (
    upper(trim(p_code)),
    trim(p_name),
    p_event_date,
    nullif(trim(coalesce(p_location, '')), ''),
    p_registration_open,
    true,
    p_receiver_digits
  )
  on conflict (code) do update set
    name = excluded.name,
    event_date = excluded.event_date,
    location = excluded.location,
    registration_open = excluded.registration_open,
    active = true,
    receiver_digits = excluded.receiver_digits
  returning * into v_event;

  insert into public.receivers (event_id, receiver_no, status)
  select
    v_event.id,
    lpad(gs::text, p_receiver_digits, '0'),
    'available'
  from generate_series(p_receiver_start, p_receiver_end) as gs
  on conflict (event_id, receiver_no) do nothing;

  return v_event;
end;
$$;

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.receivers enable row level security;
alter table public.rentals enable row level security;

revoke all on public.events from anon, authenticated;
revoke all on public.registrations from anon, authenticated;
revoke all on public.receivers from anon, authenticated;
revoke all on public.rentals from anon, authenticated;

revoke all on function public.rent_receiver(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.return_receiver(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.setup_event(text, text, date, text, integer, integer, integer, boolean) from public, anon, authenticated;

grant execute on function public.rent_receiver(uuid, uuid, text, text) to service_role;
grant execute on function public.return_receiver(uuid, text, text, text, text) to service_role;
grant execute on function public.setup_event(text, text, date, text, integer, integer, integer, boolean) to service_role;
