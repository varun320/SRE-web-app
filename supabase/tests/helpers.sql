create schema if not exists test_helpers;

create or replace function test_helpers.make_user(
  p_email text,
  p_role  text,
  p_name  text,
  p_code  text,
  p_position text default 'Senior Engineer'
) returns uuid language plpgsql as $$
declare
  v_uid uuid := gen_random_uuid();
  v_pos uuid;
begin
  insert into auth.users(id, email) values (v_uid, p_email);
  select id into v_pos from public.positions where name = p_position limit 1;
  insert into public.users(id, org_id, full_name, email, employee_code, position_id)
  values (v_uid, '00000000-0000-0000-0000-000000000001', p_name, p_email, p_code, v_pos);
  insert into public.user_roles(user_id, role) values (v_uid, p_role::public.app_role);
  return v_uid;
end$$;

create or replace function test_helpers.set_auth(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text)::text, true);
  perform set_config('role', 'authenticated', true);
end$$;

create or replace function test_helpers.sub_id(p_name text) returns uuid language sql stable as $$
  select id from public.sub_categories where name = p_name limit 1;
$$;
