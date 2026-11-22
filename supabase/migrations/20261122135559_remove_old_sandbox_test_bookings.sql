-- Data cleanup: remove the two cancelled + refunded Women's perm test bookings that were
-- charged in the OLD shared Stripe sandbox (acct_1UbYyT0zY6ejQtig) before Barberly moved to its
-- own sandbox. Both are cancelled, refunded, never paid out, and hold no slots.
delete from public.booking_slots
where booking_id in ('a7c9fb0a-dbab-4126-a88c-6859481a35dd', '45ee34dd-58b4-41b8-82ca-c42a05f93fcd');

delete from public.bookings
where id in ('a7c9fb0a-dbab-4126-a88c-6859481a35dd', '45ee34dd-58b4-41b8-82ca-c42a05f93fcd')
  and status = 'cancelled'
  and payout_id is null
  and stripe_payment_intent_id like '%0zY6ejQtig%';
