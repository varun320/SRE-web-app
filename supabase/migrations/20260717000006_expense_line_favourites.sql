-- Line-item favourites: reusable templates for recurring expenses
-- (gym membership, software subscriptions, Uber membership). Employee
-- taps "Add from favourites" in the editor and pre-fills a line without
-- retyping the same description/amount every month.

create table public.expense_line_favourites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  label         text not null check (length(trim(label)) between 1 and 60),
  category      public.expense_category not null default 'Other',
  description   text not null check (length(trim(description)) between 1 and 500),
  amount_cad    numeric(12,2) not null default 0 check (amount_cad >= 0),
  gst_cad       numeric(12,2) not null default 0 check (gst_cad >= 0),
  project_id    uuid references public.projects(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.expense_line_favourites (user_id);

alter table public.expense_line_favourites enable row level security;

create policy exp_fav_owner on public.expense_line_favourites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.expense_line_favourites to authenticated;
