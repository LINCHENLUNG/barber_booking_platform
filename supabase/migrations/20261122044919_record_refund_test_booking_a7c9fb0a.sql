-- One-off: booking a7c9fb0a (Women's perm, NT$4,800) was paid and then cancelled before refund-on-cancel
-- existed. Its payment was refunded in the Stripe sandbox (re_3UeSZF0zY6ejQtig1HzWhakp); record it.
update public.bookings
   set refunded_at = now(), stripe_refund_id = 're_3UeSZF0zY6ejQtig1HzWhakp'
 where id = 'a7c9fb0a-dbab-4126-a88c-6859481a35dd'
   and status = 'cancelled' and refunded_at is null;
