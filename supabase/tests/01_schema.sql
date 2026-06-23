begin;
select plan(11);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'users',         'users table exists');
select has_table('public', 'user_roles',    'user_roles table exists');
select col_not_null('public', 'users', 'email',         'users.email NOT NULL');
select col_not_null('public', 'users', 'employee_code', 'users.employee_code NOT NULL');
select col_is_pk('public', 'user_roles', ARRAY['user_id','role'], 'user_roles pk on (user_id, role)');

select has_table('public', 'positions',       'positions table exists');
select has_table('public', 'sub_categories',  'sub_categories table exists');
select col_not_null('public', 'positions', 'annual_vacation_hours', 'positions.annual_vacation_hours NOT NULL');
select col_is_pk('public', 'sub_categories', ARRAY['id'], 'sub_categories pk on id');
select col_is_unique('public', 'sub_categories', ARRAY['main_category','name'], 'sub_categories unique on (main_category, name)');

select * from finish();
rollback;
