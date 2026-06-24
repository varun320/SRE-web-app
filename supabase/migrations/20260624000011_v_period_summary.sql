-- Plan 5 / Task 1 — one denormalized view that every report reads.
--
-- v_period_summary returns one row per approved timesheet enriched with:
--   * employee identity (code, name, department) — saves a join in every report
--   * per-week totals from v_timesheet_totals
--   * a derived `regular_hrs` = total − OT − til_payout, so payroll can pull
--     the "hours actually worked at base rate" without re-doing the math
--   * `til_payout_hrs` broken out so payroll knows what to cash out
--
-- RLS is inherited from the underlying tables (admins see all, employees see
-- their own approved weeks). No explicit policies needed on the view.

create or replace view public.v_period_summary as
with til_payout as (
  select
    e.timesheet_id,
    sum(coalesce(e.mon_hrs,0) + coalesce(e.tue_hrs,0) + coalesce(e.wed_hrs,0)
      + coalesce(e.thu_hrs,0) + coalesce(e.fri_hrs,0) + coalesce(e.sat_hrs,0)
      + coalesce(e.sun_hrs,0)) as hrs
  from public.timesheet_entries e
  join public.sub_categories sc on sc.id = e.sub_category_id
  where sc.name = 'TIL Payout'
  group by e.timesheet_id
)
select
  t.id                                              as timesheet_id,
  t.user_id,
  u.org_id,
  u.employee_code,
  u.full_name,
  u.department,
  t.week_start,
  t.status,
  t.submitted_at,
  t.decided_at,
  t.decided_by,
  coalesce(vtt.total_hrs, 0)        as total_hrs,
  coalesce(vtt.overtime_earned, 0)  as overtime_earned,
  coalesce(vtt.til_used, 0)         as til_used,
  coalesce(vtt.vacation_used, 0)    as vacation_used,
  coalesce(payout.hrs, 0)           as til_payout_hrs,
  greatest(
    coalesce(vtt.total_hrs, 0)
      - coalesce(vtt.overtime_earned, 0)
      - coalesce(payout.hrs, 0),
    0
  )                                  as regular_hrs
from public.timesheets t
join public.users u                   on u.id = t.user_id
left join public.v_timesheet_totals vtt on vtt.timesheet_id = t.id
left join til_payout payout           on payout.timesheet_id = t.id
where t.status = 'approved';

grant select on public.v_period_summary to authenticated;

-- Make range scans by week_start cheap. Filtered partial index is enough for
-- the reporting workload (everything in the view is status='approved').
create index if not exists idx_timesheets_approved_week
  on public.timesheets(week_start)
  where status = 'approved';
