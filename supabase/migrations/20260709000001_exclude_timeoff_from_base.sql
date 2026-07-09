-- Exclude time-off rows from base_hrs.
--
-- Per Utsav's 2026-07-08 feedback: taking TIL as time off (Admin > Overtime
-- Taken, which sets consumes_til) was still counting toward base_hrs, so a
-- 40h Mon–Fri week with an 8h TIL Overtime Taken row inflated base to 48 and
-- produced spurious "8h overtime earned" while also deducting 8h from the
-- TIL bank. Time-off should not generate new overtime.
--
-- Fix: exclude any row whose sub_category consumes_til or consumes_vacation
-- from base_hrs. total_hrs, til_used, and vacation_used are unchanged.

create or replace view public.v_timesheet_totals as
with per_ts as (
  select
    t.id                                            as timesheet_id,
    t.user_id,
    t.week_start,
    coalesce(sum(e.mon_hrs + e.tue_hrs + e.wed_hrs
               + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs), 0) as total_hrs,
    coalesce(sum(case
      when sc.consumes_til or sc.consumes_vacation then 0
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
