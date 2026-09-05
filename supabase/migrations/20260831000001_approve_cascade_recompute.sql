-- Fix: TIL/vacation balances stopped updating after admin approvals.
--
-- 20260624000010_admin_freedom.sql replaced approve_timesheet() but dropped
-- the recompute_cascade() call that 20260623000018_rpc_unlock.sql had added.
--
-- Repro: admin declines an already-approved week -> decline_timesheet marks
-- every til_ledger / vacation_ledger row at week_start >= that week as
-- stale=true. Employee resubmits, admin re-approves -> only the target
-- week's ledger row flips back to stale=false. Every subsequent approved
-- week stays stale, so /me/til (filters !stale) and admin Balances
-- (filters stale=false, picks latest) both show the wrong balance.
--
-- Fix: after writing the current week's ledger row, if any downstream row
-- for this user is still stale, re-run recompute_cascade from this week.
-- Same logic as the original v_was_unlocked branch, generalized to catch
-- the decline-approved -> re-approve path too.

create or replace function public.approve_timesheet(p_timesheet_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_tot   record;
  v_open_til  numeric; v_open_vac numeric;
  v_has_stale_downstream boolean;
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

  -- Cascade whenever any later approved week exists, not only when the
  -- downstream row is stale. Out-of-order approvals (admin approves an
  -- older backlog week after newer weeks were already approved) leave the
  -- downstream openings frozen at a wrong prior — the row isn't stale so
  -- the old stale-only check missed it. recompute_cascade is an idempotent
  -- upsert; refreshing non-stale downstream rows just rechains them.
  select exists(
    select 1 from public.timesheets
     where user_id = v_ts.user_id
       and status = 'approved'
       and week_start > v_ts.week_start
  ) into v_has_stale_downstream;

  if v_has_stale_downstream then
    perform public.recompute_cascade(v_ts.user_id, v_ts.week_start);
  end if;
end$$;

-- Auto-heal existing stale rows for currently-approved weeks.
--
-- recompute_cascade re-derives earned/used from live v_timesheet_totals,
-- so a taxonomy change since the original approval would silently overwrite
-- frozen history. We avoid that: keep the row's stored earned/used exactly
-- as they were frozen, only refresh opening_balance so the carry-forward
-- chain reconnects, then flip stale=false. closing_balance is a generated
-- column, so it recomputes automatically from the preserved earned/used
-- plus the refreshed opening.
--
-- Only heals ledger rows attached to a currently-approved timesheet. Rows
-- attached to declined/draft weeks stay stale (correct — those weeks are
-- not real balance movements).

do $$
declare
  r record;
  v_prior numeric;
begin
  for r in
    select l.user_id, l.week_start
      from public.til_ledger l
      join public.timesheets t
        on t.user_id = l.user_id and t.week_start = l.week_start
     where l.stale and t.status = 'approved'
     order by l.user_id, l.week_start
  loop
    v_prior := public.prior_til_balance(r.user_id, r.week_start);
    update public.til_ledger
       set opening_balance = v_prior,
           stale           = false
     where user_id = r.user_id and week_start = r.week_start;
  end loop;

  for r in
    select l.user_id, l.week_start
      from public.vacation_ledger l
      join public.timesheets t
        on t.user_id = l.user_id and t.week_start = l.week_start
     where l.stale and t.status = 'approved'
     order by l.user_id, l.week_start
  loop
    v_prior := public.prior_vacation_balance(r.user_id, r.week_start);
    update public.vacation_ledger
       set opening_balance = v_prior,
           stale           = false
     where user_id = r.user_id and week_start = r.week_start;
  end loop;
end$$;
