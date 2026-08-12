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

export interface ClientWithDirectory {
  id: string;
  name: string;
  sites: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string; email: string | null; role: string | null }>;
}

export async function fetchClientsWithDirectory(sb: SupabaseClient): Promise<ClientWithDirectory[]> {
  const [clientsRes, sitesRes, contactsRes] = await Promise.all([
    sb.from('clients').select('id, name').order('name'),
    sb.from('sites').select('id, client_id, name').order('name'),
    sb.from('contacts').select('id, client_id, name, email, role').order('name'),
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
  return (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sites: sitesBy.get(c.id) ?? [],
    contacts: contactsBy.get(c.id) ?? [],
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
    .select('id, org_id, project_number, name, status, client_id, site_id, contact_id, template_id, scope_title, phase, deadline, lead_id, accent_color, contact_name, contact_email, clients ( name )')
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
