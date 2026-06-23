create or replace function public.create_or_get_week(p_week_start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org  uuid;
  v_id   uuid;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if extract(dow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday' using errcode='22023';
  end if;
  select org_id into v_org from public.users where id = v_user;
  if v_org is null then raise exception 'user has no org' using errcode='42501'; end if;

  insert into public.timesheets(user_id, org_id, week_start)
  values (v_user, v_org, p_week_start)
  on conflict (user_id, week_start) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.timesheets
      where user_id = v_user and week_start = p_week_start;
  end if;
  return v_id;
end$$;

grant execute on function public.create_or_get_week(date) to authenticated;
