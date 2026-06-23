create or replace function public.decline_timesheet(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
begin
  perform set_config('app.allow_status_change', 'on', true);

  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'decline reason required' using errcode='22023';
  end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'submitted' then
    raise exception 'can only decline submitted timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  update public.timesheets
     set status='declined', decided_at=now(), decided_by=v_actor,
         decline_reason=p_reason, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'decline', p_reason);
end$$;

grant execute on function public.decline_timesheet(uuid, text) to authenticated;
