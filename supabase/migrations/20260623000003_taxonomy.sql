create type public.main_category as enum ('Project', 'Admin', 'Office & Sales');

create table public.positions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  name                   text not null,
  annual_vacation_hours  numeric(6,2) not null check (annual_vacation_hours >= 0),
  created_at             timestamptz not null default now(),
  unique (org_id, name)
);

alter table public.users
  add constraint users_position_fk
  foreign key (position_id) references public.positions(id);

create table public.sub_categories (
  id                  uuid primary key default gen_random_uuid(),
  main_category       public.main_category not null,
  name                text not null,
  requires_project    boolean not null default false,
  consumes_til        boolean not null default false,
  consumes_vacation   boolean not null default false,
  is_overtime_taken   boolean not null default false,
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  unique (main_category, name)
);

create index on public.sub_categories(main_category);
