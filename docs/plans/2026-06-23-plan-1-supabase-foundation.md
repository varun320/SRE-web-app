# Plan 1 — Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Postgres schema, RLS policies, RPCs, views, and pgTAP test suite that constitute the entire backend for the SRE Timesheet app. After this plan ships, the backend is feature-complete and fully tested even though no frontend exists yet.

**Architecture:** Supabase (local CLI for dev, hosted for prod). Every domain rule is enforced in Postgres: CHECK constraints + triggers for data integrity, `SECURITY DEFINER` RPCs for state transitions, RLS policies for ABAC. Views expose denormalized read shapes. pgTAP tests cover every policy and every RPC happy/error path.

**Tech Stack:** Supabase CLI ≥ 1.200, Postgres 15, pgTAP 1.3, plpgsql.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md`

---

## File Structure

```
SRE-app/
├── supabase/
│   ├── config.toml                              ← supabase init output
│   ├── seed.sql                                 ← sub_categories, positions, dev org
│   ├── migrations/
│   │   ├── 20260623_0001_extensions.sql         ← pgcrypto, citext, pgtap
│   │   ├── 20260623_0002_org_users.sql          ← organizations, users, user_roles
│   │   ├── 20260623_0003_taxonomy.sql           ← positions, sub_categories
│   │   ├── 20260623_0004_projects.sql           ← projects
│   │   ├── 20260623_0005_timesheets.sql         ← timesheets, timesheet_entries
│   │   ├── 20260623_0006_ledgers.sql            ← til_ledger, vacation_ledger
│   │   ├── 20260623_0007_approval_log.sql       ← approval_log
│   │   ├── 20260623_0008_helpers.sql            ← is_admin, same_org, is_monday
│   │   ├── 20260623_0009_rls_reference.sql      ← RLS for org/users/positions/sub_cats/projects
│   │   ├── 20260623_0010_rls_timesheets.sql     ← RLS for timesheets, entries
│   │   ├── 20260623_0011_rls_ledgers_log.sql    ← RLS for ledgers, approval_log
│   │   ├── 20260623_0012_views.sql              ← v_timesheet_totals, v_weekly_report, v_til_balance, v_vacation_balance
│   │   ├── 20260623_0013_rpc_week.sql           ← create_or_get_week
│   │   ├── 20260623_0014_rpc_submit.sql         ← submit_timesheet
│   │   ├── 20260623_0015_rpc_approve.sql        ← approve_timesheet + ledger freeze
│   │   ├── 20260623_0016_rpc_decline.sql        ← decline_timesheet
│   │   └── 20260623_0017_rpc_unlock.sql         ← unlock_timesheet + ledger cascade
│   └── tests/
│       ├── helpers.sql                          ← test fixtures (create_test_user etc.)
│       ├── 01_schema.sql                        ← table existence + constraint pgTAP
│       ├── 02_rls_timesheets.sql                ← employee/admin RLS pgTAP
│       ├── 03_rls_ledgers.sql                   ← ledger/log RLS pgTAP
│       ├── 04_rpc_submit.sql                    ← submit RPC pgTAP
│       ├── 05_rpc_approve_decline.sql           ← approve/decline RPC pgTAP
│       └── 06_rpc_unlock_cascade.sql            ← unlock RPC + cascade pgTAP
├── .gitignore
└── README.md
```

Each file has one responsibility. Migrations are numbered to enforce order. Tests mirror the migrations.

---

### Task 1: Initialize repo and Supabase project

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `supabase/config.toml` (via `supabase init`)

- [ ] **Step 1: Initialize git**

Run from `D:\projects\prodigy-ai\projects\SRE-app`:
```bash
git init -b main
```

- [ ] **Step 2: Write .gitignore**

Create `.gitignore`:
```
node_modules/
.env
.env.local
.next/
.turbo/
.DS_Store
supabase/.branches/
supabase/.temp/
*.log
```

- [ ] **Step 3: Write README.md**

Create `README.md`:
```markdown
# SRE Timesheet

Web app replacing the SRE Inc. weekly timesheet Excel workbook.

See `docs/specs/2026-06-23-sre-timesheet-design.md` for the full design.

## Plan 1: Supabase Foundation

Run locally:

    supabase start
    supabase db reset    # applies migrations + seed
    supabase test db     # runs pgTAP tests
```

- [ ] **Step 4: Install Supabase CLI if missing**

Run:
```bash
supabase --version
```
Expected: prints a version ≥ 1.200. If "command not found", install via `npm i -g supabase` or `scoop install supabase`.

- [ ] **Step 5: Initialize supabase project**

Run:
```bash
supabase init
```
Expected: creates `supabase/config.toml` and `supabase/migrations/` directory.

- [ ] **Step 6: Start local stack**

Run:
```bash
supabase start
```
Expected: prints API URL, anon key, service_role key, Studio URL. If Docker is not running, start Docker Desktop first.

- [ ] **Step 7: Commit**

```bash
git add .gitignore README.md supabase/
git commit -m "chore: init repo and supabase project"
```

---

### Task 2: Extensions migration

**Files:**
- Create: `supabase/migrations/20260623_0001_extensions.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0001_extensions.sql`:
```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pgtap;
```

- [ ] **Step 2: Apply**

Run:
```bash
supabase db reset
```
Expected: "Finished supabase db reset on …", no errors.

- [ ] **Step 3: Verify**

Run:
```bash
supabase db psql -c "select extname from pg_extension where extname in ('pgcrypto','citext','pgtap') order by extname;"
```
Expected output includes all three.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623_0001_extensions.sql
git commit -m "feat(db): add required extensions"
```

---

### Task 3: Organizations, users, user_roles

**Files:**
- Create: `supabase/migrations/20260623_0002_org_users.sql`

- [ ] **Step 1: Write failing test scaffold**

Create `supabase/tests/01_schema.sql`:
```sql
begin;
select plan(6);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'users',         'users table exists');
select has_table('public', 'user_roles',    'user_roles table exists');
select col_not_null('public', 'users', 'email',         'users.email NOT NULL');
select col_not_null('public', 'users', 'employee_code', 'users.employee_code NOT NULL');
select col_is_unique('public', 'user_roles', ARRAY['user_id','role'], 'user_roles unique on (user_id, role)');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests, expect failure**

Run:
```bash
supabase test db
```
Expected: failures — tables don't exist yet.

- [ ] **Step 3: Write migration**

Create `supabase/migrations/20260623_0002_org_users.sql`:
```sql
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
```

- [ ] **Step 4: Apply and rerun tests**

Run:
```bash
supabase db reset && supabase test db
```
Expected: all 6 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260623_0002_org_users.sql supabase/tests/01_schema.sql
git commit -m "feat(db): organizations, users, user_roles"
```

---

### Task 4: Positions and sub_categories

**Files:**
- Create: `supabase/migrations/20260623_0003_taxonomy.sql`
- Modify: `supabase/tests/01_schema.sql`

- [ ] **Step 1: Extend the schema test**

Replace the `select plan(6);` line and the assertions in `supabase/tests/01_schema.sql` with:
```sql
begin;
select plan(11);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'users',         'users table exists');
select has_table('public', 'user_roles',    'user_roles table exists');
select col_not_null('public', 'users', 'email',         'users.email NOT NULL');
select col_not_null('public', 'users', 'employee_code', 'users.employee_code NOT NULL');
select col_is_unique('public', 'user_roles', ARRAY['user_id','role'], 'user_roles unique on (user_id, role)');

select has_table('public', 'positions',       'positions table exists');
select has_table('public', 'sub_categories',  'sub_categories table exists');
select col_not_null('public', 'positions', 'annual_vacation_hours', 'positions.annual_vacation_hours NOT NULL');
select col_is_pk('public', 'sub_categories', ARRAY['id'], 'sub_categories pk on id');
select col_is_unique('public', 'sub_categories', ARRAY['main_category','name'], 'sub_categories unique on (main_category, name)');

select * from finish();
rollback;
```

- [ ] **Step 2: Run tests, expect failure**

Run:
```bash
supabase db reset && supabase test db
```
Expected: 5 new assertions fail.

- [ ] **Step 3: Write migration**

Create `supabase/migrations/20260623_0003_taxonomy.sql`:
```sql
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
```

- [ ] **Step 4: Apply and rerun tests**

Run:
```bash
supabase db reset && supabase test db
```
Expected: all 11 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260623_0003_taxonomy.sql supabase/tests/01_schema.sql
git commit -m "feat(db): positions and sub_categories"
```

---

### Task 5: Projects

**Files:**
- Create: `supabase/migrations/20260623_0004_projects.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0004_projects.sql`:
```sql
create type public.project_status as enum ('active', 'closed');

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  project_number int  not null,
  name           text not null,
  status         public.project_status not null default 'active',
  created_at     timestamptz not null default now(),
  unique (org_id, project_number),
  check (project_number between 2020000 and 2099999),  -- YYYY + 3 digit, 2020..2099
  check (project_number % 1000 between 1 and 999)
);

create index on public.projects(org_id, status);
```

- [ ] **Step 2: Apply**

Run:
```bash
supabase db reset
```
Expected: success.

- [ ] **Step 3: Verify CHECK works**

Run:
```bash
supabase db psql -c "insert into public.organizations(name) values ('Test') returning id;"
```
Note the returned `id`. Then run (substituting `<ORG>`):
```bash
supabase db psql -c "insert into public.projects(org_id, project_number, name) values ('<ORG>', 2026000, 'bad');"
```
Expected: ERROR — fails CHECK (sequence is 000).

Run:
```bash
supabase db psql -c "insert into public.projects(org_id, project_number, name) values ('<ORG>', 2026101, 'ok');"
```
Expected: INSERT 0 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623_0004_projects.sql
git commit -m "feat(db): projects with project_number format check"
```

---

### Task 6: Timesheets and entries

**Files:**
- Create: `supabase/migrations/20260623_0005_timesheets.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0005_timesheets.sql`:
```sql
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
  check (extract(dow from week_start) = 1)  -- Monday
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

-- Sub-category must match main-category, and project_id required iff sub-cat requires it.
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
```

- [ ] **Step 2: Apply**

Run:
```bash
supabase db reset
```
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623_0005_timesheets.sql
git commit -m "feat(db): timesheets and entries with validation trigger"
```

---

### Task 7: TIL and vacation ledgers

**Files:**
- Create: `supabase/migrations/20260623_0006_ledgers.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0006_ledgers.sql`:
```sql
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
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0006_ledgers.sql
git commit -m "feat(db): til and vacation ledgers"
```

---

### Task 8: Approval log

**Files:**
- Create: `supabase/migrations/20260623_0007_approval_log.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0007_approval_log.sql`:
```sql
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
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0007_approval_log.sql
git commit -m "feat(db): approval_log"
```

---

### Task 9: Helper functions

**Files:**
- Create: `supabase/migrations/20260623_0008_helpers.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0008_helpers.sql`:
```sql
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = uid and role = 'admin');
$$;

create or replace function public.current_user_org()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.users where id = auth.uid();
$$;

create or replace function public.same_org(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.users me, public.users t
    where me.id = auth.uid() and t.id = target_user and me.org_id = t.org_id
  );
$$;

grant execute on function public.is_admin(uuid)         to authenticated;
grant execute on function public.current_user_org()     to authenticated;
grant execute on function public.same_org(uuid)         to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0008_helpers.sql
git commit -m "feat(db): helpers is_admin, current_user_org, same_org"
```

---

### Task 10: RLS for reference tables

**Files:**
- Create: `supabase/migrations/20260623_0009_rls_reference.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0009_rls_reference.sql`:
```sql
alter table public.organizations  enable row level security;
alter table public.users          enable row level security;
alter table public.user_roles     enable row level security;
alter table public.positions      enable row level security;
alter table public.sub_categories enable row level security;
alter table public.projects       enable row level security;

-- organizations: read members of same org
create policy org_read on public.organizations for select to authenticated
  using (id = public.current_user_org());

-- users: self always; admin sees all in org
create policy users_read on public.users for select to authenticated
  using (id = auth.uid() or (public.is_admin(auth.uid()) and org_id = public.current_user_org()));
create policy users_write_admin on public.users for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());

-- user_roles: read self; admin manages
create policy roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy roles_write on public.user_roles for all to authenticated
  using  (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- positions, sub_categories: read all in same org (sub_categories are global), admin manages
create policy positions_read on public.positions for select to authenticated
  using (org_id = public.current_user_org());
create policy positions_write on public.positions for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());

create policy subcats_read on public.sub_categories for select to authenticated using (true);
create policy subcats_write on public.sub_categories for all to authenticated
  using  (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- projects: read all in org, admin manages
create policy projects_read on public.projects for select to authenticated
  using (org_id = public.current_user_org());
create policy projects_write on public.projects for all to authenticated
  using  (public.is_admin(auth.uid()) and org_id = public.current_user_org())
  with check (public.is_admin(auth.uid()) and org_id = public.current_user_org());
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0009_rls_reference.sql
git commit -m "feat(db): RLS for reference tables"
```

---

### Task 11: RLS for timesheets and entries

**Files:**
- Create: `supabase/migrations/20260623_0010_rls_timesheets.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0010_rls_timesheets.sql`:
```sql
alter table public.timesheets        enable row level security;
alter table public.timesheet_entries enable row level security;

-- timesheets: read own; admin reads all in org
create policy ts_read on public.timesheets for select to authenticated
  using (user_id = auth.uid()
      or (public.is_admin(auth.uid()) and org_id = public.current_user_org()));

-- timesheets: INSERT/UPDATE/DELETE limited to own user, status must be draft or declined.
-- Status itself is changed ONLY via RPCs (status column listed in CHECK below).
create policy ts_insert_own on public.timesheets for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft');

create policy ts_update_own on public.timesheets for update to authenticated
  using  (user_id = auth.uid() and status in ('draft','declined') and not locked)
  with check (user_id = auth.uid());

create policy ts_delete_own on public.timesheets for delete to authenticated
  using (user_id = auth.uid() and status = 'draft');

-- entries follow parent: writable only when parent is draft/declined and owned
create policy entries_read on public.timesheet_entries for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and (t.user_id = auth.uid()
                       or (public.is_admin(auth.uid()) and t.org_id = public.current_user_org()))));

create policy entries_write on public.timesheet_entries for all to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and t.user_id = auth.uid() and t.status in ('draft','declined') and not t.locked))
  with check (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and t.user_id = auth.uid() and t.status in ('draft','declined') and not t.locked));

-- Guard: forbid direct status writes by non-admin. RPCs use SECURITY DEFINER and bypass.
create or replace function public.guard_ts_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'status may only be changed via RPC' using errcode = '42501';
  end if;
  return new;
end$$;

create trigger trg_guard_ts_status
before update on public.timesheets
for each row execute function public.guard_ts_status();
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0010_rls_timesheets.sql
git commit -m "feat(db): RLS for timesheets and entries"
```

---

### Task 12: RLS for ledgers and approval log

**Files:**
- Create: `supabase/migrations/20260623_0011_rls_ledgers_log.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0011_rls_ledgers_log.sql`:
```sql
alter table public.til_ledger      enable row level security;
alter table public.vacation_ledger enable row level security;
alter table public.approval_log    enable row level security;

create policy til_read on public.til_ledger for select to authenticated
  using (user_id = auth.uid() or (public.is_admin(auth.uid()) and public.same_org(user_id)));
create policy vac_read on public.vacation_ledger for select to authenticated
  using (user_id = auth.uid() or (public.is_admin(auth.uid()) and public.same_org(user_id)));
-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER functions can write.

create policy log_read on public.approval_log for select to authenticated
  using (exists (select 1 from public.timesheets t where t.id = timesheet_id
                  and (t.user_id = auth.uid()
                       or (public.is_admin(auth.uid()) and t.org_id = public.current_user_org()))));
-- approval_log writes only via RPC.
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0011_rls_ledgers_log.sql
git commit -m "feat(db): RLS for ledgers and approval_log"
```

---

### Task 13: Views

**Files:**
- Create: `supabase/migrations/20260623_0012_views.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0012_views.sql`:
```sql
-- Per-timesheet totals: total hrs, OT earned, TIL used, vacation used.
create or replace view public.v_timesheet_totals as
with daily as (
  select t.id as timesheet_id, t.user_id, t.week_start,
    sum(e.mon_hrs) as mon, sum(e.tue_hrs) as tue, sum(e.wed_hrs) as wed,
    sum(e.thu_hrs) as thu, sum(e.fri_hrs) as fri, sum(e.sat_hrs) as sat, sum(e.sun_hrs) as sun,
    -- daily totals excluding TIL Payout rows (for OT calc)
    sum(case when sc.name = 'TIL Payout' then 0 else e.mon_hrs end) as mon_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.tue_hrs end) as tue_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.wed_hrs end) as wed_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.thu_hrs end) as thu_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.fri_hrs end) as fri_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.sat_hrs end) as sat_ot_base,
    sum(case when sc.name = 'TIL Payout' then 0 else e.sun_hrs end) as sun_ot_base,
    coalesce(sum(case when sc.consumes_til then e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs else 0 end), 0) as til_used,
    coalesce(sum(case when sc.consumes_vacation then e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs else 0 end), 0) as vacation_used
  from public.timesheets t
  left join public.timesheet_entries e on e.timesheet_id = t.id
  left join public.sub_categories sc on sc.id = e.sub_category_id
  group by t.id, t.user_id, t.week_start
)
select timesheet_id, user_id, week_start,
  coalesce(mon,0)+coalesce(tue,0)+coalesce(wed,0)+coalesce(thu,0)+coalesce(fri,0)+coalesce(sat,0)+coalesce(sun,0) as total_hrs,
  greatest(coalesce(mon_ot_base,0)-8,0) + greatest(coalesce(tue_ot_base,0)-8,0)
    + greatest(coalesce(wed_ot_base,0)-8,0) + greatest(coalesce(thu_ot_base,0)-8,0)
    + greatest(coalesce(fri_ot_base,0)-8,0) + greatest(coalesce(sat_ot_base,0)-8,0)
    + greatest(coalesce(sun_ot_base,0)-8,0) as overtime_earned,
  til_used,
  vacation_used
from daily;

-- Weekly daily breakdown per category (for the report screen).
create or replace view public.v_weekly_report as
select t.id as timesheet_id, t.user_id, t.week_start,
  e.main_category, sc.name as sub_category,
  p.project_number,
  e.description,
  e.mon_hrs, e.tue_hrs, e.wed_hrs, e.thu_hrs, e.fri_hrs, e.sat_hrs, e.sun_hrs,
  e.row_total
from public.timesheets t
join public.timesheet_entries e on e.timesheet_id = t.id
join public.sub_categories sc on sc.id = e.sub_category_id
left join public.projects p on p.id = e.project_id;

-- Latest non-stale TIL balance per user.
create or replace view public.v_til_balance as
select distinct on (user_id) user_id, week_start, closing_balance
from public.til_ledger
where not stale
order by user_id, week_start desc;

create or replace view public.v_vacation_balance as
select distinct on (user_id) user_id, week_start, closing_balance
from public.vacation_ledger
where not stale
order by user_id, week_start desc;

grant select on public.v_timesheet_totals, public.v_weekly_report,
                public.v_til_balance, public.v_vacation_balance
  to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0012_views.sql
git commit -m "feat(db): reporting views"
```

---

### Task 14: RPC `create_or_get_week`

**Files:**
- Create: `supabase/migrations/20260623_0013_rpc_week.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0013_rpc_week.sql`:
```sql
create or replace function public.create_or_get_week(p_week_start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org  uuid;
  v_id   uuid;
begin
  if v_user is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if extract(dow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday' using errcode='22023';
  end if;
  select org_id into v_org from public.users where id = v_user;
  if v_org is null then raise exception 'user has no org' using errcode='42501'; end if;

  insert into public.timesheets(user_id, org_id, week_start)
  values (v_user, v_org, p_week_start)
  on conflict (user_id, week_start) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.timesheets
      where user_id = v_user and week_start = p_week_start;
  end if;
  return v_id;
end$$;

grant execute on function public.create_or_get_week(date) to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0013_rpc_week.sql
git commit -m "feat(db): RPC create_or_get_week"
```

---

### Task 15: RPC `submit_timesheet`

**Files:**
- Create: `supabase/migrations/20260623_0014_rpc_submit.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0014_rpc_submit.sql`:
```sql
create or replace function public.submit_timesheet(p_timesheet_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ts   record;
  v_bad  int;
begin
  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.user_id <> v_user then raise exception 'not owner' using errcode='42501'; end if;
  if v_ts.status not in ('draft','declined') then
    raise exception 'cannot submit from status %', v_ts.status using errcode='22023';
  end if;

  -- must have at least one entry
  if not exists (select 1 from public.timesheet_entries where timesheet_id = p_timesheet_id) then
    raise exception 'timesheet has no entries' using errcode='22023';
  end if;

  -- description empty? guarded by CHECK, but double-check
  select count(*) into v_bad from public.timesheet_entries
   where timesheet_id = p_timesheet_id and length(trim(description)) = 0;
  if v_bad > 0 then raise exception '% entries with empty description', v_bad using errcode='22023'; end if;

  update public.timesheets
     set status='submitted', submitted_at=now(), updated_at=now(),
         decline_reason = null
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_user, 'submit', null);
end$$;

grant execute on function public.submit_timesheet(uuid) to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0014_rpc_submit.sql
git commit -m "feat(db): RPC submit_timesheet"
```

---

### Task 16: RPC `approve_timesheet` (with ledger freeze)

**Files:**
- Create: `supabase/migrations/20260623_0015_rpc_approve.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0015_rpc_approve.sql`:
```sql
-- Helper: get most recent non-stale closing balance for a user before a given date.
-- Falls back to 0 if no ledger row exists (admin should seed opening balance for new users).
create or replace function public.prior_til_balance(p_user uuid, p_week date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select closing_balance from public.til_ledger
     where user_id = p_user and not stale and week_start < p_week
     order by week_start desc limit 1
  ), 0);
$$;

create or replace function public.prior_vacation_balance(p_user uuid, p_week date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select closing_balance from public.vacation_ledger
     where user_id = p_user and not stale and week_start < p_week
     order by week_start desc limit 1
  ), 0);
$$;

create or replace function public.approve_timesheet(p_timesheet_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_tot   record;
  v_open_til  numeric; v_open_vac numeric;
begin
  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'submitted' then
    raise exception 'can only approve submitted timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  select * into v_tot from public.v_timesheet_totals where timesheet_id = p_timesheet_id;
  v_open_til := public.prior_til_balance(v_ts.user_id, v_ts.week_start);
  v_open_vac := public.prior_vacation_balance(v_ts.user_id, v_ts.week_start);

  insert into public.til_ledger(user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_til, coalesce(v_tot.overtime_earned,0), coalesce(v_tot.til_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        overtime_earned = excluded.overtime_earned,
        til_used        = excluded.til_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  insert into public.vacation_ledger(user_id, week_start, opening_balance, vacation_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_vac, coalesce(v_tot.vacation_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        vacation_used   = excluded.vacation_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  update public.timesheets
     set status='approved', decided_at=now(), decided_by=v_actor, locked=true, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'approve', p_comment);
end$$;

grant execute on function public.approve_timesheet(uuid, text) to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0015_rpc_approve.sql
git commit -m "feat(db): RPC approve_timesheet with ledger freeze"
```

---

### Task 17: RPC `decline_timesheet`

**Files:**
- Create: `supabase/migrations/20260623_0016_rpc_decline.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0016_rpc_decline.sql`:
```sql
create or replace function public.decline_timesheet(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
begin
  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'decline reason required' using errcode='22023';
  end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'submitted' then
    raise exception 'can only decline submitted timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  update public.timesheets
     set status='declined', decided_at=now(), decided_by=v_actor,
         decline_reason=p_reason, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'decline', p_reason);
end$$;

grant execute on function public.decline_timesheet(uuid, text) to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0016_rpc_decline.sql
git commit -m "feat(db): RPC decline_timesheet"
```

---

### Task 18: RPC `unlock_timesheet` with ledger cascade

**Files:**
- Create: `supabase/migrations/20260623_0017_rpc_unlock.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260623_0017_rpc_unlock.sql`:
```sql
create or replace function public.unlock_timesheet(p_timesheet_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
begin
  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unlock reason required' using errcode='22023';
  end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'approved' then
    raise exception 'can only unlock approved timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  -- Mark this and every later frozen ledger row as stale (so balances exclude them).
  update public.til_ledger      set stale = true
   where user_id = v_ts.user_id and week_start >= v_ts.week_start;
  update public.vacation_ledger set stale = true
   where user_id = v_ts.user_id and week_start >= v_ts.week_start;

  -- Revert status to declined so employee can edit.
  update public.timesheets
     set status='declined', locked=false, decided_at=now(), decided_by=v_actor,
         decline_reason='[unlocked] ' || p_reason, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'unlock', p_reason);
end$$;

-- After approve_timesheet runs on a re-submitted week, recompute every later approved
-- week's ledger so balances stay consistent. Called as part of the unlock cascade on
-- re-approval.
create or replace function public.recompute_cascade(p_user uuid, p_from_week date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ts record;
  v_tot record;
  v_open_til numeric;
  v_open_vac numeric;
begin
  for v_ts in
    select * from public.timesheets
     where user_id = p_user and status='approved' and week_start > p_from_week
     order by week_start
  loop
    select * into v_tot from public.v_timesheet_totals where timesheet_id = v_ts.id;
    v_open_til := public.prior_til_balance(p_user, v_ts.week_start);
    v_open_vac := public.prior_vacation_balance(p_user, v_ts.week_start);

    insert into public.til_ledger(user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by)
    values (p_user, v_ts.week_start, v_open_til, coalesce(v_tot.overtime_earned,0), coalesce(v_tot.til_used,0), true, v_ts.decided_by)
    on conflict (user_id, week_start) do update
      set opening_balance = excluded.opening_balance,
          overtime_earned = excluded.overtime_earned,
          til_used        = excluded.til_used,
          frozen          = true,
          stale           = false;

    insert into public.vacation_ledger(user_id, week_start, opening_balance, vacation_used, frozen, approved_by)
    values (p_user, v_ts.week_start, v_open_vac, coalesce(v_tot.vacation_used,0), true, v_ts.decided_by)
    on conflict (user_id, week_start) do update
      set opening_balance = excluded.opening_balance,
          vacation_used   = excluded.vacation_used,
          frozen          = true,
          stale           = false;

    insert into public.approval_log(timesheet_id, actor_id, action, comment)
    values (v_ts.id, auth.uid(), 'ledger_recompute', 'cascade after unlock of week ' || p_from_week);
  end loop;
end$$;

-- Wrap approve to trigger cascade if a previously-stale week is being re-approved.
create or replace function public.approve_timesheet(p_timesheet_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_ts    record;
  v_tot   record;
  v_open_til numeric; v_open_vac numeric;
  v_was_unlocked boolean;
begin
  if not public.is_admin(v_actor) then raise exception 'admin only' using errcode='42501'; end if;

  select * into v_ts from public.timesheets where id = p_timesheet_id for update;
  if not found then raise exception 'timesheet not found' using errcode='22023'; end if;
  if v_ts.status <> 'submitted' then
    raise exception 'can only approve submitted timesheets (current: %)', v_ts.status using errcode='22023';
  end if;

  select exists(
    select 1 from public.til_ledger
     where user_id = v_ts.user_id and week_start = v_ts.week_start and stale
  ) into v_was_unlocked;

  select * into v_tot from public.v_timesheet_totals where timesheet_id = p_timesheet_id;
  v_open_til := public.prior_til_balance(v_ts.user_id, v_ts.week_start);
  v_open_vac := public.prior_vacation_balance(v_ts.user_id, v_ts.week_start);

  insert into public.til_ledger(user_id, week_start, opening_balance, overtime_earned, til_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_til, coalesce(v_tot.overtime_earned,0), coalesce(v_tot.til_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        overtime_earned = excluded.overtime_earned,
        til_used        = excluded.til_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  insert into public.vacation_ledger(user_id, week_start, opening_balance, vacation_used, frozen, approved_by)
  values (v_ts.user_id, v_ts.week_start, v_open_vac, coalesce(v_tot.vacation_used,0), true, v_actor)
  on conflict (user_id, week_start) do update
    set opening_balance = excluded.opening_balance,
        vacation_used   = excluded.vacation_used,
        frozen          = true,
        stale           = false,
        approved_by     = excluded.approved_by;

  update public.timesheets
     set status='approved', decided_at=now(), decided_by=v_actor, locked=true, updated_at=now()
   where id = p_timesheet_id;

  insert into public.approval_log(timesheet_id, actor_id, action, comment)
  values (p_timesheet_id, v_actor, 'approve', p_comment);

  if v_was_unlocked then
    perform public.recompute_cascade(v_ts.user_id, v_ts.week_start);
  end if;
end$$;

grant execute on function public.unlock_timesheet(uuid, text) to authenticated;
grant execute on function public.recompute_cascade(uuid, date) to authenticated;
```

- [ ] **Step 2: Apply and commit**

```bash
supabase db reset
git add supabase/migrations/20260623_0017_rpc_unlock.sql
git commit -m "feat(db): RPC unlock_timesheet with ledger cascade"
```

---

### Task 19: Seed data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed**

Create `supabase/seed.sql`:
```sql
-- Single org for v1.
insert into public.organizations(id, name)
values ('00000000-0000-0000-0000-000000000001', 'Sulfur Recovery Engineering Inc.')
on conflict do nothing;

-- Positions with annual vacation hours.
insert into public.positions(org_id, name, annual_vacation_hours) values
  ('00000000-0000-0000-0000-000000000001', 'Process Engineer EIT', 120),
  ('00000000-0000-0000-0000-000000000001', 'Admin',                200),
  ('00000000-0000-0000-0000-000000000001', 'Senior Engineer',      200),
  ('00000000-0000-0000-0000-000000000001', 'Sales & Marketing',    160)
on conflict do nothing;

-- Sub-categories.
insert into public.sub_categories(main_category, name, requires_project, consumes_til, consumes_vacation, is_overtime_taken, sort_order) values
  ('Project','Travel',              true,  false, false, false, 10),
  ('Project','Site Travel',         true,  false, false, false, 20),
  ('Project','Site Work',           true,  false, false, false, 30),
  ('Project','Report',              true,  false, false, false, 40),
  ('Project','Extra Integration',   true,  false, false, false, 50),
  ('Project','Simulation',          true,  false, false, false, 60),
  ('Project','Office Preparation',  true,  false, false, false, 70),
  ('Project','Project Management',  true,  false, false, false, 80),
  ('Project','Engineering Work',    true,  false, false, false, 90),
  ('Admin','Overtime Taken',        false, true,  false, true,  10),
  ('Admin','TIL Payout',            false, true,  false, false, 20),
  ('Admin','Sick Time',             false, false, false, false, 30),
  ('Admin','Vacation Hours',        false, false, true,  false, 40),
  ('Admin','Statutory Holiday',     false, false, false, false, 50),
  ('Admin','Administrative',        false, false, false, false, 60),
  ('Admin','Toolbox Meeting',       false, false, false, false, 70),
  ('Office & Sales','Customer Contact',    false, false, false, false, 10),
  ('Office & Sales','Project Development', false, false, false, false, 20),
  ('Office & Sales','Proposals & Quotes',  false, false, false, false, 30),
  ('Office & Sales','Inventory',           false, false, false, false, 40),
  ('Office & Sales','SRU Study',           false, false, false, false, 50),
  ('Office & Sales','Conference',          false, false, false, false, 60),
  ('Office & Sales','General',             false, false, false, false, 70)
on conflict (main_category, name) do nothing;
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
supabase db reset
supabase db psql -c "select count(*) from public.sub_categories;"
```
Expected: `count = 23`.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed org, positions, sub_categories"
```

---

### Task 20: Test helpers

**Files:**
- Create: `supabase/tests/helpers.sql`

- [ ] **Step 1: Write helpers**

Create `supabase/tests/helpers.sql`:
```sql
-- Helper to provision an auth.user + public.users row + role inside a test.
-- Tests call: select test_helpers.make_user('emp1@x', 'employee', 'Alice', 'E001');
create schema if not exists test_helpers;

create or replace function test_helpers.make_user(
  p_email text,
  p_role  text,
  p_name  text,
  p_code  text,
  p_position text default 'Senior Engineer'
) returns uuid language plpgsql as $$
declare
  v_uid uuid := gen_random_uuid();
  v_pos uuid;
begin
  insert into auth.users(id, email) values (v_uid, p_email);
  select id into v_pos from public.positions where name = p_position limit 1;
  insert into public.users(id, org_id, full_name, email, employee_code, position_id)
  values (v_uid, '00000000-0000-0000-0000-000000000001', p_name, p_email, p_code, v_pos);
  insert into public.user_roles(user_id, role) values (v_uid, p_role::public.app_role);
  return v_uid;
end$$;

-- Switch the active auth.uid() for the rest of the transaction.
create or replace function test_helpers.set_auth(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text)::text, true);
  perform set_config('role', 'authenticated', true);
end$$;

create or replace function test_helpers.sub_id(p_name text) returns uuid language sql stable as $$
  select id from public.sub_categories where name = p_name limit 1;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/tests/helpers.sql
git commit -m "test(db): test helpers (make_user, set_auth, sub_id)"
```

---

### Task 21: RLS tests for timesheets

**Files:**
- Create: `supabase/tests/02_rls_timesheets.sql`

- [ ] **Step 1: Write test**

Create `supabase/tests/02_rls_timesheets.sql`:
```sql
begin;
\i supabase/tests/helpers.sql
select plan(5);

-- Two employees + one admin
select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('bob@x','employee','Bob','E002')     as bob \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm \gset

-- Alice creates her week
select test_helpers.set_auth(:'alice'::uuid);
select lives_ok(
  $$ select public.create_or_get_week(date '2026-04-06'); $$,
  'alice can create her week'
);

-- Bob cannot see Alice's timesheet
select test_helpers.set_auth(:'bob'::uuid);
select is(
  (select count(*) from public.timesheets where user_id = :'alice'::uuid),
  0::bigint,
  'bob cannot see alice timesheets'
);

-- Bob cannot insert a timesheet for Alice
select throws_ok(
  format($$ insert into public.timesheets(user_id, org_id, week_start)
            values (%L, '00000000-0000-0000-0000-000000000001', date '2026-04-06') $$, :'alice'),
  'new row violates row-level security policy for table "timesheets"',
  'bob cannot insert timesheet for alice'
);

-- Admin can see Alice's timesheet
select test_helpers.set_auth(:'adm'::uuid);
select is(
  (select count(*) from public.timesheets where user_id = :'alice'::uuid),
  1::bigint,
  'admin sees alice timesheets'
);

-- Bob cannot manually change his status to submitted (must go via RPC)
select test_helpers.set_auth(:'bob'::uuid);
select public.create_or_get_week(date '2026-04-06') as ts_bob \gset
select throws_like(
  format($$ update public.timesheets set status='submitted' where id=%L $$, :'ts_bob'),
  '%status may only be changed via RPC%',
  'direct status change blocked'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run and verify**

Run:
```bash
supabase test db
```
Expected: all assertions in `02_rls_timesheets.sql` pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/02_rls_timesheets.sql
git commit -m "test(db): RLS for timesheets"
```

---

### Task 22: RPC tests — submit, approve, decline

**Files:**
- Create: `supabase/tests/04_rpc_submit.sql`
- Create: `supabase/tests/05_rpc_approve_decline.sql`

- [ ] **Step 1: Write submit test**

Create `supabase/tests/04_rpc_submit.sql`:
```sql
begin;
\i supabase/tests/helpers.sql
select plan(4);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset

select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as tid \gset

-- Empty timesheet: submit fails
select throws_like(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  '%no entries%',
  'submit blocked on empty timesheet'
);

-- Add a valid Admin entry
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, description)
values (:'tid', 'Admin', test_helpers.sub_id('Sick Time'), 8, 'flu');

-- Now submit works
select lives_ok(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  'submit succeeds with one entry'
);

-- Status should be submitted
select is(
  (select status::text from public.timesheets where id = :'tid'),
  'submitted',
  'status is submitted'
);

-- Trying to re-submit (already submitted) fails
select throws_like(
  format($$ select public.submit_timesheet(%L) $$, :'tid'),
  '%cannot submit from status%',
  'cannot submit twice'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Write approve/decline test**

Create `supabase/tests/05_rpc_approve_decline.sql`:
```sql
begin;
\i supabase/tests/helpers.sql
select plan(6);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm   \gset

-- Alice files a week with overtime
select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as tid \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'tid', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 10, 8, 8, 'work');
select public.submit_timesheet(:'tid');

-- Alice cannot approve
select throws_like(
  format($$ select public.approve_timesheet(%L) $$, :'tid'),
  '%admin only%',
  'employee cannot approve'
);

-- Admin approves
select test_helpers.set_auth(:'adm'::uuid);
select lives_ok(
  format($$ select public.approve_timesheet(%L, 'looks good') $$, :'tid'),
  'admin approves'
);

select is(
  (select status::text from public.timesheets where id = :'tid'),
  'approved',
  'status is approved'
);
select is(
  (select locked from public.timesheets where id = :'tid'),
  true,
  'timesheet is locked'
);

-- Ledger row exists, overtime = (10-8)+(10-8)+(10-8) = 6
select is(
  (select overtime_earned from public.til_ledger where week_start = date '2026-04-06')::numeric,
  6::numeric,
  'TIL ledger overtime computed'
);

-- Approval log has 2 entries: submit + approve
select is(
  (select count(*) from public.approval_log where timesheet_id = :'tid'),
  2::bigint,
  'approval_log has submit + approve'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run and verify**

Run:
```bash
supabase test db
```
Expected: every test file passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/04_rpc_submit.sql supabase/tests/05_rpc_approve_decline.sql
git commit -m "test(db): RPC submit/approve/decline"
```

---

### Task 23: RPC test — unlock cascade

**Files:**
- Create: `supabase/tests/06_rpc_unlock_cascade.sql`

- [ ] **Step 1: Write test**

Create `supabase/tests/06_rpc_unlock_cascade.sql`:
```sql
begin;
\i supabase/tests/helpers.sql
select plan(4);

select test_helpers.make_user('alice@x','employee','Alice','E001') as alice \gset
select test_helpers.make_user('admin@x','admin','Admin','A001')    as adm   \gset

-- Week 1: 6h OT
select test_helpers.set_auth(:'alice'::uuid);
select public.create_or_get_week(date '2026-04-06') as t1 \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'t1', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 10, 8, 8, 'wk1');
select public.submit_timesheet(:'t1');

-- Week 2: 4h OT
select public.create_or_get_week(date '2026-04-13') as t2 \gset
insert into public.timesheet_entries(timesheet_id, main_category, sub_category_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, description)
values (:'t2', 'Admin', test_helpers.sub_id('Administrative'), 10, 10, 8, 8, 8, 'wk2');
select public.submit_timesheet(:'t2');

-- Admin approves both
select test_helpers.set_auth(:'adm'::uuid);
select public.approve_timesheet(:'t1');
select public.approve_timesheet(:'t2');

-- Week 2 closing should be 6 (wk1) + 4 (wk2) = 10
select is(
  (select closing_balance from public.til_ledger where user_id = :'alice'::uuid and week_start = date '2026-04-13' and not stale)::numeric,
  10::numeric,
  'wk2 closing reflects wk1 carry-forward'
);

-- Admin unlocks week 1
select public.unlock_timesheet(:'t1', 'fix typo');

-- Week 1 status is declined, both ledger rows are stale
select is(
  (select status::text from public.timesheets where id = :'t1'),
  'declined',
  'unlocked week reverts to declined'
);
select is(
  (select count(*) from public.til_ledger
    where user_id = :'alice'::uuid and stale
      and week_start in (date '2026-04-06', date '2026-04-13')),
  2::bigint,
  'both ledger rows marked stale by unlock'
);

-- Alice fixes wk1 (add 2 more OT hrs) and resubmits
select test_helpers.set_auth(:'alice'::uuid);
update public.timesheet_entries set mon_hrs = 12 where timesheet_id = :'t1';
select public.submit_timesheet(:'t1');
select test_helpers.set_auth(:'adm'::uuid);
select public.approve_timesheet(:'t1');

-- After cascade, wk2 closing should now be 8 (new wk1) + 4 = 12
select is(
  (select closing_balance from public.til_ledger where user_id = :'alice'::uuid and week_start = date '2026-04-13' and not stale)::numeric,
  12::numeric,
  'cascade recomputed wk2 closing'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run and verify**

Run:
```bash
supabase test db
```
Expected: all assertions across all test files pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/06_rpc_unlock_cascade.sql
git commit -m "test(db): unlock cascade scenario"
```

---

### Task 24: Final sweep + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full test suite one more time**

Run:
```bash
supabase db reset && supabase test db
```
Expected: every test file reports `ok` and `# Tests passed`.

- [ ] **Step 2: Update README with finished status**

Replace `README.md` content:
```markdown
# SRE Timesheet

Web app replacing the SRE Inc. weekly timesheet Excel workbook.

See `docs/specs/2026-06-23-sre-timesheet-design.md` for the design and
`docs/plans/` for implementation plans.

## Plan 1: Supabase Foundation — COMPLETE

The backend is feature-complete. Run locally:

    supabase start
    supabase db reset    # applies migrations + seed
    supabase test db     # runs pgTAP tests

## What's next

- Plan 2: Employee web app (Next.js + Supabase Auth)
- Plan 3: Admin web app (approvals, user/project management)
- Plan 4: Historical importer (Excel → DB)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: mark Plan 1 complete"
```

---

## Plans 2–4 (outline only — to be expanded when started)

### Plan 2: Employee Web App

Goal: Next.js 15 App Router app that lets an employee sign in, edit and submit their weekly timesheet, and view the weekly report + their TIL/vacation history.

Tasks (high level):
1. Scaffold Next.js 15 + Tailwind v4 + shadcn/ui + Supabase JS in `apps/web/`.
2. Auth: `/login` page supporting both magic-link and email/password.
3. Layout shell: header, status banner slot, KPI strip slot.
4. Design tokens (CSS custom properties) per §7 of spec.
5. `useWeek(weekStart)` hook backed by `create_or_get_week` RPC + TanStack Query.
6. Cascading category / sub-category dropdown component.
7. Project number typeahead component (read-only for employees).
8. Entry table component (rows, daily hour inputs, row total, inline validation badges).
9. Live KPI computation (mirrors `v_timesheet_totals`).
10. Submit flow: client validation → `submit_timesheet` RPC → status badge update.
11. `/week/[week_start]/report` read-only report screen.
12. `/me/til` and `/me/vacation` ledger history pages.
13. Playwright E2E: create week → add entries → submit; re-edit after decline; cannot edit approved.
14. Visual regression snapshots (light + dark, populated + empty + locked).

### Plan 3: Admin Web App

Goal: Admin surfaces for approval queue, user/project/position management, approval-log browsing, unlock flow.

Tasks (high level):
1. `/admin` approval queue: list submitted timesheets with KPIs.
2. `/admin/employees/[id]/week/[ws]` read-only week with sticky approve/decline actions.
3. Decline modal (mandatory reason).
4. Unlock modal (mandatory reason) on approved week view.
5. `/admin/users`: create/edit users, assign roles, set position, set opening TIL + vacation.
6. `/admin/projects`: create/edit/close project numbers; format validation matches DB CHECK.
7. `/admin/positions`: edit annual_vacation_hours per position.
8. `/admin/approvals`: full approval log table, filterable by employee/date/action.
9. Permission gating: middleware redirects non-admins.
10. Playwright E2E: submit → admin approves → cascade on unlock → re-approve.

### Plan 4: Historical Importer

Goal: Bring existing Excel workbooks (`UC_SRE_Timesheet_Templet_2026.xlsx`-shape) and a balances-snapshot CSV into the DB.

Tasks (high level):
1. `scripts/import/` Python project (openpyxl, supabase-py, click).
2. CSV balances mode: parse, validate, dry-run diff, commit.
3. Excel history mode: parse one workbook → series of `timesheet` + entries.
4. Idempotent commit (uses unique key + content hash).
5. `/admin/import` UI: upload, dry-run preview, commit button.
6. End-to-end test: import the provided sample workbook, assert TIL and vacation balances match the spreadsheet's `📊 TIL Summary` and `🏖 Vacation Summary` rows.

---

## Self-Review Notes

- **Spec coverage:** §2 entities → Tasks 3–8. §3 business rules → CHECK constraints in 5/6, RPC validation in 14–18, view math in 13. §4 ABAC → Tasks 9–12. §5 architecture → all of Plan 1. §6.3 unlock cascade → Task 18 + test 23. §9a historical import → Plan 4 outline. §10 v1.1 (email notifications) → deferred. §11 repo layout → followed (`supabase/`). §12 confirmed decisions → all reflected.
- **Placeholders:** none.
- **Type consistency:** function and column names (`create_or_get_week`, `submit_timesheet`, `approve_timesheet`, `decline_timesheet`, `unlock_timesheet`, `recompute_cascade`, `prior_til_balance`, `prior_vacation_balance`, `v_timesheet_totals`, `v_til_balance`, `v_vacation_balance`, `v_weekly_report`, `til_ledger`, `vacation_ledger`, `approval_log`, `timesheets`, `timesheet_entries`, `sub_categories`, `main_category`, `requires_project`, `consumes_til`, `consumes_vacation`, `is_overtime_taken`) used consistently across all tasks.
