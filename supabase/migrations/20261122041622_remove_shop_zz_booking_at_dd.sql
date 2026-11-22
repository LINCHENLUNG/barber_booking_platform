-- One-off data cleanup (approved by the owner 2026-11-22): delete the booking the ZZ shop account
-- (uma6152@yahoo.com.tw) made at shop DD before shop accounts were blocked from booking.
-- booking_slots rows go with it (ON DELETE CASCADE), which frees DiDi's held slots.
delete from public.bookings b
 using public.profiles c, public.services s, public.barbers br, public.profiles shop
 where c.id = b.customer_id and c.email = 'uma6152@yahoo.com.tw'
   and s.id = b.service_id and br.id = s.barber_id
   and shop.id = br.shop_id and shop.display_name = 'DD';
