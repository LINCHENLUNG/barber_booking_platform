-- Refund-on-cancel. New nullable columns only (existing columns unchanged).
alter table public.bookings
  add column if not exists refunded_at timestamptz,
  add column if not exists stripe_refund_id text;

-- API users (the browser) may only cancel an UNPAID booking. Cancelling a PAID booking goes through
-- POST /api/bookings/cancel (service role), which refunds via Stripe first — so a customer can
-- never cancel a paid booking without the refund. Refund/payment columns are locked for API users.
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
    if old.status = 'paid' and new.status = 'cancelled' then
      raise exception 'a paid booking is cancelled with a refund — use Cancel in My bookings'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and new.status = 'cancelled' and old.status = 'pending_payment'
       and (new.customer_id, new.service_id, new.price, new.paid_at, new.payout_id, new.created_at,
            new.stripe_payment_intent_id, new.refunded_at, new.stripe_refund_id)
           is not distinct from
           (old.customer_id, old.service_id, old.price, old.paid_at, old.payout_id, old.created_at,
            old.stripe_payment_intent_id, old.refunded_at, old.stripe_refund_id) then
      return new;
    end if;
    raise exception 'a booking can only be cancelled' using errcode = '42501';
  end if;
  return new;
end; $$;

-- Recreate the view so b.* picks up the new columns (a view's * is fixed when it is created).
drop view if exists public.bookings_with_start;
create view public.bookings_with_start
  with (security_invoker = true) as
select b.*,
       (select min(s.starts_at) from public.booking_slots bs
          join public.bookable_slots s on s.id = bs.slot_id
        where bs.booking_id = b.id) as starts_at,
       (select max(s.ends_at)  from public.booking_slots bs
          join public.bookable_slots s on s.id = bs.slot_id
        where bs.booking_id = b.id) as ends_at
from public.bookings b;
