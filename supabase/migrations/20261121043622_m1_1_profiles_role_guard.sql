-- Close two self-escalation paths to 'admin':
-- (1) sign-up metadata is client-controlled -> the signup trigger only ever writes customer|shop
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.raw_user_meta_data->>'role' = 'shop' then 'shop' else 'customer' end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- (2) profiles_update_own lets a user write their own row; an API user (auth.uid() set) may only
--     change role customer -> shop ("Become a shop"). Migrations / service role (no auth.uid()) are
--     unaffected, so the M2.1 admin promotion migration still works.
create or replace function public.guard_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not (old.role = 'customer' and new.role = 'shop') then
    raise exception 'role change from % to % is not allowed', old.role, new.role
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update of role on public.profiles
  for each row execute function public.guard_profile_role();
