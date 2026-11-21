-- handle_new_user() is a trigger-only SECURITY DEFINER function; it must not be
-- callable via /rest/v1/rpc. Triggers still fire without EXECUTE for these roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
