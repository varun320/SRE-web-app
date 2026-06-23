begin;
\ir helpers.psql
select plan(6);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm   \gset

select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as tid \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'tid', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 10, 8, 8, 'work');
select public.submit_timesheet(:'tid');

select throws_like(
  format($$ select public.approve_timesheet(%L) $$, :'tid'),
  '%admin only%',
  'employee cannot approve'
);

select test_helpers.set_auth(:'adm'::uuid);
select lives_ok(
  format($$ select public.approve_timesheet(%L, 'looks good') $$, :'tid'),
  'admin approves'
);

select is(
  (select status::text from public.timesheets where id = :'tid'),
  'approved',
  'status is approved'
);
select is(
  (select locked from public.timesheets where id = :'tid'),
  true,
  'timesheet is locked'
);

select is(
  (select overtime_earned from public.til_ledger where week_start = date '2026-04-06')::numeric,
  6::numeric,
  'TIL ledger overtime computed'
);

select is(
  (select count(*) from public.approval_log where timesheet_id = :'tid'),
  2::bigint,
  'approval_log has submit + approve'
);

select * from finish();
rollback;
