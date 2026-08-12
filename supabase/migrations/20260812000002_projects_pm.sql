-- Projects (project-management) — Phase 1 read-only foundation.
--
-- Reuses the existing lightweight `projects` lookup (project_number, name) and
-- adds the fields the Projects dashboard needs: phase, deadline, lead, team,
-- tasks. Contacts/sites/templates deferred until Phase 3 (Create Job flow).

create type public.project_phase as enum ('pre', 'during', 'post');
create type public.task_priority as enum ('low', 'med', 'high');
create type public.task_status   as enum ('todo', 'doing', 'done');

alter table public.projects
  add column client_id     uuid references public.clients(id),
  add column scope_title   text,
  add column phase         public.project_phase not null default 'pre',
  add column deadline      date,
  add column lead_id       uuid references public.users(id),
  add column accent_color  text,
  add column contact_name  text,
  add column contact_email text;

create index on public.projects(client_id);
create index on public.projects(lead_id);
create index on public.projects(deadline);

-- Team members on a project (many-to-many with users).
create table public.project_team_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id)    on delete cascade,
  primary key (project_id, user_id)
);
create index on public.project_team_members(user_id);

-- Tasks — the core of the dashboard.
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id),
  project_id   uuid not null references public.projects(id) on delete cascade,
  section_name text,
  phase        public.project_phase not null default 'pre',
  title        text not null,
  assignee_id  uuid references public.users(id),
  due_date     date,
  priority     public.task_priority not null default 'med',
  status       public.task_status   not null default 'todo',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.tasks(project_id);
create index on public.tasks(assignee_id);
create index on public.tasks(due_date);
create index on public.tasks(status);

-- Progress view: % of tasks done per project. Computed on read.
create or replace view public.v_project_progress as
select p.id as project_id,
       count(t.id) filter (where t.status = 'done')::int as done_count,
       count(t.id)::int                                  as total_count,
       case when count(t.id) = 0 then 0
            else round(100.0 * count(t.id) filter (where t.status = 'done') / count(t.id))::int
       end as progress_pct
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

-- RLS: Directory-style. Every authenticated user in the org can read all
-- projects/tasks (shared library). Writes require org membership + either
-- team membership on the project OR admin role.

alter table public.project_team_members enable row level security;
alter table public.tasks enable row level security;

create policy ptm_read on public.project_team_members
  for select to authenticated using (
    exists (select 1 from public.projects p
             where p.id = project_id and p.org_id = public.current_user_org())
  );
create policy ptm_write on public.project_team_members
  for all to authenticated using (
    public.is_admin(auth.uid())
  ) with check (
    public.is_admin(auth.uid())
  );

create policy tasks_read on public.tasks
  for select to authenticated using (org_id = public.current_user_org());
create policy tasks_write on public.tasks
  for all to authenticated using (
    org_id = public.current_user_org()
    and (
      public.is_admin(auth.uid())
      or exists (select 1 from public.project_team_members m
                  where m.project_id = tasks.project_id
                    and m.user_id = auth.uid())
    )
  ) with check (
    org_id = public.current_user_org()
    and (
      public.is_admin(auth.uid())
      or exists (select 1 from public.project_team_members m
                  where m.project_id = tasks.project_id
                    and m.user_id = auth.uid())
    )
  );

grant select on public.v_project_progress to authenticated;
