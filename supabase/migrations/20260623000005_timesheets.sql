create type public.timesheet_status as enum ('draft', 'submitted', 'approved', 'declined');

create table public.timesheets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  org_id          uuid not null references public.organizations(id),
  week_start      date not null,
  status          public.timesheet_status not null default 'draft',
  submitted_at    timestamptz,
  decided_at      timestamptz,
  decided_by      uuid references public.users(id),
  decline_reason  text,
  locked          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, week_start),
  check (extract(dow from week_start) = 1)
);

create index on public.timesheets(org_id, status);
create index on public.timesheets(user_id, week_start desc);

create table public.timesheet_entries (
  id              uuid primary key default gen_random_uuid(),
  timesheet_id    uuid not null references public.timesheets(id) on delete cascade,
  main_category   public.main_category not null,
  sub_category_id uuid not null references public.sub_categories(id),
  project_id      uuid references public.projects(id),
  mon_hrs numeric(5,2) not null default 0 check (mon_hrs >= 0),
  tue_hrs numeric(5,2) not null default 0 check (tue_hrs >= 0),
  wed_hrs numeric(5,2) not null default 0 check (wed_hrs >= 0),
  thu_hrs numeric(5,2) not null default 0 check (thu_hrs >= 0),
  fri_hrs numeric(5,2) not null default 0 check (fri_hrs >= 0),
  sat_hrs numeric(5,2) not null default 0 check (sat_hrs >= 0),
  sun_hrs numeric(5,2) not null default 0 check (sun_hrs >= 0),
  description text not null check (length(trim(description)) > 0),
  position    int  not null default 0,
  row_total numeric(6,2) generated always as
    (mon_hrs + tue_hrs + wed_hrs + thu_hrs + fri_hrs + sat_hrs + sun_hrs) stored,
  created_at  timestamptz not null default now()
);

create index on public.timesheet_entries(timesheet_id);

create or replace function public.validate_entry() returns trigger language plpgsql as $$
declare
  sc record;
begin
  select main_category, requires_project into sc
  from public.sub_categories where id = new.sub_category_id;
  if not found then
    raise exception 'sub_category % not found', new.sub_category_id using errcode='23503';
  end if;
  if sc.main_category <> new.main_category then
    raise exception 'sub_category main_category (%) does not match entry main_category (%)',
      sc.main_category, new.main_category using errcode='23514';
  end if;
  if sc.requires_project and new.project_id is null then
    raise exception 'project_id required for sub_category requiring project' using errcode='23502';
  end if;
  if not sc.requires_project and new.project_id is not null then
    raise exception 'project_id must be null for non-project sub_category' using errcode='23514';
  end if;
  return new;
end$$;

create trigger trg_entry_validate
before insert or update on public.timesheet_entries
for each row execute function public.validate_entry();

create or replace function public.touch_timesheet() returns trigger language plpgsql as $$
begin
  update public.timesheets set updated_at = now() where id = new.timesheet_id;
  return new;
end$$;

create trigger trg_entry_touch
after insert or update or delete on public.timesheet_entries
for each row execute function public.touch_timesheet();
