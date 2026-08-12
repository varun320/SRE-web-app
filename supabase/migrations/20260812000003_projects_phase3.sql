-- Projects Phase 3 — templates, Directory (contacts + sites), and the
-- FKs the New Job flow needs on projects. Templates seeded from the
-- design_handoff_sre_projects prototype.
--
-- Directory tables are shared read-only for the whole org — same pattern
-- as clients — so Part B (CRM) can read from them directly later.

-- ── Directory ────────────────────────────────────────────────────────────
create table public.sites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  address    text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now(),
  check (lat is null or lat between -90 and 90),
  check (lng is null or lng between -180 and 180)
);
create index on public.sites(client_id);

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  role       text,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);
create index on public.contacts(client_id);

alter table public.sites    enable row level security;
alter table public.contacts enable row level security;

create policy sites_read on public.sites
  for select to authenticated using (org_id = public.current_user_org());
create policy sites_write on public.sites
  for all to authenticated
  using (org_id = public.current_user_org())
  with check (org_id = public.current_user_org());

create policy contacts_read on public.contacts
  for select to authenticated using (org_id = public.current_user_org());
create policy contacts_write on public.contacts
  for all to authenticated
  using (org_id = public.current_user_org())
  with check (org_id = public.current_user_org());

-- ── Templates ────────────────────────────────────────────────────────────
create table public.project_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id),
  slug        text not null,  -- 'field_survey', 'amine_study', ...
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, slug)
);

create table public.template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates(id) on delete cascade,
  phase       public.project_phase not null,
  name        text not null,
  sort_order  int not null default 0
);
create index on public.template_sections(template_id);

create table public.template_tasks (
  id               uuid primary key default gen_random_uuid(),
  section_id       uuid not null references public.template_sections(id) on delete cascade,
  title            text not null,
  default_priority public.task_priority not null default 'med',
  sort_order       int not null default 0
);
create index on public.template_tasks(section_id);

alter table public.project_templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks    enable row level security;

create policy tpl_read on public.project_templates
  for select to authenticated using (org_id = public.current_user_org());
create policy tpl_write on public.project_templates
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy tpl_sec_read on public.template_sections
  for select to authenticated using (
    exists (select 1 from public.project_templates t where t.id = template_id and t.org_id = public.current_user_org())
  );
create policy tpl_sec_write on public.template_sections
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy tpl_task_read on public.template_tasks
  for select to authenticated using (
    exists (
      select 1 from public.template_sections s
      join public.project_templates t on t.id = s.template_id
      where s.id = section_id and t.org_id = public.current_user_org()
    )
  );
create policy tpl_task_write on public.template_tasks
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── projects FKs ─────────────────────────────────────────────────────────
alter table public.projects
  add column site_id     uuid references public.sites(id),
  add column contact_id  uuid references public.contacts(id),
  add column template_id uuid references public.project_templates(id);

create index on public.projects(site_id);
create index on public.projects(contact_id);
create index on public.projects(template_id);

-- ── RPC: create project from template ────────────────────────────────────
-- Wraps: insert project + team + tasks from template. Due dates staggered
-- by phase offset from deadline (Pre −14d, During −6d, Post −1d) matching
-- the design prototype.
create or replace function public.create_project_from_template(
  p_project_number int,
  p_name           text,
  p_scope_title    text,
  p_client_id      uuid,
  p_site_id        uuid,
  p_contact_id     uuid,
  p_template_id    uuid,
  p_lead_id        uuid,
  p_deadline       date,
  p_team_ids       uuid[],
  p_accent_color   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_org_id     uuid := current_user_org();
  v_uid        uuid := auth.uid();
  r_section    record;
  r_task       record;
  v_due        date;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.projects (
    org_id, project_number, name, status, client_id, site_id, contact_id,
    template_id, scope_title, phase, deadline, lead_id, accent_color
  )
  values (
    v_org_id, p_project_number, p_name, 'active', p_client_id, p_site_id, p_contact_id,
    p_template_id, p_scope_title, 'pre', p_deadline, p_lead_id, p_accent_color
  )
  returning id into v_project_id;

  -- Team membership. Lead is always on the team.
  insert into public.project_team_members (project_id, user_id)
  select v_project_id, unnest(p_team_ids || array[p_lead_id])
  on conflict do nothing;

  -- Task generation.
  for r_section in
    select id, phase, name, sort_order
    from public.template_sections
    where template_id = p_template_id
    order by phase, sort_order
  loop
    v_due := case r_section.phase
      when 'pre'    then p_deadline - 14
      when 'during' then p_deadline - 6
      when 'post'   then p_deadline - 1
    end;

    for r_task in
      select title, default_priority, sort_order
      from public.template_tasks
      where section_id = r_section.id
      order by sort_order
    loop
      insert into public.tasks (
        org_id, project_id, section_name, phase, title,
        assignee_id, due_date, priority, status, sort_order
      )
      values (
        v_org_id, v_project_id, r_section.name, r_section.phase, r_task.title,
        p_lead_id, v_due, r_task.default_priority, 'todo',
        r_section.sort_order * 100 + r_task.sort_order
      );
    end loop;
  end loop;

  return v_project_id;
end;
$$;

grant execute on function public.create_project_from_template(int, text, text, uuid, uuid, uuid, uuid, uuid, date, uuid[], text) to authenticated;

-- ── Seed templates (single-org apps: use the first org) ──────────────────
do $$
declare
  v_org uuid;
  v_tpl uuid;
  v_sec uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then
    raise notice 'no org yet — skipping template seed';
    return;
  end if;

  -- Field Sampling Survey
  insert into public.project_templates (org_id, slug, name, description)
  values (v_org, 'field_survey', 'Field Sampling Survey', 'On-site sampling job — full pre/during/post workflow')
  returning id into v_tpl;

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Client Contact', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Discuss lab space & location', 1),
    (v_sec, 'Confirm UHP Helium (99.999%)', 2),
    (v_sec, 'Confirm voltage of plug-ins', 3),
    (v_sec, 'Identify plant & control-room contacts', 4),
    (v_sec, 'Confirm site-specific safety requirements', 5),
    (v_sec, 'Request P&IDs on-site', 6);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Admin Work', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Assign personnel to job', 1),
    (v_sec, 'Get PO from client', 2),
    (v_sec, 'Send DCS Data Request sheet', 3),
    (v_sec, 'Arrange kick-off meeting', 4),
    (v_sec, 'Ensure safety tickets valid', 5),
    (v_sec, 'Confirm site-specific training done', 6),
    (v_sec, 'Confirm drug/alcohol/medical tests', 7);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Meetings', 3) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Kick-off: scope, scaffolding, sample points, process sequence', 1);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Travel Arrangements', 4) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Check if work visa needed', 1),
    (v_sec, 'Arrange SCBA rental', 2),
    (v_sec, 'Confirm vehicle requirements', 3),
    (v_sec, 'Book flight / hotel / vehicle (Monica)', 4);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Print Out', 5) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Print JHA, Proposal, PO, travel docs, visa, safety tickets', 1);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Pack Equipment', 6) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Pack Base Kit + job-specific kits', 1);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'during', 'During Work', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Coordinate DCS screenshots with sampling times', 1),
    (v_sec, 'Gather additional site contacts', 2),
    (v_sec, 'Note makers / brands of units on-site', 3),
    (v_sec, 'Mark sample points with tags', 4);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'during', 'Ship Chemicals', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Verify chemicals arrived on site', 1),
    (v_sec, 'Confirm leftover chemical storage', 2);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Project Wrap-up', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Wrap-up meeting: findings & recommendations', 1),
    (v_sec, 'Get timesheet signed by client', 2),
    (v_sec, 'Send invoicing info to Ashley', 3),
    (v_sec, 'Print GS results', 4),
    (v_sec, 'Check all equipment returned', 5);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'SharePoint Updates', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Scan & upload checklist, JHA, FLHAs, accident forms', 1),
    (v_sec, 'Send project survey to client', 2);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Deliverables', 3) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Identify deliverables from proposal', 1),
    (v_sec, 'Update Pit Stop deliverables table', 2),
    (v_sec, 'Complete deliverables within deadline', 3);

  -- Amine Unit Study
  insert into public.project_templates (org_id, slug, name, description)
  values (v_org, 'amine_study', 'Amine Unit Study', 'Rich/lean amine sampling & analysis')
  returning id into v_tpl;

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Client Contact', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Confirm sample points & valves', 1),
    (v_sec, 'Request lab space', 2);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Admin Work', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Get PO from client', 1),
    (v_sec, 'Send DCS Data Request sheet', 2),
    (v_sec, 'Assign personnel', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Meetings', 3) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Kick-off meeting', 1);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'during', 'During Work', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Collect rich / lean amine samples', 1),
    (v_sec, 'Record circulation rates', 2),
    (v_sec, 'Photo-document unit', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Deliverables', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Amine analysis report', 1),
    (v_sec, 'Recommendations memo', 2);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Project Wrap-up', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Send invoicing info to Ashley', 1);

  -- Desktop Performance Review
  insert into public.project_templates (org_id, slug, name, description)
  values (v_org, 'desk_review', 'Desktop Performance Review', 'Data-only study, no field visit')
  returning id into v_tpl;

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Admin Work', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Get PO from client', 1),
    (v_sec, 'Request historical DCS data', 2),
    (v_sec, 'Assign engineer', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'during', 'Analysis', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Build mass balance', 1),
    (v_sec, 'Benchmark vs design', 2),
    (v_sec, 'Identify bottlenecks', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Deliverables', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Draft review report', 1),
    (v_sec, 'Client review call', 2),
    (v_sec, 'Final report + recommendations', 3);

  -- Turnaround Support
  insert into public.project_templates (org_id, slug, name, description)
  values (v_org, 'turnaround', 'Turnaround Support', 'On-site TA / shutdown support')
  returning id into v_tpl;

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Admin Work', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Get PO from client', 1),
    (v_sec, 'Confirm TA window', 2),
    (v_sec, 'Assign field crew', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'pre', 'Travel Arrangements', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Book travel', 1),
    (v_sec, 'Arrange SCBA rental', 2);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'during', 'During Work', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Daily inspection log', 1),
    (v_sec, 'Coordinate with TA manager', 2),
    (v_sec, 'Sample per plan', 3);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Deliverables', 1) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'TA support summary', 1);

  insert into public.template_sections (template_id, phase, name, sort_order) values (v_tpl, 'post', 'Project Wrap-up', 2) returning id into v_sec;
  insert into public.template_tasks (section_id, title, sort_order) values
    (v_sec, 'Timesheets signed', 1),
    (v_sec, 'Send invoicing info to Ashley', 2);
end $$;
