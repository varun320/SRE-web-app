import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectRow, TaskRow } from './types';

export async function fetchNextProjectNumber(sb: SupabaseClient): Promise<number> {
  const year = new Date().getFullYear();
  const min = year * 1000;
  const max = min + 999;
  const { data } = await sb
    .from('projects')
    .select('project_number')
    .gte('project_number', min)
    .lte('project_number', max)
    .order('project_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = (data?.project_number as number | undefined) ?? min;
  return Math.max(latest + 1, min + 1);
}

export interface ClientPastProject {
  project_number: number;
  name: string;
  scope_title: string | null;
  site_id: string | null;
  deadline: string | null;
  status: string;
}

export interface ClientWithDirectory {
  id: string;
  name: string;
  sites: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string; email: string | null; role: string | null }>;
  past_projects: ClientPastProject[];
}

export async function fetchClientsWithDirectory(sb: SupabaseClient): Promise<ClientWithDirectory[]> {
  const [clientsRes, sitesRes, contactsRes, projectsRes] = await Promise.all([
    sb.from('clients').select('id, name').order('name'),
    sb.from('sites').select('id, client_id, name').order('name'),
    sb.from('contacts').select('id, client_id, name, email, role').order('name'),
    sb
      .from('projects')
      .select('project_number, name, scope_title, client_id, site_id, deadline, status')
      .not('client_id', 'is', null)
      .order('project_number', { ascending: false }),
  ]);
  const sitesBy = new Map<string, ClientWithDirectory['sites']>();
  for (const s of sitesRes.data ?? []) {
    const arr = sitesBy.get(s.client_id) ?? [];
    arr.push({ id: s.id, name: s.name });
    sitesBy.set(s.client_id, arr);
  }
  const contactsBy = new Map<string, ClientWithDirectory['contacts']>();
  for (const c of contactsRes.data ?? []) {
    const arr = contactsBy.get(c.client_id) ?? [];
    arr.push({ id: c.id, name: c.name, email: c.email, role: c.role });
    contactsBy.set(c.client_id, arr);
  }
  const pastBy = new Map<string, ClientPastProject[]>();
  for (const p of projectsRes.data ?? []) {
    const arr = pastBy.get(p.client_id) ?? [];
    arr.push({
      project_number: p.project_number,
      name: p.name,
      scope_title: p.scope_title,
      site_id: p.site_id,
      deadline: p.deadline,
      status: p.status,
    });
    pastBy.set(p.client_id, arr);
  }
  return (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sites: sitesBy.get(c.id) ?? [],
    contacts: contactsBy.get(c.id) ?? [],
    past_projects: pastBy.get(c.id) ?? [],
  }));
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  task_count: number;
}

export async function fetchTemplates(sb: SupabaseClient): Promise<TemplateSummary[]> {
  const { data: tpls } = await sb
    .from('project_templates')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name');
  if (!tpls?.length) return [];
  const { data: sections } = await sb
    .from('template_sections')
    .select('id, template_id')
    .in('template_id', tpls.map((t) => t.id));
  const secIds = (sections ?? []).map((s) => s.id);
  const { data: tasks } = secIds.length
    ? await sb.from('template_tasks').select('section_id').in('section_id', secIds)
    : { data: [] as Array<{ section_id: string }> };
  const secToTpl = new Map((sections ?? []).map((s) => [s.id as string, s.template_id as string]));
  const countBy = new Map<string, number>();
  for (const t of tasks ?? []) {
    const tid = secToTpl.get(t.section_id);
    if (tid) countBy.set(tid, (countBy.get(tid) ?? 0) + 1);
  }
  return tpls.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    task_count: countBy.get(t.id) ?? 0,
  }));
}

export interface UserOption {
  id: string;
  full_name: string;
}

export async function fetchTeamRoster(sb: SupabaseClient): Promise<UserOption[]> {
  const { data } = await sb.from('users').select('id, full_name').order('full_name');
  return (data ?? []) as UserOption[];
}

export interface TemplateWithTasks {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  sections: Array<{
    id: string;
    phase: 'pre' | 'during' | 'post';
    name: string;
    sort_order: number;
    tasks: Array<{ id: string; title: string; default_priority: 'low' | 'med' | 'high'; sort_order: number }>;
  }>;
  task_count: number;
  usage_count: number;
}

export async function fetchTemplatesWithTasks(sb: SupabaseClient): Promise<TemplateWithTasks[]> {
  const [tplsRes, secsRes, tasksRes, projectsRes] = await Promise.all([
    sb.from('project_templates').select('id, name, description, slug').eq('is_active', true).order('name'),
    sb.from('template_sections').select('id, template_id, phase, name, sort_order').order('phase').order('sort_order'),
    sb.from('template_tasks').select('id, section_id, title, default_priority, sort_order').order('sort_order'),
    sb.from('projects').select('template_id').not('template_id', 'is', null),
  ]);
  const tpls = tplsRes.data ?? [];
  const secs = secsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];

  const usageBy = new Map<string, number>();
  for (const p of projects) usageBy.set(p.template_id, (usageBy.get(p.template_id) ?? 0) + 1);

  const tasksBy = new Map<string, TemplateWithTasks['sections'][number]['tasks']>();
  for (const t of tasks) {
    const arr = tasksBy.get(t.section_id) ?? [];
    arr.push({ id: t.id, title: t.title, default_priority: t.default_priority, sort_order: t.sort_order });
    tasksBy.set(t.section_id, arr);
  }

  const secsBy = new Map<string, TemplateWithTasks['sections']>();
  for (const s of secs) {
    const arr = secsBy.get(s.template_id) ?? [];
    arr.push({ id: s.id, phase: s.phase, name: s.name, sort_order: s.sort_order, tasks: tasksBy.get(s.id) ?? [] });
    secsBy.set(s.template_id, arr);
  }

  return tpls.map((t) => {
    const sections = secsBy.get(t.id) ?? [];
    const task_count = sections.reduce((n, s) => n + s.tasks.length, 0);
    return { ...t, sections, task_count, usage_count: usageBy.get(t.id) ?? 0 };
  });
}

export interface ActiveProjectSummary extends ProjectRow {
  client_name: string | null;
  progress_pct: number;
  team_ids: string[];
  open_tasks: number;
}

/** Rows for the Dashboard "Active jobs" table. */
export async function fetchActiveProjects(sb: SupabaseClient): Promise<ActiveProjectSummary[]> {
  const { data: projects, error } = await sb
    .from('projects')
    .select('id, org_id, project_number, name, status, client_id, site_id, contact_id, template_id, scope_title, phase, deadline, lead_id, accent_color, contact_name, contact_email, has_onsite, onsite_start, onsite_end, clients ( name )')
    .eq('status', 'active')
    // Only surface projects that have been adopted into the PM flow. Legacy
    // timesheet-only projects (52 rows with no template/lead/deadline) stay
    // hidden until they're backfilled or manually edited. ponytail: revisit
    // once Phase-2 Edit Job UI ships and someone starts adopting old rows.
    .not('template_id', 'is', null)
    .order('deadline', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const rows = (projects ?? []) as unknown as Array<ProjectRow & { clients: { name: string } | null }>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [progressRes, teamRes, taskRes] = await Promise.all([
    sb.from('v_project_progress').select('project_id, progress_pct').in('project_id', ids),
    sb.from('project_team_members').select('project_id, user_id').in('project_id', ids),
    sb.from('tasks').select('project_id, status').in('project_id', ids),
  ]);
  const progressBy = new Map((progressRes.data ?? []).map((r) => [r.project_id, Number(r.progress_pct)]));
  const teamBy = new Map<string, string[]>();
  for (const t of teamRes.data ?? []) {
    const arr = teamBy.get(t.project_id) ?? [];
    arr.push(t.user_id);
    teamBy.set(t.project_id, arr);
  }
  const openBy = new Map<string, number>();
  for (const t of taskRes.data ?? []) {
    if (t.status !== 'done') openBy.set(t.project_id, (openBy.get(t.project_id) ?? 0) + 1);
  }
  return rows.map((r) => ({
    ...r,
    client_name: r.clients?.name ?? null,
    progress_pct: progressBy.get(r.id) ?? 0,
    team_ids: teamBy.get(r.id) ?? [],
    open_tasks: openBy.get(r.id) ?? 0,
  }));
}

export interface DashboardKpis {
  overdue: number;
  dueThisWeek: number;
  activeJobs: number;
  done: number;
}

export async function fetchDashboardKpis(sb: SupabaseClient): Promise<DashboardKpis> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [overdue, week, active, done] = await Promise.all([
    sb.from('tasks').select('id', { count: 'exact', head: true }).lt('due_date', today).neq('status', 'done'),
    sb.from('tasks').select('id', { count: 'exact', head: true }).gte('due_date', today).lte('due_date', in7).neq('status', 'done'),
    sb.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').not('template_id', 'is', null),
    sb.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done'),
  ]);
  return {
    overdue: overdue.count ?? 0,
    dueThisWeek: week.count ?? 0,
    activeJobs: active.count ?? 0,
    done: done.count ?? 0,
  };
}

export interface MyPriorityTask extends TaskRow {
  project_number: number;
  project_name: string;
}

export interface MyTaskRow extends TaskRow {
  project_number: number;
  project_name: string;
}

export interface OnsiteBlock {
  project_id: string;
  project_number: number;
  scope: string;
  client_name: string | null;
  onsite_start: string;
  onsite_end: string;
  accent_color: string | null;
  team: Array<{ id: string; full_name: string }>;
}

/** On-site windows that overlap the [from, to] date range. Used by the
 * resource-booking calendar to render multi-day blocks under the day cells. */
export async function fetchOnsiteBlocksInRange(
  sb: SupabaseClient,
  from: string,
  to: string,
): Promise<OnsiteBlock[]> {
  const { data, error } = await sb
    .from('projects')
    .select('id, project_number, name, scope_title, accent_color, onsite_start, onsite_end, clients(name), project_team_members(user_id, users(id, full_name))')
    .eq('has_onsite', true)
    .lte('onsite_start', to)
    .gte('onsite_end', from);
  if (error) throw new Error(error.message);
  type Row = {
    id: string; project_number: number; name: string; scope_title: string | null;
    accent_color: string | null; onsite_start: string; onsite_end: string;
    clients: { name: string } | null;
    project_team_members: Array<{ user_id: string; users: { id: string; full_name: string } | null }>;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    project_id: r.id,
    project_number: r.project_number,
    scope: r.scope_title ?? r.name,
    client_name: r.clients?.name ?? null,
    onsite_start: r.onsite_start,
    onsite_end: r.onsite_end,
    accent_color: r.accent_color,
    team: (r.project_team_members ?? [])
      .map((m) => m.users)
      .filter((u): u is { id: string; full_name: string } => !!u),
  }));
}

export interface WorkloadRow {
  user_id: string;
  full_name: string;
  open_count: number;
  overdue_count: number;
  due_this_week_count: number;
}

/** Per-user open-task workload — only counts tasks on adopted projects. */
export async function fetchTeamWorkload(sb: SupabaseClient): Promise<WorkloadRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [tasksRes, users] = await Promise.all([
    sb
      .from('tasks')
      .select('assignee_id, due_date, status, projects!inner(template_id)')
      .neq('status', 'done'),
    fetchTeamRoster(sb),
  ]);

  type Row = { assignee_id: string | null; due_date: string | null; status: string; projects: { template_id: string | null } };
  const rows = ((tasksRes.data ?? []) as unknown as Row[]).filter((r) => r.projects.template_id != null);

  const openBy = new Map<string, number>();
  const overdueBy = new Map<string, number>();
  const weekBy = new Map<string, number>();
  for (const r of rows) {
    if (!r.assignee_id) continue;
    openBy.set(r.assignee_id, (openBy.get(r.assignee_id) ?? 0) + 1);
    if (r.due_date && r.due_date < today) {
      overdueBy.set(r.assignee_id, (overdueBy.get(r.assignee_id) ?? 0) + 1);
    } else if (r.due_date && r.due_date >= today && r.due_date <= in7) {
      weekBy.set(r.assignee_id, (weekBy.get(r.assignee_id) ?? 0) + 1);
    }
  }

  return users
    .map((u) => ({
      user_id: u.id,
      full_name: u.full_name,
      open_count: openBy.get(u.id) ?? 0,
      overdue_count: overdueBy.get(u.id) ?? 0,
      due_this_week_count: weekBy.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.open_count - a.open_count);
}

/** All tasks with a due_date in [from, to], across active PM-flow projects. */
export async function fetchTasksInRange(sb: SupabaseClient, from: string, to: string): Promise<MyTaskRow[]> {
  const { data, error } = await sb
    .from('tasks')
    .select('id, project_id, section_name, phase, title, assignee_id, due_date, priority, status, sort_order, projects!inner(project_number, name, template_id)')
    .gte('due_date', from)
    .lte('due_date', to)
    .order('due_date');
  if (error) throw new Error(error.message);
  type Row = TaskRow & { projects: { project_number: number; name: string; template_id: string | null } };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.projects.template_id != null)
    .map((r) => ({ ...r, project_number: r.projects.project_number, project_name: r.projects.name }));
}

/** Every open + recently-completed task assigned to the current user. */
export async function fetchMyTasks(sb: SupabaseClient, userId: string): Promise<MyTaskRow[]> {
  const { data, error } = await sb
    .from('tasks')
    .select('id, project_id, section_name, phase, title, assignee_id, due_date, priority, status, sort_order, projects!inner(project_number, name, template_id)')
    .eq('assignee_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  type Row = TaskRow & { projects: { project_number: number; name: string; template_id: string | null } };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.projects.template_id != null)  // skip legacy/unadopted
    .map((r) => ({ ...r, project_number: r.projects.project_number, project_name: r.projects.name }));
}

export async function fetchMyPriorities(sb: SupabaseClient, userId: string, limit = 5): Promise<MyPriorityTask[]> {
  const { data, error } = await sb
    .from('tasks')
    .select('id, project_id, section_name, phase, title, assignee_id, due_date, priority, status, sort_order, projects!inner(project_number, name)')
    .eq('assignee_id', userId)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Row = TaskRow & { projects: { project_number: number; name: string } };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    project_number: r.projects.project_number,
    project_name: r.projects.name,
  }));
}

export interface ProjectDetail extends ProjectRow {
  client_name: string | null;
  site_name: string | null;
  progress_pct: number;
  team: Array<{ id: string; full_name: string; email: string }>;
  lead: { id: string; full_name: string; email: string } | null;
  contact: { name: string; email: string | null; role: string | null; phone: string | null } | null;
  tasks: TaskRow[];
}

export async function fetchProjectByNumber(sb: SupabaseClient, projectNumber: number): Promise<ProjectDetail | null> {
  const { data: project, error } = await sb
    .from('projects')
    .select(`id, org_id, project_number, name, status, client_id, site_id, contact_id, template_id,
             scope_title, phase, deadline, lead_id, accent_color, contact_name, contact_email,
             has_onsite, onsite_start, onsite_end,
             clients ( name ), sites ( name ), contacts ( name, email, role, phone )`)
    .eq('project_number', projectNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) return null;
  type Joined = ProjectRow & {
    clients: { name: string } | null;
    sites: { name: string } | null;
    contacts: { name: string; email: string | null; role: string | null; phone: string | null } | null;
  };
  const row = project as unknown as Joined;

  const [progressRes, teamRes, tasksRes] = await Promise.all([
    sb.from('v_project_progress').select('progress_pct').eq('project_id', row.id).maybeSingle(),
    sb.from('project_team_members').select('user_id, users(id, full_name, email)').eq('project_id', row.id),
    sb.from('tasks').select('id, project_id, section_name, phase, title, assignee_id, due_date, priority, status, sort_order').eq('project_id', row.id).order('sort_order'),
  ]);

  type TeamRow = { user_id: string; users: { id: string; full_name: string; email: string } };
  const team = ((teamRes.data ?? []) as unknown as TeamRow[]).map((t) => t.users);

  let lead: ProjectDetail['lead'] = null;
  if (row.lead_id) {
    const { data: leadRow } = await sb.from('users').select('id, full_name, email').eq('id', row.lead_id).maybeSingle();
    lead = (leadRow as ProjectDetail['lead']) ?? null;
  }

  // Prefer FK contact record; fall back to inline contact_name/email on projects.
  const contact = row.contacts
    ? row.contacts
    : row.contact_name
      ? { name: row.contact_name, email: row.contact_email, role: null, phone: null }
      : null;

  return {
    ...row,
    client_name: row.clients?.name ?? null,
    site_name: row.sites?.name ?? null,
    progress_pct: Number(progressRes.data?.progress_pct ?? 0),
    team,
    lead,
    contact,
    tasks: (tasksRes.data ?? []) as TaskRow[],
  };
}
