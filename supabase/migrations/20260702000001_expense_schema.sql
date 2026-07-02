-- Phase 1 / Task 1 — Expense tracker schema (mirrors Excel Expense Log +
-- Payout Log + Settings). Business logic (interest, balance) lives in
-- v_expense_balance / v_expense_summary (see 20260702000002). All writes go
-- through RPCs (see 20260702000003) that own status transitions.

create type public.expense_status as enum
  ('draft', 'submitted', 'approved', 'declined', 'paid');

------------------------------------------------------------------------------
-- expense_settings — per-user overrides plus a system default row (user_id NULL).
------------------------------------------------------------------------------
create table public.expense_settings (
  user_id     uuid primary key references public.users(id) on delete cascade,
  apr         numeric(6,4) not null default 0.2199 check (apr >= 0 and apr < 5),
  grace_days  int          not null default 30    check (grace_days between 0 and 365),
  currency    text         not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  updated_at  timestamptz  not null default now()
);

-- Resolve settings for a user, falling back to hard-coded system defaults.
create or replace function public.expense_settings_for(p_user uuid)
returns public.expense_settings language sql stable as $$
  select coalesce(
           (select s from public.expense_settings s where s.user_id = p_user),
           row(p_user, 0.2199::numeric(6,4), 30, 'CAD', now())::public.expense_settings
         );
$$;

------------------------------------------------------------------------------
-- expense_reports — one row per monthly submission.
------------------------------------------------------------------------------
create table public.expense_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  org_id           uuid not null references public.organizations(id),
  invoice_no       text not null check (length(trim(invoice_no)) between 3 and 32),
  period_from      date not null,
  period_to        date not null,
  submission_date  date not null default current_date,
  amount_cad       numeric(12,2) not null default 0 check (amount_cad >= 0),
  gst_cad          numeric(12,2) not null default 0 check (gst_cad >= 0),
  total_cad        numeric(12,2) generated always as (amount_cad + gst_cad) stored,
  notes            text,
  status           public.expense_status not null default 'draft',
  locked           boolean not null default false,
  submitted_at     timestamptz,
  decided_at       timestamptz,
  decided_by       uuid references public.users(id),
  decline_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, invoice_no),
  check (period_to >= period_from),
  check (submission_date >= period_from)
);

create index on public.expense_reports (org_id, status);
create index on public.expense_reports (user_id, submission_date desc);

------------------------------------------------------------------------------
-- expense_payouts — money received from SRE against a specific invoice.
------------------------------------------------------------------------------
create table public.expense_payouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  org_id       uuid not null references public.organizations(id),
  invoice_no   text not null,
  payout_date  date not null,
  amount_cad   numeric(12,2) not null check (amount_cad > 0),
  reference    text,
  notes        text,
  created_by   uuid not null references public.users(id),
  created_at   timestamptz not null default now(),
  foreign key (user_id, invoice_no)
    references public.expense_reports(user_id, invoice_no) on delete cascade
);

create index on public.expense_payouts (user_id, invoice_no);
create index on public.expense_payouts (org_id, payout_date desc);

------------------------------------------------------------------------------
-- expense_approval_log — full audit trail, parallel to approval_log for
-- timesheets.
------------------------------------------------------------------------------
create table public.expense_approval_log (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expense_reports(id) on delete cascade,
  actor_id    uuid not null references public.users(id),
  action      text not null check (action in
                ('submit','approve','decline','unlock','admin_edit','payout_add','payout_delete')),
  comment     text,
  created_at  timestamptz not null default now()
);

create index on public.expense_approval_log (expense_id, created_at desc);

------------------------------------------------------------------------------
-- Guards: keep status/locked mutable only through RPCs.
------------------------------------------------------------------------------
create or replace function public.guard_expense_status() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if (new.status is distinct from old.status
        or new.locked is distinct from old.locked)
       and coalesce(current_setting('app.allow_status_change', true), '') <> 'on'
    then
      raise exception 'status/locked may only be changed via RPC'
        using errcode = '42501';
    end if;
  end if;
  return new;
end$$;

create trigger trg_guard_expense_status
before update on public.expense_reports
for each row execute function public.guard_expense_status();

-- Touch updated_at on any mutation.
create or replace function public.touch_expense() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

create trigger trg_touch_expense
before update on public.expense_reports
for each row execute function public.touch_expense();
