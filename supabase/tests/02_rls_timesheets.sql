begin;
\ir helpers.psql
select plan(5);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('bob@x','employee','Bob','E002')     as bob \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm \gset

-- Alice creates her week
select test_helpers.set_auth(:'alice'::uuid);
select lives_ok(
  $$ select public.create_or_get_week(date '2026-04-06'); $$,
  'alice can create her week'
);

-- Bob cannot see Alice's timesheet
select test_helpers.set_auth(:'bob'::uuid);
select is(
  (select count(*) from public.timesheets where user_id = :'alice'::uuid),
  0::bigint,
  'bob cannot see alice timesheets'
);

-- Bob cannot insert a timesheet for Alice
select throws_ok(
  format($$ insert into public.timesheets(user_id, org_id, week_start)
            values (%L, '00000000-0000-0000-0000-000000000001', date '2026-04-06') $$, :'alice'),
  'new row violates row-level security policy for table "timesheets"',
  'bob cannot insert timesheet for alice'
);

-- Admin can see Alice's timesheet
select test_helpers.set_auth(:'adm'::uuid);
select is(
  (select count(*) from public.timesheets where user_id = :'alice'::uuid),
  1::bigint,
  'admin sees alice timesheets'
);

-- Bob cannot manually change his status to submitted (must go via RPC)
select test_helpers.set_auth(:'bob'::uuid);
select public.create_or_get_week(date '2026-04-06') as ts_bob \gset
select throws_like(
  format($$ update public.timesheets set status='submitted' where id=%L $$, :'ts_bob'),
  '%status may only be changed via RPC%',
  'direct status change blocked'
);

select * from finish();
rollback;
