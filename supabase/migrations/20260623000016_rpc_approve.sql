create or replace function public.prior_til_balance(p_user uuid, p_week date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select closing_balance from public.til_ledger
     where user_id = p_user and not stale and week_start < p_week
     order by week_start desc limit 1
  ), 0);
$$;

create or replace function public.prior_vacation_balance(p_user uuid, p_week date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select closing_balance from public.vacation_ledger
     where user_id = p_user and not stale and week_start < p_week
     order by week_start desc limit 1
  ), 0);
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_tot   record;
  v_open_til  numeric; v_open_vac numeric;
begin
  perform set_config('app.allow_status_change', 'on', true);

  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'submitted' then
    raise exception 'can only approve submitted timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  select * into v_tot from public.v_timesheet_totals where timesheet_id = p_timesheet_id;
  v_open_til := public.prior_til_balance(v_ts.user_id, v_ts.week_start);
  v_open_vac := public.prior_vacation_balance(v_ts.user_id, v_ts.week_start);

  insert into public.til_ledger(user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_til, coalesce(v_tot.overtime_earned,0), coalesce(v_tot.til_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        overtime_earned = excluded.overtime_earned,
        til_used        = excluded.til_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  insert into public.vacation_ledger(user_id, week_start, opening_balance, vacation_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_vac, coalesce(v_tot.vacation_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        vacation_used   = excluded.vacation_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  update public.timesheets
     set status='approved', decided_at=now(), decided_by=v_actor, locked=true, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'approve', p_comment);
end$$;

grant execute on function public.approve_timesheet(uuid, text) to authenticated;
