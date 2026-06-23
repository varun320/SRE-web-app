create or replace function public.submit_timesheet(p_timesheet_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ts   record;
  v_bad  int;
begin
  perform set_config('app.allow_status_change', 'on', true);

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
  if v_ts.status not in ('draft','declined') then
    raise exception 'cannot submit from status %', v_ts.status using errcode='22023';
  end if;

  if not exists (select 1 from public.timesheet_entries where timesheet_id = p_timesheet_id) then
    raise exception 'timesheet has no entries' using errcode='22023';
  end if;

  select count(*) into v_bad from public.timesheet_entries
   where timesheet_id = p_timesheet_id and length(trim(description)) = 0;
  if v_bad > 0 then raise exception '% entries with empty description', v_bad using errcode='22023'; end if;

  update public.timesheets
     set status='submitted', submitted_at=now(), updated_at=now(),
         decline_reason = null
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_user, 'submit', null);
end$$;

grant execute on function public.submit_timesheet(uuid) to authenticated;
