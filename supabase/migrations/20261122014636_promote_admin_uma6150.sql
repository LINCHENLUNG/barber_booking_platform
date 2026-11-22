-- one-off (M2.1 prereq): promote a single, known account to admin
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'uma6150@gmail.com');
