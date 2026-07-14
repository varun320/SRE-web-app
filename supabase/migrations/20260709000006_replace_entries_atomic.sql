-- Atomic replace of a timesheet's entries. Previously the client issued a
-- DELETE followed by an INSERT via the Supabase JS client — two separate
-- HTTP calls, not a transaction. If the INSERT failed (check constraint,
-- validate_entry trigger, network flake) after a successful DELETE, the
-- user's previously-saved rows were gone from the DB until the next
-- successful save. This RPC wraps both steps in a single transaction.
--
-- Payload shape: jsonb array of row objects. Positions are assigned by
-- the caller (0..n-1) and preserved.

create or replace function public.replace_timesheet_entries(
  p_timesheet_id uuid,
  p_entries jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  v_ts_user uuid;
begin
  -- Guard: the RLS policy on timesheets already restricts SELECT to the
  -- owner + admins, but be explicit — if the caller can't see the sheet
  -- they can't mutate its entries.
  select user_id into v_ts_user
  from public.timesheets
  where id = p_timesheet_id;
  if not found then
    raise exception 'timesheet % not found', p_timesheet_id using errcode='42P01';
  end if;

  delete from public.timesheet_entries where timesheet_id = p_timesheet_id;

  if p_entries is null or jsonb_array_length(p_entries) = 0 then
    return;
  end if;

  insert into public.timesheet_entries (
    timesheet_id, main_category, sub_category_id, project_id,
    mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs,
    description, position
  )
  select
    p_timesheet_id,
    (e->>'main_category')::public.main_category,
    (e->>'sub_category_id')::uuid,
    nullif(e->>'project_id','')::uuid,
    coalesce((e->>'mon_hrs')::numeric, 0),
    coalesce((e->>'tue_hrs')::numeric, 0),
    coalesce((e->>'wed_hrs')::numeric, 0),
    coalesce((e->>'thu_hrs')::numeric, 0),
    coalesce((e->>'fri_hrs')::numeric, 0),
    coalesce((e->>'sat_hrs')::numeric, 0),
    coalesce((e->>'sun_hrs')::numeric, 0),
    e->>'description',
    coalesce((e->>'position')::int, 0)
  from jsonb_array_elements(p_entries) with ordinality as t(e, ord);
end
$$;

grant execute on function public.replace_timesheet_entries(uuid, jsonb) to authenticated;
