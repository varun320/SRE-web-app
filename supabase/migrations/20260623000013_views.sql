-- Per-timesheet totals: total hrs, OT earned, TIL used, vacation used.
create or replace view public.v_timesheet_totals as
with daily as (
  select t.id as timesheet_id, t.user_id, t.week_start,
    sum(e.mon_hrs) as mon, sum(e.tue_hrs) as tue, sum(e.wed_hrs) as wed,
    sum(e.thu_hrs) as thu, sum(e.fri_hrs) as fri, sum(e.sat_hrs) as sat, sum(e.sun_hrs) as sun,
    sum(case when sc.name = 'TIL Payout' then 0 else e.mon_hrs end) as mon_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.tue_hrs end) as tue_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.wed_hrs end) as wed_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.thu_hrs end) as thu_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.fri_hrs end) as fri_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.sat_hrs end) as sat_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.sun_hrs end) as sun_ot_base,
    coalesce(sum(case when sc.consumes_til then e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs else 0 end), 0) as til_used,
    coalesce(sum(case when sc.consumes_vacation then e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs else 0 end), 0) as vacation_used
  from public.timesheets t
  left join public.timesheet_entries e on e.timesheet_id = t.id
  left join public.sub_categories sc on sc.id = e.sub_category_id
  group by t.id, t.user_id, t.week_start
)
select timesheet_id, user_id, week_start,
  coalesce(mon,0)+coalesce(tue,0)+coalesce(wed,0)+coalesce(thu,0)+coalesce(fri,0)+coalesce(sat,0)+coalesce(sun,0) as total_hrs,
  greatest(coalesce(mon_ot_base,0)-8,0) + greatest(coalesce(tue_ot_base,0)-8,0)
    + greatest(coalesce(wed_ot_base,0)-8,0) + greatest(coalesce(thu_ot_base,0)-8,0)
    + greatest(coalesce(fri_ot_base,0)-8,0) + greatest(coalesce(sat_ot_base,0)-8,0)
    + greatest(coalesce(sun_ot_base,0)-8,0) as overtime_earned,
  til_used,
  vacation_used
from daily;

create or replace view public.v_weekly_report as
select t.id as timesheet_id, t.user_id, t.week_start,
  e.main_category, sc.name as sub_category,
  p.project_number,
  e.description,
  e.mon_hrs, e.tue_hrs, e.wed_hrs, e.thu_hrs, e.fri_hrs, e.sat_hrs, e.sun_hrs,
  e.row_total
from public.timesheets t
join public.timesheet_entries e on e.timesheet_id = t.id
join public.sub_categories sc on sc.id = e.sub_category_id
left join public.projects p on p.id = e.project_id;

create or replace view public.v_til_balance as
select distinct on (user_id) user_id, week_start, closing_balance
from public.til_ledger
where not stale
order by user_id, week_start desc;

create or replace view public.v_vacation_balance as
select distinct on (user_id) user_id, week_start, closing_balance
from public.vacation_ledger
where not stale
order by user_id, week_start desc;

grant select on public.v_timesheet_totals, public.v_weekly_report,
                public.v_til_balance, public.v_vacation_balance
  to authenticated;
