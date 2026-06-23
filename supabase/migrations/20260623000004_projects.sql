create type public.project_status as enum ('active', 'closed');

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  project_number int  not null,
  name           text not null,
  status         public.project_status not null default 'active',
  created_at     timestamptz not null default now(),
  unique (org_id, project_number),
  check (project_number between 2020000 and 2099999),
  check (project_number % 1000 between 1 and 999)
);

create index on public.projects(org_id, status);
