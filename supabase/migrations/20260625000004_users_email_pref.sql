-- Plan 6 / Task 6 — per-user opt-in for email notifications.
-- Default OFF so existing users aren't surprised by mail until they explicitly enable.

alter table public.users
  add column if not exists email_notifications boolean not null default false;

-- Let users toggle their own preference. Existing user_self_update policy
-- might not allow this column; explicit narrow grant + policy in case.
grant update (email_notifications) on public.users to authenticated;

-- Self-update RLS policy (idempotent name)
drop policy if exists users_self_email_pref on public.users;
create policy users_self_email_pref on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
