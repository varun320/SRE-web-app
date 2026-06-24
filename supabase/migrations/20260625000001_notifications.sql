-- Plan 6 / Task 1 — in-app notifications.
--
-- Recipients are users (employees and admins). Writes come ONLY from
-- SECURITY DEFINER RPCs that wrap the FSM transitions (submit / approve /
-- decline / unlock / admin_force_submit). Reads are scoped to the recipient.
-- Users may mark their own rows read (flip read_at); nothing else mutates.

create type public.notification_kind as enum (
  'timesheet_submitted',        -- → admins
  'timesheet_approved',         -- → employee
  'timesheet_declined',         -- → employee
  'timesheet_unlocked',         -- → employee
  'timesheet_force_submitted'   -- → employee (admin submitted on their behalf)
);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,    -- recipient
  org_id        uuid not null references public.organizations(id),
  kind          public.notification_kind not null,
  timesheet_id  uuid references public.timesheets(id) on delete cascade,
  actor_id      uuid references public.users(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Most common read pattern: "what's unread for me, newest first".
create index notifications_recipient_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

-- For RPC inserts and cascade deletes when a timesheet is removed.
create index notifications_timesheet_idx
  on public.notifications (timesheet_id);

alter table public.notifications enable row level security;

-- A user reads only their own notifications.
create policy notifications_own_read on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- A user can mark their own rows read (UPDATE policy gates both pre- and post-row).
-- The WITH CHECK keeps them from re-assigning a row to someone else.
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only service_role / SECURITY DEFINER RPCs insert. authenticated has no insert/delete.
revoke insert, delete on public.notifications from authenticated;

-- Lock down which columns the recipient may touch. read_at is the only legitimate
-- mutation; everything else is enforced by the policy + by not granting columns.
-- (Supabase grants are coarse — this is belt-and-suspenders for clarity.)
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
