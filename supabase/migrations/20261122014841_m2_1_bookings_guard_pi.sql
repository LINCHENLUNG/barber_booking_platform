-- M2.1: API users may still only cancel; stripe_payment_intent_id is server-written (webhook) only.
create or replace function public.guard_bookings_write()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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
       and (new.customer_id, new.service_id, new.price, new.paid_at, new.payout_id, new.created_at,
            new.stripe_payment_intent_id)
           is not distinct from
           (old.customer_id, old.service_id, old.price, old.paid_at, old.payout_id, old.created_at,
            old.stripe_payment_intent_id) then
      return new;
    end if;
    raise exception 'a booking can only be cancelled' using errcode = '42501';
  end if;
  return new;
end; $function$;
