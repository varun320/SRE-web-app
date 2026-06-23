insert into public.organizations(id, name)
values ('00000000-0000-0000-0000-000000000001', 'Sulfur Recovery Engineering Inc.')
on conflict do nothing;

insert into public.positions(org_id, name, annual_vacation_hours) values
  ('00000000-0000-0000-0000-000000000001', 'Process Engineer EIT', 120),
  ('00000000-0000-0000-0000-000000000001', 'Admin',                200),
  ('00000000-0000-0000-0000-000000000001', 'Senior Engineer',      200),
  ('00000000-0000-0000-0000-000000000001', 'Sales & Marketing',    160)
on conflict do nothing;

insert into public.sub_categories(main_category, name, requires_project, consumes_til, consumes_vacation, is_overtime_taken, sort_order) values
  ('Project','Travel',              true,  false, false, false, 10),
  ('Project','Site Travel',         true,  false, false, false, 20),
  ('Project','Site Work',           true,  false, false, false, 30),
  ('Project','Report',              true,  false, false, false, 40),
  ('Project','Extra Integration',   true,  false, false, false, 50),
  ('Project','Simulation',          true,  false, false, false, 60),
  ('Project','Office Preparation',  true,  false, false, false, 70),
  ('Project','Project Management',  true,  false, false, false, 80),
  ('Project','Engineering Work',    true,  false, false, false, 90),
  ('Admin','Overtime Taken',        false, true,  false, true,  10),
  ('Admin','TIL Payout',            false, true,  false, false, 20),
  ('Admin','Sick Time',             false, false, false, false, 30),
  ('Admin','Vacation Hours',        false, false, true,  false, 40),
  ('Admin','Statutory Holiday',     false, false, false, false, 50),
  ('Admin','Administrative',        false, false, false, false, 60),
  ('Admin','Toolbox Meeting',       false, false, false, false, 70),
  ('Office & Sales','Customer Contact',    false, false, false, false, 10),
  ('Office & Sales','Project Development', false, false, false, false, 20),
  ('Office & Sales','Proposals & Quotes',  false, false, false, false, 30),
  ('Office & Sales','Inventory',           false, false, false, false, 40),
  ('Office & Sales','SRU Study',           false, false, false, false, 50),
  ('Office & Sales','Conference',          false, false, false, false, 60),
  ('Office & Sales','General',             false, false, false, false, 70)
on conflict (main_category, name) do nothing;
