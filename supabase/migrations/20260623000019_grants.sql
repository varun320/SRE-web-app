-- Table-level privileges for the authenticated role.
-- RLS still gates which rows each user can see; these grants just allow the role
-- to attempt access. Without them, even RLS-passing queries fail with
-- "permission denied for table ...".
grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;

-- Apply same defaults to anything created in future migrations of the public schema.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
