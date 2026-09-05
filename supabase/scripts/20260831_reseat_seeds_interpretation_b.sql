-- One-shot production data fix — reseat pre-system TIL/vacation seeds and
-- rechain historical opening_balance so accruals stack on top of the seed
-- (Interpretation B: seed = pre-system carry-in, not a mid-chain reset).
--
-- Affected employees:
--   EMP-005 Dharmesh Patel   (8dbe2b6b-57cd-43ed-ad60-44b7c93b2274)
--   EMP-006 Kunal Rajput     (c65da70c-245c-4aea-8540-bf417a9ebe9c)
--   EMP-013 Kurtis Marshall  (2a26a238-a72f-45c1-8845-8bd7aa624cc0)
--
-- What this touches:
--   - opening_balance on approved ledger rows (closing_balance follows,
--     generated column)
--   - seed rows relocated from 2026-05-31 -> 2026-04-05 (Sunday, unreachable
--     by any approve_timesheet since timesheets.week_start CHECK dow=1)
--
-- What this does NOT touch:
--   - timesheets, timesheet_entries, approval_log
--   - overtime_earned / til_used / vacation_used (frozen history preserved)
--   - other users' ledgers

begin;

-- New seeds at pre-onboarding Sunday.
insert into public.til_ledger
  (user_id, week_start, opening_balance, overtime_earned, til_used, frozen, stale, approved_by)
values
  ('8dbe2b6b-57cd-43ed-ad60-44b7c93b2274','2026-04-05',1021.00,0,0,true,false,
   (select approved_by from public.til_ledger where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-05-31'));

insert into public.vacation_ledger
  (user_id, week_start, opening_balance, vacation_used, frozen, stale, approved_by)
values
  ('8dbe2b6b-57cd-43ed-ad60-44b7c93b2274','2026-04-05',200.00,0,true,false,
   (select approved_by from public.vacation_ledger where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-05-31'));

insert into public.til_ledger
  (user_id, week_start, opening_balance, overtime_earned, til_used, frozen, stale, approved_by)
values
  ('c65da70c-245c-4aea-8540-bf417a9ebe9c','2026-04-05',372.00,0,0,true,false,
   (select approved_by from public.til_ledger where user_id='c65da70c-245c-4aea-8540-bf417a9ebe9c' and week_start='2026-05-31'));

insert into public.til_ledger
  (user_id, week_start, opening_balance, overtime_earned, til_used, frozen, stale, approved_by)
values
  ('2a26a238-a72f-45c1-8845-8bd7aa624cc0','2026-04-05',133.00,0,0,true,false,
   (select approved_by from public.til_ledger where user_id='2a26a238-a72f-45c1-8845-8bd7aa624cc0' and week_start='2026-05-31'));

insert into public.vacation_ledger
  (user_id, week_start, opening_balance, vacation_used, frozen, stale, approved_by)
values
  ('2a26a238-a72f-45c1-8845-8bd7aa624cc0','2026-04-05',72.00,0,true,false,
   (select approved_by from public.vacation_ledger where user_id='2a26a238-a72f-45c1-8845-8bd7aa624cc0' and week_start='2026-05-31'));

-- Remove obsolete 2026-05-31 seeds.
delete from public.til_ledger
 where week_start='2026-05-31'
   and user_id in ('8dbe2b6b-57cd-43ed-ad60-44b7c93b2274',
                   'c65da70c-245c-4aea-8540-bf417a9ebe9c',
                   '2a26a238-a72f-45c1-8845-8bd7aa624cc0');

delete from public.vacation_ledger
 where week_start='2026-05-31'
   and user_id in ('8dbe2b6b-57cd-43ed-ad60-44b7c93b2274',
                   '2a26a238-a72f-45c1-8845-8bd7aa624cc0');

-- Dharmesh TIL rechain (openings; closings auto-follow).
update public.til_ledger set opening_balance=1021.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-04-06';
update public.til_ledger set opening_balance=1061.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-04-13';
update public.til_ledger set opening_balance=1073.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-04-20';
update public.til_ledger set opening_balance=1073.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-04-27';
update public.til_ledger set opening_balance=1097.50 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-05-04';
update public.til_ledger set opening_balance=1113.50 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-05-11';
update public.til_ledger set opening_balance=1113.50 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-05-18';
update public.til_ledger set opening_balance=1113.50 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-06-01';
update public.til_ledger set opening_balance=1130.50 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start in ('2026-08-03','2026-08-10','2026-08-17');

-- Dharmesh vacation rechain.
update public.vacation_ledger set opening_balance=200.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274'
  and week_start in ('2026-04-06','2026-04-13','2026-04-20','2026-04-27','2026-05-04','2026-05-11','2026-05-18','2026-06-01','2026-08-03');
update public.vacation_ledger set opening_balance=168.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-08-10';
update public.vacation_ledger set opening_balance=128.00 where user_id='8dbe2b6b-57cd-43ed-ad60-44b7c93b2274' and week_start='2026-08-17';

commit;
