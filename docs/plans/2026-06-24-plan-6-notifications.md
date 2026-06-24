# Plan 6 — Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the feedback loop. When an employee submits a week, the admin knows. When an admin approves, declines, or unlocks, the employee knows. No more guessing whether the other side has acted.

**Scope split: in-app first, email second.**
- **v1 (this plan, Tasks 1–5):** in-app notifications. Bell icon in the header with unread badge, dropdown of recent events, dedicated `/me/notifications` page. Persisted in a `notifications` table, written from existing RPCs.
- **v2 (Task 6, gated):** email delivery via Supabase Edge Function + Resend. Off by default behind a per-user preference (`users.email_notifications boolean`).

**Architecture:** All writes happen inside the existing SECURITY DEFINER RPCs (`submit_timesheet`, `approve_timesheet`, `decline_timesheet`, `unlock_timesheet`, `admin_force_submit`) — that way notifications are transactional with the state change they describe. Reads use a server component for the dropdown (so the unread count is correct on first paint) plus a TanStack Query polling refresh while the page is open.

**Tech Stack additions:**
- New SQL: `notifications` table, RLS policies, helper function `notify_users(...)`, RPC patches.
- Web: `NotificationsBell.tsx` (client, in Header), `/me/notifications/page.tsx`, `lib/notifications/queries.ts` + `mutations.ts`.
- v2 only: Supabase Edge Function `send-notification-email` + a `pg_net` HTTP webhook from the trigger.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md` §2.1 (`notifications` already in domain model with `v1.1` note)

---

## File Structure

```
SRE-app/
├── supabase/migrations/
│   ├── 20260625000001_notifications.sql              ← table + RLS + indexes
│   ├── 20260625000002_notify_helpers.sql             ← notify_users() + admin lookup
│   ├── 20260625000003_rpc_notifications_hooks.sql    ← patch existing RPCs to insert rows
│   └── 20260625000004_users_email_pref.sql           ← v2: email opt-in column
└── web/
    ├── app/(app)/me/notifications/
    │   ├── page.tsx                                   ← full list, mark read, mark all read
    │   └── loading.tsx
    ├── components/shell/
    │   └── NotificationsBell.tsx                      ← header bell + dropdown (client)
    ├── lib/notifications/
    │   ├── queries.ts                                 ← fetchUnreadCount, fetchRecent
    │   └── mutations.ts                               ← markRead, markAllRead
    └── tests/unit/lib/notifications/
        └── format.test.ts                             ← payload → human-readable copy
```

---

### Task 1 — DB schema + RLS

**Files:**
- Create: `supabase/migrations/20260625000001_notifications.sql`

- [ ] **Step 1: Table**

```sql
create type public.notification_kind as enum (
  'timesheet_submitted',     -- → admins (when employee submits)
  'timesheet_approved',      -- → employee
  'timesheet_declined',      -- → employee
  'timesheet_unlocked',      -- → employee
  'timesheet_force_submitted' -- → employee (admin pushed it forward)
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,  -- recipient
  org_id      uuid not null references public.organizations(id),
  kind        public.notification_kind not null,
  timesheet_id uuid references public.timesheets(id) on delete cascade,
  actor_id    uuid references public.users(id),                              -- who triggered it
  payload     jsonb not null default '{}'::jsonb,                            -- {week_start, decline_reason?, etc.}
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index on public.notifications(user_id, read_at, created_at desc);
create index on public.notifications(timesheet_id);
```

- [ ] **Step 2: RLS**

```sql
alter table public.notifications enable row level security;

-- A user sees only their own notifications.
create policy notifications_own_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- Only RPCs (SECURITY DEFINER) write — block direct client inserts.
revoke insert, update, delete on public.notifications from authenticated;

-- Allow users to mark their own notifications as read (UPDATE read_at only).
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

(The UPDATE policy lets us flip `read_at` from the browser via `sb.from('notifications').update({read_at: now}).eq('id', x)` without a wrapping RPC.)

- [ ] **Step 3: Verify**

```sql
\d public.notifications
select policyname, cmd from pg_policies where tablename = 'notifications';
```

Expected: 2 policies (own_read, mark_read), no insert/delete grants to `authenticated`.

---

### Task 2 — Helper functions + RPC patches

**Files:**
- Create: `supabase/migrations/20260625000002_notify_helpers.sql`
- Create: `supabase/migrations/20260625000003_rpc_notifications_hooks.sql`

- [ ] **Step 1: `notify_users(...)` helper**

```sql
create or replace function public.notify_users(
  p_recipient_ids uuid[],
  p_org_id uuid,
  p_kind public.notification_kind,
  p_timesheet_id uuid,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, org_id, kind, timesheet_id, actor_id, payload)
  select unnest(p_recipient_ids), p_org_id, p_kind, p_timesheet_id, p_actor_id, p_payload;
end$$;
```

- [ ] **Step 2: `admin_ids_for_org(...)` lookup**

```sql
create or replace function public.admin_ids_for_org(p_org_id uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(u.id), '{}'::uuid[])
  from public.users u
  join public.user_roles r on r.user_id = u.id
  where r.role = 'admin' and u.org_id = p_org_id and u.is_active;
$$;
```

- [ ] **Step 3: Patch `submit_timesheet`**

Append before the existing `return;`:

```sql
perform public.notify_users(
  public.admin_ids_for_org(v_org_id),
  v_org_id,
  'timesheet_submitted',
  p_timesheet_id,
  v_actor,
  jsonb_build_object(
    'week_start', v_ts.week_start,
    'employee_name', (select full_name from public.users where id = v_ts.user_id)
  )
);
```

(`v_org_id` already exists in `submit_timesheet`; if not, fetch via `select org_id from users where id = v_ts.user_id`.)

- [ ] **Step 4: Patch `approve_timesheet`, `decline_timesheet`, `unlock_timesheet`, `admin_force_submit`**

Each gets a `notify_users` call with the employee as recipient and the appropriate `kind`. Payload always includes `week_start` and, for decline/unlock, the reason.

- [ ] **Step 5: Smoke test**

In SQL:

```sql
select public.submit_timesheet('<a-draft-ts-id>');
select count(*) from public.notifications where kind = 'timesheet_submitted';
```

Expected: one row per admin.

---

### Task 3 — `lib/notifications` + bell component

**Files:**
- Create: `web/lib/notifications/queries.ts`
- Create: `web/lib/notifications/mutations.ts`
- Create: `web/components/shell/NotificationsBell.tsx`
- Modify: `web/components/shell/Header.tsx` (mount the bell)

- [ ] **Step 1: Queries**

```ts
export interface NotificationRow {
  id: string;
  kind: 'timesheet_submitted' | 'timesheet_approved' | 'timesheet_declined' | 'timesheet_unlocked' | 'timesheet_force_submitted';
  timesheet_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export async function fetchUnreadCount(sb: SupabaseClient): Promise<number>;
export async function fetchRecent(sb: SupabaseClient, limit = 20): Promise<NotificationRow[]>;
```

Uses a join with `users` for actor name, scoped by RLS to the caller.

- [ ] **Step 2: Mutations**

```ts
export async function markRead(sb: SupabaseClient, id: string): Promise<void>;
export async function markAllRead(sb: SupabaseClient): Promise<void>;
```

`markAllRead` is `sb.from('notifications').update({read_at: now}).is('read_at', null)` — RLS scopes to own rows.

- [ ] **Step 3: `NotificationsBell.tsx`**

Client component placed next to HelpButton in the header. Renders a bell icon with a small unread badge. On click, opens a dropdown (base-ui DropdownMenu) showing the 10 most recent notifications. Each row links to the relevant timesheet (`/week/{week_start}` for employee notifications, `/admin/employees/{employee_id}/week/{week_start}` for admin submissions).

Polls every 60s via TanStack `useQuery({ refetchInterval: 60_000 })`.

- [ ] **Step 4: Mount in Header**

Add `<NotificationsBell />` to both desktop and mobile clusters in `Header.tsx`. Hide entirely if the user has no notifications and no admin role (i.e. brand-new employee with zero history).

---

### Task 4 — `/me/notifications` page

**Files:**
- Create: `web/app/(app)/me/notifications/page.tsx`
- Create: `web/app/(app)/me/notifications/loading.tsx`
- Modify: `web/components/shell/Header.tsx` (add "Notifications" item to mobile drawer if useful)

- [ ] **Step 1: Page**

Full chronological list: 50 most recent. Each row: time-ago, action label, employee/admin context, link to the timesheet, mark-read button on unread rows. Sticky "Mark all read" header. Empty state when none.

- [ ] **Step 2: Copy formatter**

A tiny `formatNotification(n: NotificationRow): { title: string; href: string; tone: string }` helper. Centralize copy so the bell dropdown and the full page render the same text.

```ts
// Examples:
// timesheet_submitted → "{employee_name} submitted the week of {week_start}"
// timesheet_approved  → "{actor_name} approved the week of {week_start}"
// timesheet_declined  → "{actor_name} declined the week of {week_start} — {decline_reason}"
```

- [ ] **Step 3: Unit test for the formatter**

`tests/unit/lib/notifications/format.test.ts` — covers all 5 kinds + missing payload fields fallback to a neutral message.

---

### Task 5 — Polish + E2E

**Files:**
- Modify: `web/components/shell/NotificationsBell.tsx` (animations, accessibility)
- Create: `web/tests/e2e/notifications.spec.ts`

- [ ] **Step 1: Polish**

- Unread badge tinted in `--color-status-submitted-bg/fg` (matches the "submitted" badge elsewhere).
- ARIA: `aria-label="Notifications (N unread)"`, `role="menu"` on dropdown, keyboard nav.
- Subtle pulse animation on the badge when count > 0 (CSS only, no JS).

- [ ] **Step 2: E2E**

1. Provision admin + employee.
2. Employee creates + submits a draft week.
3. Admin signs in → bell badge shows 1 → opens dropdown → sees "{employee_name} submitted ...".
4. Admin clicks the notification → lands on the review page.
5. Admin approves.
6. Employee signs in → bell badge shows 1 → opens dropdown → sees "approved".
7. Click "Mark all read" → badge clears.

---

### Task 6 (v2, gated) — Email delivery via Resend

**Files:**
- Create: `supabase/migrations/20260625000004_users_email_pref.sql`
- Create: `supabase/functions/send-notification-email/index.ts` (Edge Function)
- Modify: `web/app/(app)/me/notifications/page.tsx` (preference toggle)

- [ ] **Step 1: Add `users.email_notifications boolean default false`**

Default off so existing users opt in deliberately.

- [ ] **Step 2: Edge Function**

Reads from a Supabase queue table or a `pg_net` HTTP webhook fired by an AFTER INSERT trigger on `notifications`. Calls Resend (or any SMTP provider) with templated copy. Reads `email_notifications` first — silently drops if disabled.

- [ ] **Step 3: Trigger**

```sql
create or replace function public.notify_email_webhook() returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := current_setting('app.notification_webhook_url', true),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end$$;

create trigger notifications_email_dispatch
  after insert on public.notifications
  for each row execute function public.notify_email_webhook();
```

Webhook URL configured via `alter database set app.notification_webhook_url = '...'`.

- [ ] **Step 4: UI toggle**

In `/me/notifications`, a single checkbox: "Also email me when I get a notification."

---

## Quality Gate (Done = all true)

- [ ] Submitting a week creates one notification per admin (verified via SQL).
- [ ] Approving / declining / unlocking creates exactly one notification for the employee.
- [ ] Notification rows are visible to the recipient and NOBODY ELSE (RLS check: sign in as other employee, query → empty).
- [ ] Bell badge shows correct unread count on page load.
- [ ] Click a notification → lands on the right week page.
- [ ] Mark-all-read clears the badge across tabs (polling picks it up within 60s).
- [ ] Formatter unit tests pass.
- [ ] E2E notifications spec passes (depends on Plan 5 Task 8 loader fix — already done).
- [ ] v2 email delivery: with `email_notifications=true`, an approval triggers a Resend send (manual check in Resend dashboard or Mailpit on local).

---

## Risks & Open Questions

1. **Notification noise** — a single admin who submits + approves their own weeks could spam themselves. Mitigation: in `notify_users`, exclude the actor from the recipient list (`where id != p_actor_id`).
2. **Stale unread counts across tabs** — 60s poll is the floor for cross-tab freshness without subscriptions. If users find it sluggish, swap to Supabase Realtime subscription on the `notifications` table filtered by `user_id = current user`.
3. **Email deliverability** — Resend free tier limits + SPF/DKIM setup for sulfurrecovery.com. v2 risk, not v1.
4. **Notification retention** — currently unbounded. Add a scheduled job (or cron) to delete read notifications older than 90 days once we have real volume.
5. **Unlock cascade silence** — `unlock_timesheet` invalidates downstream ledgers; should the affected later-week timesheets also notify? **Recommend no** for v1 — too noisy. Add later if employees ask.
