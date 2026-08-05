create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  name           text not null,
  location       text,
  lat            double precision not null,
  lng            double precision not null,
  sharepoint_url text,
  created_at     timestamptz not null default now(),
  check (lat between -90 and 90),
  check (lng between -180 and 180)
);

create index on public.clients(org_id);

alter table public.clients enable row level security;

create policy clients_read on public.clients for select to authenticated
  using (org_id = public.current_user_org());

create policy clients_write on public.clients for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());
