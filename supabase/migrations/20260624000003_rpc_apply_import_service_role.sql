-- Plan 4 follow-up: the apply_import_batch RPC is always called by the CLI or
-- a Next.js route handler holding the service-role key. The original
-- is_admin(auth.uid()) check inside the function blocks service-role callers
-- (auth.uid() is null), and granting execute to `authenticated` would let any
-- logged-in user commit somebody else's pending batch. Restrict execution to
-- service_role; admin validation now lives in the route handler.

revoke execute on function public.apply_import_batch(uuid) from authenticated;

create or replace function public.apply_import_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch    public.import_batches;
  v_row      jsonb;
  v_entry    jsonb;
  v_ts_id    uuid;
  v_applied  int := 0;
  v_skipped  int := 0;
  v_existing uuid;
  v_inserted int;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch % not found', p_batch_id using errcode = '22023';
  end if;

  if v_batch.committed_at is not null then
    return jsonb_build_object(
      'applied', v_batch.applied_count,
      'skipped', v_batch.skipped_count,
      'committed_at', v_batch.committed_at,
      'replayed', false
    );
  end if;

  perform set_config('app.allow_status_change', 'on', true);

  if v_batch.mode = 'balances' then
    for v_row in select value from jsonb_array_elements(v_batch.plan_payload -> 'rows') loop
      insert into public.til_ledger(
        user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        ((v_row ->> 'as_of_date')::date - interval '7 days')::date,
        (v_row ->> 'til_opening')::numeric,
        0, 0, true, v_batch.imported_by
      )
      on conflict (user_id, week_start) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then v_applied := v_applied + 1; else v_skipped := v_skipped + 1; end if;

      insert into public.vacation_ledger(
        user_id, week_start, opening_balance, vacation_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        ((v_row ->> 'as_of_date')::date - interval '7 days')::date,
        (v_row ->> 'vacation_opening')::numeric,
        0, true, v_batch.imported_by
      )
      on conflict (user_id, week_start) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then v_applied := v_applied + 1; else v_skipped := v_skipped + 1; end if;
    end loop;

  elsif v_batch.mode = 'history' then
    for v_row in
      select value from jsonb_array_elements(v_batch.plan_payload -> 'weeks')
      order by (value ->> 'week_start')::date
    loop
      select id into v_existing
      from public.timesheets
      where user_id   = (v_row ->> 'user_id')::uuid
        and week_start = (v_row ->> 'week_start')::date;

      if v_existing is not null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.timesheets(
        user_id, org_id, week_start, status, submitted_at, decided_at, decided_by, locked
      )
      select
        (v_row ->> 'user_id')::uuid,
        u.org_id,
        (v_row ->> 'week_start')::date,
        'approved',
        now(),
        now(),
        v_batch.imported_by,
        true
      from public.users u
      where u.id = (v_row ->> 'user_id')::uuid
      returning id into v_ts_id;

      for v_entry in select value from jsonb_array_elements(v_row -> 'entries') loop
        insert into public.timesheet_entries(
          timesheet_id, main_category, sub_category_id, project_id,
          mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs,
          description, position
        )
        values (
          v_ts_id,
          (v_entry ->> 'main_category')::public.main_category,
          (v_entry ->> 'sub_category_id')::uuid,
          nullif(v_entry ->> 'project_id', '')::uuid,
          coalesce((v_entry ->> 'mon_hrs')::numeric, 0),
          coalesce((v_entry ->> 'tue_hrs')::numeric, 0),
          coalesce((v_entry ->> 'wed_hrs')::numeric, 0),
          coalesce((v_entry ->> 'thu_hrs')::numeric, 0),
          coalesce((v_entry ->> 'fri_hrs')::numeric, 0),
          coalesce((v_entry ->> 'sat_hrs')::numeric, 0),
          coalesce((v_entry ->> 'sun_hrs')::numeric, 0),
          v_entry ->> 'description',
          coalesce((v_entry ->> 'position')::int, 0)
        );
      end loop;

      insert into public.til_ledger(
        user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        (v_row ->> 'week_start')::date,
        coalesce((v_row ->> 'opening_til')::numeric, 0),
        coalesce((v_row ->> 'til_earned')::numeric, 0),
        coalesce((v_row ->> 'til_used')::numeric, 0),
        true,
        v_batch.imported_by
      )
      on conflict (user_id, week_start) do update
        set opening_balance = excluded.opening_balance,
            overtime_earned = excluded.overtime_earned,
            til_used        = excluded.til_used,
            frozen          = true,
            stale           = false,
            approved_by     = excluded.approved_by;

      insert into public.vacation_ledger(
        user_id, week_start, opening_balance, vacation_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        (v_row ->> 'week_start')::date,
        coalesce((v_row ->> 'opening_vacation')::numeric, 0),
        coalesce((v_row ->> 'vacation_used')::numeric, 0),
        true,
        v_batch.imported_by
      )
      on conflict (user_id, week_start) do update
        set opening_balance = excluded.opening_balance,
            vacation_used   = excluded.vacation_used,
            frozen          = true,
            stale           = false,
            approved_by     = excluded.approved_by;

      insert into public.approval_log(timesheet_id, actor_id, action, comment)
      values (v_ts_id, v_batch.imported_by, 'imported',
              format('batch %s', v_batch.id));

      v_applied := v_applied + 1;
    end loop;

  else
    raise exception 'unsupported import mode: %', v_batch.mode using errcode = '22023';
  end if;

  update public.import_batches
     set committed_at  = now(),
         applied_count = v_applied,
         skipped_count = v_skipped
   where id = p_batch_id;

  return jsonb_build_object(
    'applied', v_applied,
    'skipped', v_skipped,
    'committed_at', now(),
    'replayed', false
  );
end$$;

-- service_role bypasses RLS and has implicit execute on SECURITY DEFINER
-- functions in `public`; no grant needed. The previous explicit grant to
-- `authenticated` is revoked above.
