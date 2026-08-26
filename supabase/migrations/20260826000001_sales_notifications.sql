-- Sales notifications inbox — spec: SRE-APP-SALES-DASHBOARD.md §6.
-- Rows are inserted by the GHL automations sidecar via POST /api/notifications
-- (HMAC-verified with SRE_WEBHOOK_SECRET). Engineers see only their own rows;
-- service-role bypasses RLS on insert.

create table if not exists public.sales_notifications (
  id             uuid primary key default gen_random_uuid(),
  engineer_id    uuid not null,
  category       text not null,
  opportunity_id text not null,
  title          text not null,
  body           text,
  action_url     text,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);

create index if not exists sales_notifications_engineer_read_idx
  on public.sales_notifications (engineer_id, read_at, created_at desc);

-- ponytail: idempotency check is scoped to (engineer_id, category, opportunity_id, day)
-- so the follow-up cron can retry without spamming. Uses a partial unique index over
-- unread rows for the same day.
create unique index if not exists sales_notifications_idempotency_idx
  on public.sales_notifications (
    engineer_id, category, opportunity_id, date_trunc('day', created_at)
  )
  where read_at is null;

alter table public.sales_notifications enable row level security;

create policy sales_notifications_select_own on public.sales_notifications
  for select to authenticated
  using (engineer_id = auth.uid());

create policy sales_notifications_update_own on public.sales_notifications
  for update to authenticated
  using (engineer_id = auth.uid())
  with check (engineer_id = auth.uid());
