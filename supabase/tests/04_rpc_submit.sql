begin;
\i helpers.sql
select plan(4);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset

select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as tid \gset

select throws_like(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  '%no entries%',
  'submit blocked on empty timesheet'
);

insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, description)
values (:'tid', 'Admin', test_helpers.sub_id('Sick Time'), 8, 'flu');

select lives_ok(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  'submit succeeds with one entry'
);

select is(
  (select status::text from public.timesheets where id = :'tid'),
  'submitted',
  'status is submitted'
);

select throws_like(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  '%cannot submit from status%',
  'cannot submit twice'
);

select * from finish();
rollback;
