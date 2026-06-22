-- Plan 4 / Task 1 step 3 — transactional import applier.
--
-- The Python CLI / web route handler inserts the import_batches row with
-- plan_payload + summary first, then calls apply_import_batch(batch_id).
-- The RPC reads the payload, writes ledger / timesheet rows in one transaction,
-- and marks the batch committed. Re-calling with an already-committed batch
-- returns the prior summary without re-applying.

create or replace function public.apply_import_batch(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_batch    public.import_batches;
  v_row      jsonb;
  v_entry    jsonb;
  v_ts_id    uuid;
  v_applied  int := 0;
  v_skipped  int := 0;
  v_existing uuid;
  v_inserted int;
begin
  if not public.is_admin(v_actor) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch % not found', p_batch_id using errcode = '22023';
  end if;

  -- Already committed → return prior result (idempotent commit).
  if v_batch.committed_at is not null then
    return jsonb_build_object(
      'applied', v_batch.applied_count,
      'skipped', v_batch.skipped_count,
      'committed_at', v_batch.committed_at,
      'replayed', false
    );
  end if;

  -- Allow direct status='approved' inserts on timesheets (the guard only
  -- fires on UPDATE, but be explicit so future guard changes don't break us).
  perform set_config('app.allow_status_change', 'on', true);

  if v_batch.mode = 'balances' then
    ----------------------------------------------------------------------
    -- Balances payload:
    --   { "rows": [ { user_id, as_of_date, til_opening, vacation_opening } ] }
    -- Creates one frozen synthetic ledger row per user at as_of_date - 7d
    -- so the first real submitted week carries forward correctly.
    ----------------------------------------------------------------------
    for v_row in select value from jsonb_array_elements(v_batch.plan_payload -> 'rows') loop
      -- TIL opening
      insert into public.til_ledger(
        user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        ((v_row ->> 'as_of_date')::date - interval '7 days')::date,
        (v_row ->> 'til_opening')::numeric,
        0,
        0,
        true,
        v_batch.imported_by
      )
      on conflict (user_id, week_start) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then v_applied := v_applied + 1; else v_skipped := v_skipped + 1; end if;

      -- Vacation opening
      insert into public.vacation_ledger(
        user_id, week_start, opening_balance, vacation_used, frozen, approved_by
      )
      values (
        (v_row ->> 'user_id')::uuid,
        ((v_row ->> 'as_of_date')::date - interval '7 days')::date,
        (v_row ->> 'vacation_opening')::numeric,
        0,
        true,
        v_batch.imported_by
      )
      on conflict (user_id, week_start) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then v_applied := v_applied + 1; else v_skipped := v_skipped + 1; end if;
    end loop;

  elsif v_batch.mode = 'history' then
    ----------------------------------------------------------------------
    -- History payload:
    --   { "weeks": [ {
    --       user_id, week_start, opening_til, opening_vacation,
    --       til_earned, til_used, vacation_used,
    --       entries: [ { main_category, sub_category_id, project_id,
    --                    mon_hrs..sun_hrs, description, position } ]
    --   } ] }
    -- One transaction; per-week idempotency via (user_id, week_start).
    ----------------------------------------------------------------------
    for v_row in
      select value from jsonb_array_elements(v_batch.plan_payload -> 'weeks')
      order by (value ->> 'week_start')::date
    loop
      -- Skip if this week is already on file (any status) — conflicts surface in dry-run.
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

      -- Entries
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

      -- TIL ledger row (frozen, since this week is imported as approved).
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

      -- Vacation ledger row.
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

grant execute on function public.apply_import_batch(uuid) to authenticated;
