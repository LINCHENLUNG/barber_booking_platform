-- Hardening on top of the course schema. Direct API callers run as role 'authenticated'/'anon';
-- SECURITY DEFINER functions (create_booking, free_slots_on_cancel) run as the owner, and the
-- service-role key (M2.1 webhook) runs as 'service_role' — neither is affected by these guards.

-- (1) bookings: no direct inserts from the API (forged price/status); book via create_booking only.
--     Direct updates may only cancel a live booking — no price/paid/paid_at/payout edits.
create or replace function public.guard_bookings_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    raise exception 'bookings are created with create_booking()' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and new.status = 'cancelled' and old.status in ('pending_payment','paid')
       and (new.customer_id, new.service_id, new.price, new.paid_at, new.payout_id, new.created_at)
           is not distinct from
           (old.customer_id, old.service_id, old.price, old.paid_at, old.payout_id, old.created_at) then
      return new;
    end if;
    raise exception 'a booking can only be cancelled' using errcode = '42501';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_bookings_write on public.bookings;
create trigger trg_guard_bookings_write
  before insert or update on public.bookings
  for each row execute function public.guard_bookings_write();

-- (2) booking_slots: held slots change only via create_booking (insert) and the cancel trigger
--     (delete) — never directly, or a customer could grab slots without a booking or release a
--     live booking's slots.
create or replace function public.guard_booking_slots_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'booking slots are managed by create_booking() and cancellation'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_guard_booking_slots_write on public.booking_slots;
create trigger trg_guard_booking_slots_write
  before insert or update or delete on public.booking_slots
  for each row execute function public.guard_booking_slots_write();

-- (3) create_booking: same body as the course RPC plus sign-in and "start must be in the future" checks.
create or replace function public.create_booking(p_service_id uuid, p_start_slot_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_barber_id uuid; v_n int; v_price int; v_start timestamptz;
  v_slot_ids uuid[]; v_booking_id uuid;
  v_slots record; v_prev_end timestamptz; v_count int := 0;
begin
  if auth.uid() is null then raise exception 'please sign in to book'; end if;
  select s.price, s.required_slots, sl.barber_id, sl.starts_at
    into v_price, v_n, v_barber_id, v_start
    from public.services s
    join public.bookable_slots sl on sl.id = p_start_slot_id
    where s.id = p_service_id;
  if v_barber_id is null then raise exception 'service or start slot not found'; end if;
  if not exists (select 1 from public.services s where s.id = p_service_id and s.barber_id = v_barber_id) then
    raise exception 'service and slot belong to different barbers';
  end if;
  if v_start <= now() then raise exception 'that start time has already passed'; end if;

  v_slot_ids := array[]::uuid[];
  for v_slots in
    select id, starts_at, ends_at from public.bookable_slots
    where barber_id = v_barber_id and starts_at >= v_start
    order by starts_at
    limit v_n
  loop
    if v_count > 0 and v_slots.starts_at <> v_prev_end then
      raise exception 'this service needs % back-to-back slots from that start time, but the barber has a gap', v_n;
    end if;
    v_slot_ids := v_slot_ids || v_slots.id;
    v_prev_end := v_slots.ends_at;
    v_count := v_count + 1;
  end loop;
  if v_count <> v_n then
    raise exception 'not enough consecutive slots from that start time for this service (needs %)', v_n;
  end if;

  insert into public.bookings(customer_id, service_id, price)
    values (auth.uid(), p_service_id, v_price)
    returning id into v_booking_id;
  insert into public.booking_slots(booking_id, slot_id)
    select v_booking_id, unnest(v_slot_ids);

  return v_booking_id;
exception when unique_violation then
  raise exception 'one or more of those time slots were just taken — pick another start time';
end; $$;

-- (4) the default PUBLIC execute grant still reaches anon; close it properly.
revoke execute on function public.create_booking(uuid, uuid) from public, anon;
grant execute on function public.create_booking(uuid, uuid) to authenticated;
revoke execute on function public.free_slots_on_cancel() from public, anon, authenticated;
