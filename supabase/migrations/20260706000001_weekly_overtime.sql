-- Fix overtime calculation: weekly threshold, not daily.
--
-- Per Utsav's 2026-07-06 comments:
--   * A standard workweek is 40 hours (Mon–Fri, 8h/day).
--   * Overtime accrues only AFTER an employee has logged 40 base hours
--     across the entire week (Mon–Sun combined).
--   * Weekend hours (Sat/Sun) are not automatically overtime — they only
--     count once the 40-hour threshold has been crossed.
--   * TIL Payout does not contribute to the base.
--
-- The previous rule counted anything above 8 hrs/day as overtime, which
-- incorrectly penalized front-loaded weeks (e.g. a 20h Monday for a
-- 20h workweek reported 12h of OT).

create or replace view public.v_timesheet_totals as
with per_ts as (
  select
    t.id                                            as timesheet_id,
    t.user_id,
    t.week_start,
    coalesce(sum(e.mon_hrs + e.tue_hrs + e.wed_hrs
               + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs), 0) as total_hrs,
    coalesce(sum(case
      when sc.name = 'TIL Payout' then 0
      else (e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs
          + e.fri_hrs + e.sat_hrs + e.sun_hrs)
    end), 0) as base_hrs,
    coalesce(sum(case
      when sc.consumes_til then (e.mon_hrs + e.tue_hrs + e.wed_hrs
        + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs)
      else 0
    end), 0) as til_used,
    coalesce(sum(case
      when sc.consumes_vacation then (e.mon_hrs + e.tue_hrs + e.wed_hrs
        + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs)
      else 0
    end), 0) as vacation_used
  from public.timesheets t
  left join public.timesheet_entries e on e.timesheet_id = t.id
  left join public.sub_categories sc on sc.id = e.sub_category_id
  group by t.id, t.user_id, t.week_start
)
select
  timesheet_id,
  user_id,
  week_start,
  total_hrs,
  greatest(base_hrs - 40, 0) as overtime_earned,
  til_used,
  vacation_used
from per_ts;

grant select on public.v_timesheet_totals to authenticated;
