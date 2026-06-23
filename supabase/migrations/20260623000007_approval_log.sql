create type public.approval_action as enum ('submit','approve','decline','unlock','imported','ledger_recompute');

create table public.approval_log (
  id            bigserial primary key,
  timesheet_id  uuid not null references public.timesheets(id) on delete cascade,
  actor_id      uuid references public.users(id),
  action        public.approval_action not null,
  at            timestamptz not null default now(),
  comment       text
);

create index on public.approval_log(timesheet_id, at desc);
