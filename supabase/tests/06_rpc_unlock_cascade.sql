begin;
\i helpers.sql
select plan(4);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm   \gset

-- Week 1: 6h OT (Mon 10, Tue 10, Wed 10, Thu 8, Fri 8 → OT = 2+2+2 = 6)
select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as t1 \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'t1', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 10, 8, 8, 'wk1');
select public.submit_timesheet(:'t1');

-- Week 2: 4h OT (Mon 10, Tue 10, Wed 8, Thu 8, Fri 8 → OT = 2+2 = 4)
select public.create_or_get_week(date '2026-04-13') as t2 \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'t2', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 8, 8, 8, 'wk2');
select public.submit_timesheet(:'t2');

select test_helpers.set_auth(:'adm'::uuid);
select public.approve_timesheet(:'t1');
select public.approve_timesheet(:'t2');

-- Week 2 closing = 6 (wk1) + 4 (wk2) = 10
select is(
  (select closing_balance from public.til_ledger where user_id = :'alice'::uuid and week_start = date '2026-04-13' and not stale)::numeric,
  10::numeric,
  'wk2 closing reflects wk1 carry-forward'
);

select public.unlock_timesheet(:'t1', 'fix typo');

select is(
  (select status::text from public.timesheets where id = :'t1'),
  'declined',
  'unlocked week reverts to declined'
);
select is(
  (select count(*) from public.til_ledger
    where user_id = :'alice'::uuid and stale
      and week_start in (date '2026-04-06', date '2026-04-13')),
  2::bigint,
  'both ledger rows marked stale by unlock'
);

-- Alice fixes wk1 (add 2 more OT hrs → wk1 OT = 8) and resubmits
select test_helpers.set_auth(:'alice'::uuid);
update public.timesheet_entries set mon_hrs = 12 where timesheet_id = :'t1';
select public.submit_timesheet(:'t1');
select test_helpers.set_auth(:'adm'::uuid);
select public.approve_timesheet(:'t1');

-- After cascade: wk1 OT now 8 → wk2 closing = 8 + 4 = 12
select is(
  (select closing_balance from public.til_ledger where user_id = :'alice'::uuid and week_start = date '2026-04-13' and not stale)::numeric,
  12::numeric,
  'cascade recomputed wk2 closing'
);

select * from finish();
rollback;
