import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectRow, TaskRow } from './types';

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
    .select('id, org_id, project_number, name, status, client_id, scope_title, phase, deadline, lead_id, accent_color, contact_name, contact_email, clients ( name )')
    .eq('status', 'active')
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
    sb.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
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
  progress_pct: number;
  team: Array<{ id: string; full_name: string; email: string }>;
  lead: { id: string; full_name: string; email: string } | null;
  tasks: TaskRow[];
}

export async function fetchProjectByNumber(sb: SupabaseClient, projectNumber: number): Promise<ProjectDetail | null> {
  const { data: project, error } = await sb
    .from('projects')
    .select('id, org_id, project_number, name, status, client_id, scope_title, phase, deadline, lead_id, accent_color, contact_name, contact_email, clients ( name )')
    .eq('project_number', projectNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) return null;
  const row = project as unknown as ProjectRow & { clients: { name: string } | null };

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

  return {
    ...row,
    client_name: row.clients?.name ?? null,
    progress_pct: Number(progressRes.data?.progress_pct ?? 0),
    team,
    lead,
    tasks: (tasksRes.data ?? []) as TaskRow[],
  };
}
