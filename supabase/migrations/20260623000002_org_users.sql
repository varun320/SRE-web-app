create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  fiscal_year_start date not null default '2026-01-01',
  created_at  timestamptz not null default now()
);

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid not null references public.organizations(id),
  full_name     text not null,
  email         citext not null unique,
  employee_code text not null,
  department    text,
  position_id   uuid,  -- FK added in 0003
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, employee_code)
);

create type public.app_role as enum ('employee', 'admin');

create table public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role    public.app_role not null,
  primary key (user_id, role)
);

create index on public.users(org_id);
create index on public.user_roles(user_id);
