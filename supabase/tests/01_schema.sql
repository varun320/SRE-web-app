begin;
select plan(6);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'users',         'users table exists');
select has_table('public', 'user_roles',    'user_roles table exists');
select col_not_null('public', 'users', 'email',         'users.email NOT NULL');
select col_not_null('public', 'users', 'employee_code', 'users.employee_code NOT NULL');
select col_is_pk('public', 'user_roles', ARRAY['user_id','role'], 'user_roles unique on (user_id, role)');

select * from finish();
rollback;
