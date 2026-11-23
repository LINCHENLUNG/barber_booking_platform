-- build_payout now splits each booking with the commission rate in force on its PAID date —
-- the same rule as the owed_bookings view — so the builder preview always equals the snapshot,
-- even if commission_rates changes between payment and payout.
-- payouts.platform_pct = that rate when all bookings share it; otherwise the effective
-- (weighted) rate platform_cut / gross, rounded to 4 dp. platform_cut is exact either way.
create or replace function public.build_payout(p_booking_ids uuid[], p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_shop_count integer;
  v_shop_name text;
  v_gross integer;
  v_platform_cut integer;
  v_rate_count integer;
  v_rate numeric(5,4);
  v_count integer;
  v_payout_id uuid;
  v_stamped integer;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  perform 1 from public.bookings
  where id = any(p_booking_ids) and status = 'paid' and payout_id is null
  for update;

  select count(distinct bar.shop_id), (array_agg(distinct bar.shop_id))[1],
         coalesce(sum(b.price), 0),
         coalesce(sum(round(b.price * r.platform_pct)::int), 0),
         count(distinct r.platform_pct), (array_agg(distinct r.platform_pct))[1],
         count(*)
    into v_shop_count, v_shop_id, v_gross, v_platform_cut, v_rate_count, v_rate, v_count
  from public.bookings b
  join public.services s  on s.id = b.service_id
  join public.barbers bar on bar.id = s.barber_id
  left join lateral (
    select platform_pct from public.commission_rates
    where effective_from <= coalesce(b.paid_at::date, current_date)
    order by effective_from desc limit 1
  ) r on true
  where b.id = any(p_booking_ids)
    and b.status = 'paid' and b.payout_id is null;

  if v_count = 0 then
    raise exception 'no owed bookings in selection';
  end if;
  if v_count <> coalesce(cardinality(p_booking_ids), 0) then
    raise exception 'some selected bookings are not owed (already in a payout, unpaid, or cancelled) — refresh and try again';
  end if;
  if v_shop_count <> 1 then
    raise exception 'all selected bookings must belong to the SAME shop (got % shops)', v_shop_count;
  end if;
  if v_rate is null then
    raise exception 'no commission rate in force for a selected booking';
  end if;
  if v_rate_count > 1 then
    v_rate := round(v_platform_cut::numeric / nullif(v_gross, 0), 4);
  end if;

  select display_name into v_shop_name from public.profiles where id = v_shop_id;

  insert into public.payouts
    (shop_id, shop_name, status, gross, platform_pct, platform_cut, shop_cut, bookings_count, note, created_by)
  values
    (v_shop_id, v_shop_name, 'pending_transfer', v_gross, coalesce(v_rate, 0),
     v_platform_cut, v_gross - v_platform_cut, v_count, nullif(trim(p_note), ''), auth.uid())
  returning id into v_payout_id;

  update public.bookings
  set payout_id = v_payout_id
  where id = any(p_booking_ids) and status = 'paid' and payout_id is null;
  get diagnostics v_stamped = row_count;
  if v_stamped <> v_count then
    raise exception 'selection changed while building — try again';
  end if;

  return v_payout_id;
end;
$$;

revoke execute on function public.build_payout(uuid[], text) from public, anon;
grant  execute on function public.build_payout(uuid[], text) to authenticated;
