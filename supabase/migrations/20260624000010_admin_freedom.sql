-- Plan-5 prep: give admin maximum freedom over the timesheet FSM.
--
-- Original RPCs were strict (approve only from submitted; decline only from
-- submitted). That mirrors the employee-driven workflow. For admin overrides
-- (fix a draft for an employee out sick, decline an approved week without
-- triggering the ledger-stale cascade, etc.) we relax the gates when the
-- caller is an admin. Non-admins continue to hit the strict checks because
-- those RPCs were already admin-only via is_admin().
--
-- New: admin_force_submit() — admin can move a draft straight to submitted on
-- the employee's behalf (e.g. employee is on PTO, deadline today).

----------------------------------------------------------------------
-- approve_timesheet: allow from any state except 'approved'.
----------------------------------------------------------------------
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
  if v_ts.status = 'approved' then
    raise exception 'timesheet is already approved' using errcode='22023';
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
     set status='approved',
         submitted_at = coalesce(submitted_at, now()),
         decided_at = now(),
         decided_by = v_actor,
         locked = true,
         updated_at = now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'approve', p_comment);
end$$;

----------------------------------------------------------------------
-- decline_timesheet: allow from any non-declined state. If declining an
-- already-approved week, also mark downstream ledgers stale (same cascade
-- as unlock) so the carry-forward stays correct.
----------------------------------------------------------------------
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
  if v_ts.status = 'declined' then
    raise exception 'timesheet is already declined' using errcode='22023';
  end if;

  -- If we're rolling back an approved week, invalidate the cascade.
  if v_ts.status = 'approved' then
    update public.til_ledger      set stale = true
     where user_id = v_ts.user_id and week_start >= v_ts.week_start;
    update public.vacation_ledger set stale = true
     where user_id = v_ts.user_id and week_start >= v_ts.week_start;
  end if;

  update public.timesheets
     set status = 'declined',
         locked = false,
         decided_at = now(),
         decided_by = v_actor,
         decline_reason = p_reason,
         updated_at = now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'decline', p_reason);
end$$;

----------------------------------------------------------------------
-- admin_force_submit: admin pushes a draft into 'submitted' on the
-- employee's behalf. Use for unblocking missed deadlines.
----------------------------------------------------------------------
create or replace function public.admin_force_submit(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
begin
  perform set_config('app.allow_status_change', 'on', true);

  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'draft' and v_ts.status <> 'declined' then
    raise exception 'force-submit requires draft or declined (current: %)', v_ts.status using errcode='22023';
  end if;

  update public.timesheets
     set status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'submit', '[admin] ' || coalesce(p_reason, ''));
end$$;

grant execute on function public.admin_force_submit(uuid, text) to authenticated;
