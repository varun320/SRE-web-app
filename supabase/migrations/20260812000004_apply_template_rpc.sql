-- Generate tasks for an existing project from a template. Mirrors the
-- task-generation half of create_project_from_template so legacy rows
-- can be "adopted" into the PM flow without duplicating them.
--
-- Safety: no-op if tasks already exist for the project. Prevents accidental
-- double-generation if someone hits Edit → Save twice.

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
  v_org_id   uuid;
  v_lead_id  uuid;
  v_deadline date;
  v_existing int;
  v_inserted int := 0;
  r_section  record;
  r_task     record;
  v_due      date;
begin
  select org_id, lead_id, deadline
    into v_org_id, v_lead_id, v_deadline
  from public.projects where id = p_project_id;

  if v_org_id is null then raise exception 'project not found'; end if;
  if v_deadline is null then raise exception 'set deadline before applying template'; end if;
  if v_lead_id is null then raise exception 'set project lead before applying template'; end if;

  select count(*) into v_existing from public.tasks where project_id = p_project_id;
  if v_existing > 0 then return 0; end if;

  for r_section in
    select id, phase, name, sort_order
    from public.template_sections
    where template_id = p_template_id
    order by phase, sort_order
  loop
    v_due := case r_section.phase
      when 'pre'    then v_deadline - 14
      when 'during' then v_deadline - 6
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

grant execute on function public.apply_template_to_project(uuid, uuid) to authenticated;
