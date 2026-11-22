-- M2.1: versioned commission ratio + Stripe PaymentIntent pointer on bookings.
-- The rate for a booking = the row with the greatest effective_from <= the booking's paid_at.
-- NO transactions table, NO fee columns on bookings — the split is computed at payout-build time (M2.2).
create table if not exists public.commission_rates (
  id             uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  platform_pct   numeric(5,4) not null check (platform_pct >= 0 and platform_pct < 1),
  note           text
);
insert into public.commission_rates (effective_from, platform_pct, note)
  values ('2026-01-01', 0.20, 'default 20% platform / 80% shop')
  on conflict (effective_from) do nothing;

alter table public.commission_rates enable row level security;
create policy "commission_rates_select_public" on public.commission_rates
  for select using (true);
create policy "commission_rates_write_admin" on public.commission_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.commission_rates to anon, authenticated;

-- The webhook stamps session.payment_intent on the paid flip: reconciliation pointer +
-- idempotency backstop (UNIQUE rejects a concurrent double-fire past the status guard).
alter table public.bookings add column if not exists stripe_payment_intent_id text;
create unique index if not exists uniq_bookings_pi on public.bookings(stripe_payment_intent_id);
