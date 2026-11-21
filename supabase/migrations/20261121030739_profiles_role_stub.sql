-- M0 Step 9: profiles.role stub (trigger on signup + backfill).
-- profiles: one row per auth user, carrying the role.
-- The bank_account_* columns are the SHOP-LEVEL payout target: one shop can
-- run many barbers (M1.1), so the bank account belongs to the PERSON, not a
-- barber profile. They stay NULL until the shop fills "payout settings" in
-- M1.1; only the shop + an admin may read them.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,           -- shop name for a SHOP (required in M1.1); own name for a customer
  role text not null default 'customer' check (role in ('customer','shop','admin')),
  bank_account_name   text,
  bank_account_number text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- a user can read/update their own profile row (admin read via is_admin() arrives in M1.1).
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- create the profile row on signup, copying the role from sign-up metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'customer')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- BACKFILL: users who signed up before the trigger existed. Fallback is 'shop'
-- (a metadata-less pre-trigger user is most likely the student's own early
-- shop test account). on conflict do nothing -> safe to re-run.
insert into public.profiles (id, email, role)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'role',''), 'shop')
from auth.users u
on conflict (id) do nothing;
