-- Test data for the M2.1 end-to-end payment test: six 30-min slots for barber Rick,
-- 2026-11-23 13:00–16:00 Asia/Taipei. (ZOOM's owner was promoted to admin, so the shop UI
-- can't publish slots right now.)
insert into public.bookable_slots (barber_id, starts_at, ends_at)
select b.id, g, g + interval '30 minutes'
from public.barbers b
cross join generate_series(timestamptz '2026-11-23 13:00+08', timestamptz '2026-11-23 15:30+08', interval '30 minutes') g
where b.name = 'Rick'
  and not exists (select 1 from public.bookable_slots x where x.barber_id = b.id and x.starts_at = g);
