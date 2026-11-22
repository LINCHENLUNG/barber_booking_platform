-- (1) Public shop names for the barber pages. Returns ONLY id + display_name, and only for
--     profiles that own at least one barber (a storefront) — never email, role or bank_account_*,
--     and never a customer's name even if their id is passed in.
create or replace function public.get_shop_names(shop_ids uuid[])
returns table(id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = any(shop_ids)
    and exists (select 1 from public.barbers b where b.shop_id = p.id);
$$;
grant execute on function public.get_shop_names(uuid[]) to anon, authenticated;

-- (2) Only customer accounts can book (shops/admins get a clear error). Same body as before
--     plus the role check right after the sign-in check.
create or replace function public.create_booking(p_service_id uuid, p_start_slot_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_barber_id uuid; v_n int; v_price int; v_start timestamptz;
  v_slot_ids uuid[]; v_booking_id uuid;
  v_slots record; v_prev_end timestamptz; v_count int := 0;
begin
  if auth.uid() is null then raise exception 'please sign in to book'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
    raise exception 'Please use a customer account to book.' using errcode = '42501';
  end if;
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
revoke execute on function public.create_booking(uuid, uuid) from public, anon;
grant execute on function public.create_booking(uuid, uuid) to authenticated;
