create table public.til_ledger (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  week_start       date not null,
  opening_balance  numeric(8,2) not null,
  overtime_earned  numeric(8,2) not null default 0,
  til_used         numeric(8,2) not null default 0,
  closing_balance  numeric(8,2) generated always as (opening_balance + overtime_earned - til_used) stored,
  frozen           boolean not null default false,
  stale            boolean not null default false,
  approved_by      uuid references public.users(id),
  created_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.vacation_ledger (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  week_start       date not null,
  opening_balance  numeric(8,2) not null,
  vacation_used    numeric(8,2) not null default 0,
  closing_balance  numeric(8,2) generated always as (opening_balance - vacation_used) stored,
  frozen           boolean not null default false,
  stale            boolean not null default false,
  approved_by      uuid references public.users(id),
  created_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

create index on public.til_ledger(user_id, week_start desc);
create index on public.vacation_ledger(user_id, week_start desc);
