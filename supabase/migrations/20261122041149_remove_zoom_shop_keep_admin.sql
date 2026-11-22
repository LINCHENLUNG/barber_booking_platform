-- One-off data cleanup (approved by the owner 2026-11-22): remove the ZOOM shop run by the
-- admin account uma6150@gmail.com — its barber, services, slots, photo rows and their bookings —
-- and clear the shop fields on that profile. The account itself stays role='admin'.
-- (The photo FILE was removed via the Storage API, which is the supported way to delete objects.)
do $$
declare v_owner uuid;
begin
  select id into v_owner from public.profiles where email = 'uma6150@gmail.com';
  if v_owner is null then return; end if;

  -- bookings on this shop's services (booking_slots go with them via ON DELETE CASCADE)
  delete from public.bookings b
   using public.services s, public.barbers br
   where b.service_id = s.id and s.barber_id = br.id and br.shop_id = v_owner;

  -- the barber; services, bookable_slots and barber_photos cascade from it
  delete from public.barbers where shop_id = v_owner;

  -- clear the shop details, keep the admin account
  update public.profiles
     set display_name = null, bank_account_name = null, bank_account_number = null
   where id = v_owner;
end $$;
