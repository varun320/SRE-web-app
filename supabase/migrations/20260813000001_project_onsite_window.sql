-- On-site window on projects. Utsav's Aug-13 feedback: the "deadline" was
-- conflating two dates that are separate in the real workflow:
--   · when the crew is physically on site (a fixed contractual window)
--   · when the final report is due (usually days/weeks after leaving site)
--
-- Model:
--   has_onsite       BOOLEAN — false for desktop-only work
--   onsite_start     DATE    — nullable if has_onsite = false
--   onsite_end       DATE    — nullable if has_onsite = false
--   deadline         DATE    — now explicitly "report submission date"
--                              (existing column, semantic only)
--
-- Task-generation anchors shift accordingly (see updated RPCs below):
--   phase 'pre'    → coalesce(onsite_start, deadline) − 14
--   phase 'during' → coalesce(onsite_start, deadline) − 6 for the anchor,
--                     but real work happens across [onsite_start, onsite_end]
--   phase 'post'   → deadline − 1

alter table public.projects
  add column has_onsite   boolean not null default false,
  add column onsite_start date,
  add column onsite_end   date,
  add constraint projects_onsite_window_valid
    check (
      (not has_onsite and onsite_start is null and onsite_end is null)
      or
      (has_onsite and onsite_start is not null and onsite_end is not null and onsite_start <= onsite_end)
    );

create index on public.projects(onsite_start);
create index on public.projects(onsite_end);

-- ── Updated RPCs ────────────────────────────────────────────────────────
-- create_project_from_template: adopts on-site parameters.

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
  p_accent_color   text default null,
  p_has_onsite     boolean default false,
  p_onsite_start   date default null,
  p_onsite_end     date default null
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
  v_pre_anchor  date := coalesce(p_onsite_start, p_deadline);
  v_dur_anchor  date := coalesce(p_onsite_start, p_deadline);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  insert into public.projects (
    org_id, project_number, name, status, client_id, site_id, contact_id,
    template_id, scope_title, phase, deadline, lead_id, accent_color,
    has_onsite, onsite_start, onsite_end
  )
  values (
    v_org_id, p_project_number, p_name, 'active', p_client_id, p_site_id, p_contact_id,
    p_template_id, p_scope_title, 'pre', p_deadline, p_lead_id, p_accent_color,
    p_has_onsite, p_onsite_start, p_onsite_end
  )
  returning id into v_project_id;

  insert into public.project_team_members (project_id, user_id)
  select v_project_id, unnest(p_team_ids || array[p_lead_id])
  on conflict do nothing;

  for r_section in
    select id, phase, name, sort_order
    from public.template_sections
    where template_id = p_template_id
    order by phase, sort_order
  loop
    v_due := case r_section.phase
      when 'pre'    then v_pre_anchor - 14
      when 'during' then v_dur_anchor - 6
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

grant execute on function public.create_project_from_template(
  int, text, text, uuid, uuid, uuid, uuid, uuid, date, uuid[], text, boolean, date, date
) to authenticated;

-- apply_template_to_project: also uses on-site window from the project row.

create or replace function public.apply_template_to_project(
  p_project_id  uuid,
  p_template_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id      uuid;
  v_lead_id     uuid;
  v_deadline    date;
  v_onsite_start date;
  v_pre_anchor  date;
  v_dur_anchor  date;
  v_existing    int;
  v_inserted    int := 0;
  r_section     record;
  r_task        record;
  v_due         date;
begin
  select org_id, lead_id, deadline, onsite_start
    into v_org_id, v_lead_id, v_deadline, v_onsite_start
  from public.projects where id = p_project_id;

  if v_org_id is null then raise exception 'project not found'; end if;
  if v_deadline is null then raise exception 'set deadline before applying template'; end if;
  if v_lead_id is null then raise exception 'set project lead before applying template'; end if;

  v_pre_anchor := coalesce(v_onsite_start, v_deadline);
  v_dur_anchor := coalesce(v_onsite_start, v_deadline);

  select count(*) into v_existing from public.tasks where project_id = p_project_id;
  if v_existing > 0 then return 0; end if;

  for r_section in
    select id, phase, name, sort_order
    from public.template_sections
    where template_id = p_template_id
    order by phase, sort_order
  loop
    v_due := case r_section.phase
      when 'pre'    then v_pre_anchor - 14
      when 'during' then v_dur_anchor - 6
      when 'post'   then v_deadline - 1
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
      ) values (
        v_org_id, p_project_id, r_section.name, r_section.phase, r_task.title,
        v_lead_id, v_due, r_task.default_priority, 'todo',
        r_section.sort_order * 100 + r_task.sort_order
      );
      v_inserted := v_inserted + 1;
    end loop;
  end loop;

  return v_inserted;
end;
$$;
