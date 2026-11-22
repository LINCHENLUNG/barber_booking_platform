-- ============================================================
-- M2.2 — commission settlement (flexible per-shop payout batches)
-- owed_bookings VIEW (live owed pool) + payouts TABLE + admin RPCs + RLS.
-- No transactions table, no fee columns on bookings: settlement is derived from
-- bookings.payout_id (paid + NULL = owed; paid + set = in that payout).
-- ============================================================

-- 1) payouts: a batch for ONE shop. shop_id is NOT unique (many payouts per shop).
create table if not exists public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references public.profiles(id) on delete cascade,
  shop_name             text,                         -- snapshot of profiles.display_name
  status                text not null default 'pending_transfer'
                          check (status in ('pending_transfer','transferred','cancelled')),
  gross                 integer not null default 0,
  platform_pct          numeric(5,4) not null,
  platform_cut          integer not null default 0,
  shop_cut              integer not null default 0,
  bookings_count        integer not null default 0,
  note                  text,
  bank_reference        text,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  marked_transferred_at timestamptz,
  transferred_by        uuid references public.profiles(id)
);
create index if not exists idx_payouts_shop   on public.payouts(shop_id);
create index if not exists idx_payouts_status on public.payouts(status);
create index if not exists idx_bookings_payout on public.bookings(payout_id);

-- bookings.payout_id was a bare uuid since M1.2 — add the FK now that payouts exists.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'bookings'
      and constraint_name = 'bookings_payout_id_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_payout_id_fkey
      foreign key (payout_id) references public.payouts(id) on delete set null;
  end if;
end $$;

-- 2) Admin can read every booking (needed by the security_invoker owed_bookings view).
drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin" on public.bookings
  for select to authenticated using (public.is_admin());

-- 3) The live owed pool: one row per paid booking not yet in a payout, split by the rate in
--    force on its paid date. security_invoker → inherits bookings RLS; the extra WHERE keeps
--    it to admin + the owning shop (a customer never sees the platform cut).
drop view if exists public.owed_bookings;
create view public.owed_bookings
  with (security_invoker = true) as
select b.id as booking_id, b.price, b.paid_at,
       b.customer_id,
       bar.shop_id, bar.id as barber_id, bar.name as barber_name,
       p.display_name as shop_name,
       s.name as service_name,
       r.platform_pct,
       round(b.price * r.platform_pct)::int             as platform_cut,
       (b.price - round(b.price * r.platform_pct))::int as shop_cut
from public.bookings b
join public.services s  on s.id = b.service_id
join public.barbers bar on bar.id = s.barber_id
join public.profiles p  on p.id = bar.shop_id
cross join lateral (
  select platform_pct from public.commission_rates
  where effective_from <= coalesce(b.paid_at::date, current_date)
  order by effective_from desc limit 1
) r
where b.status = 'paid' and b.payout_id is null
  and (public.is_admin() or bar.shop_id = auth.uid());

grant select on public.owed_bookings to authenticated;
revoke all on public.owed_bookings from anon;

-- 4) RLS on payouts: admin reads all, a shop reads only its own. Writes only via admin RPCs.
alter table public.payouts enable row level security;
drop policy if exists "payouts_select_admin_or_owner" on public.payouts;
create policy "payouts_select_admin_or_owner" on public.payouts
  for select to authenticated using (public.is_admin() or shop_id = auth.uid());
drop policy if exists "payouts_insert_admin" on public.payouts;
create policy "payouts_insert_admin" on public.payouts
  for insert to authenticated with check (public.is_admin());
drop policy if exists "payouts_update_admin" on public.payouts;
create policy "payouts_update_admin" on public.payouts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5a) BUILD a payout from selected owed bookings of ONE shop. Atomic, admin-only.
create or replace function public.build_payout(p_booking_ids uuid[], p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_shop_count integer;
  v_shop_name text;
  v_rate numeric(5,4);
  v_gross integer;
  v_count integer;
  v_platform_cut integer;
  v_payout_id uuid;
  v_stamped integer;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  -- lock the selected owed rows so a concurrent build can't grab them
  perform 1 from public.bookings
  where id = any(p_booking_ids) and status = 'paid' and payout_id is null
  for update;

  -- NB: (array_agg(distinct ...))[1], not min() — there is no min(uuid) aggregate.
  select count(distinct bar.shop_id), (array_agg(distinct bar.shop_id))[1],
         coalesce(sum(b.price), 0), count(*)
    into v_shop_count, v_shop_id, v_gross, v_count
  from public.bookings b
  join public.services s  on s.id = b.service_id
  join public.barbers bar on bar.id = s.barber_id
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

  select display_name into v_shop_name from public.profiles where id = v_shop_id;
  select platform_pct into v_rate
  from public.commission_rates
  where effective_from <= current_date
  order by effective_from desc limit 1;
  if v_rate is null then
    raise exception 'no commission rate in force';
  end if;

  v_platform_cut := round(v_gross * v_rate)::int;

  insert into public.payouts
    (shop_id, shop_name, status, gross, platform_pct, platform_cut, shop_cut, bookings_count, note, created_by)
  values
    (v_shop_id, v_shop_name, 'pending_transfer', v_gross, v_rate,
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

-- 5b) MARK TRANSFERRED — record the out-of-app bank transfer. Bookings unchanged.
create or replace function public.mark_payout_transferred(p_payout_id uuid, p_bank_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.payouts
  set status = 'transferred',
      marked_transferred_at = now(),
      transferred_by = auth.uid(),
      bank_reference = coalesce(nullif(trim(p_bank_reference), ''), bank_reference)
  where id = p_payout_id and status = 'pending_transfer';

  if not found then
    raise exception 'payout not found or not pending_transfer (a transferred/cancelled payout is immutable)';
  end if;
end;
$$;

-- 5c) CANCEL — only while pending_transfer. Bookings go back to owed; the row is kept.
create or replace function public.cancel_payout(p_payout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.payouts
  set status = 'cancelled'
  where id = p_payout_id and status = 'pending_transfer';

  if not found then
    raise exception 'payout not found or not pending_transfer (a transferred payout is immutable)';
  end if;

  update public.bookings
  set payout_id = null
  where payout_id = p_payout_id;
end;
$$;

-- 6) Defense in depth: anon can never be admin.
revoke execute on function public.build_payout(uuid[], text)          from public, anon;
revoke execute on function public.mark_payout_transferred(uuid, text) from public, anon;
revoke execute on function public.cancel_payout(uuid)                 from public, anon;
grant  execute on function public.build_payout(uuid[], text)          to authenticated;
grant  execute on function public.mark_payout_transferred(uuid, text) to authenticated;
grant  execute on function public.cancel_payout(uuid)                 to authenticated;
