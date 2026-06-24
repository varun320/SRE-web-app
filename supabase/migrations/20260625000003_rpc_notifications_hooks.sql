-- Plan 6 / Task 2 — wire notifications into every status-changing RPC.
--
-- Each RPC is re-created end-to-end (CREATE OR REPLACE) so the notification
-- insert lives inside the same transaction as the state change. If the RPC
-- rolls back, the notification rolls back with it.
--
-- Payload conventions:
--   week_start      → ISO date of the timesheet
--   employee_name   → human-readable, saves a join when rendering
--   actor_name      → human-readable for the actor (admin who approved, etc.)
--   reason          → decline / unlock / force-submit reason text (when applicable)

----------------------------------------------------------------------
-- submit_timesheet: notify every active admin in the org
----------------------------------------------------------------------
create or replace function public.submit_timesheet(p_timesheet_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ts   record;
  v_bad  int;
  v_org  uuid;
  v_name text;
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

  -- Notify all org admins.
  select u.org_id, u.full_name into v_org, v_name
    from public.users u where u.id = v_user;
  perform public.notify_users(
    public.admin_ids_for_org(v_org),
    v_org,
    'timesheet_submitted',
    p_timesheet_id,
    v_user,
    jsonb_build_object(
      'week_start',    v_ts.week_start,
      'employee_name', v_name
    )
  );
end$$;

----------------------------------------------------------------------
-- approve_timesheet: notify the employee (skip if admin == employee)
----------------------------------------------------------------------
create or replace function public.approve_timesheet(p_timesheet_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_tot   record;
  v_open_til  numeric; v_open_vac numeric;
  v_actor_name text;
  v_org uuid;
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

  select full_name into v_actor_name from public.users where id = v_actor;
  select org_id    into v_org        from public.users where id = v_ts.user_id;
  perform public.notify_users(
    array[v_ts.user_id], v_org, 'timesheet_approved', p_timesheet_id, v_actor,
    jsonb_build_object('week_start', v_ts.week_start, 'actor_name', v_actor_name)
  );
end$$;

----------------------------------------------------------------------
-- decline_timesheet: notify the employee with the reason
----------------------------------------------------------------------
create or replace function public.decline_timesheet(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_actor_name text;
  v_org uuid;
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

  select full_name into v_actor_name from public.users where id = v_actor;
  select org_id    into v_org        from public.users where id = v_ts.user_id;
  perform public.notify_users(
    array[v_ts.user_id], v_org, 'timesheet_declined', p_timesheet_id, v_actor,
    jsonb_build_object('week_start', v_ts.week_start, 'actor_name', v_actor_name, 'reason', p_reason)
  );
end$$;

----------------------------------------------------------------------
-- unlock_timesheet: notify the employee
----------------------------------------------------------------------
create or replace function public.unlock_timesheet(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_actor_name text;
  v_org uuid;
begin
  perform set_config('app.allow_status_change', 'on', true);

  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unlock reason required' using errcode='22023';
  end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'approved' then
    raise exception 'can only unlock approved timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  update public.til_ledger      set stale = true
   where user_id = v_ts.user_id and week_start >= v_ts.week_start;
  update public.vacation_ledger set stale = true
   where user_id = v_ts.user_id and week_start >= v_ts.week_start;

  update public.timesheets
     set status='declined', locked=false, decided_at=now(), decided_by=v_actor,
         decline_reason='[unlocked] ' || p_reason, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'unlock', p_reason);

  select full_name into v_actor_name from public.users where id = v_actor;
  select org_id    into v_org        from public.users where id = v_ts.user_id;
  perform public.notify_users(
    array[v_ts.user_id], v_org, 'timesheet_unlocked', p_timesheet_id, v_actor,
    jsonb_build_object('week_start', v_ts.week_start, 'actor_name', v_actor_name, 'reason', p_reason)
  );
end$$;

----------------------------------------------------------------------
-- admin_force_submit: notify the employee that their week was submitted
----------------------------------------------------------------------
create or replace function public.admin_force_submit(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_actor_name text;
  v_org uuid;
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

  select full_name into v_actor_name from public.users where id = v_actor;
  select org_id    into v_org        from public.users where id = v_ts.user_id;
  perform public.notify_users(
    array[v_ts.user_id], v_org, 'timesheet_force_submitted', p_timesheet_id, v_actor,
    jsonb_build_object('week_start', v_ts.week_start, 'actor_name', v_actor_name, 'reason', p_reason)
  );
end$$;
