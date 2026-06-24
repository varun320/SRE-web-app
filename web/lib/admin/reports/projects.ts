/**
 * Hours-by-project aggregator. Pure function over join rows; the DB query
 * lives below in `fetchProjectHours`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectHoursRow {
  project_id: string;
  project_number: number;
  project_name: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  hrs: number;
}

export interface ProjectBreakdown {
  project_id: string;
  project_number: number;
  project_name: string;
  total_hrs: number;
  by_employee: { employee_code: string; full_name: string; hrs: number }[];
}

export function aggregateByProject(rows: readonly ProjectHoursRow[]): ProjectBreakdown[] {
  if (rows.length === 0) return [];

  const byProject = new Map<string, ProjectBreakdown>();

  for (const r of rows) {
    let acc = byProject.get(r.project_id);
    if (!acc) {
      acc = {
        project_id: r.project_id,
        project_number: r.project_number,
        project_name: r.project_name,
        total_hrs: 0,
        by_employee: [],
      };
      byProject.set(r.project_id, acc);
    }
    acc.total_hrs += r.hrs;

    const emp = acc.by_employee.find((e) => e.employee_code === r.employee_code);
    if (emp) {
      emp.hrs += r.hrs;
    } else {
      acc.by_employee.push({
        employee_code: r.employee_code,
        full_name: r.full_name,
        hrs: r.hrs,
      });
    }
  }

  for (const p of byProject.values()) {
    p.by_employee.sort((a, b) => b.hrs - a.hrs);
  }

  return [...byProject.values()].sort((a, b) => b.total_hrs - a.total_hrs);
}

// ---------------------------------------------------------------------------

export interface FetchProjectHoursArgs {
  from: string;
  to: string;
  projectId?: string;
}

interface RawEntry {
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  project: { id: string; project_number: number; name: string } | null;
  timesheet: {
    user: { id: string; employee_code: string; full_name: string } | null;
  } | null;
}

export async function fetchProjectHours(
  sb: SupabaseClient,
  args: FetchProjectHoursArgs,
): Promise<ProjectHoursRow[]> {
  // Pull entries that are part of approved timesheets in the range.
  // Two-step join via PostgREST resource embedding keeps the query single-shot.
  let q = sb
    .from('timesheet_entries')
    .select(
      `mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs,
       project:projects ( id, project_number, name ),
       timesheet:timesheets!inner (
         status, week_start,
         user:users!timesheets_user_id_fkey ( id, employee_code, full_name )
       )`,
    )
    .eq('timesheet.status', 'approved')
    .gte('timesheet.week_start', args.from)
    .lte('timesheet.week_start', args.to)
    .not('project_id', 'is', null);

  if (args.projectId) q = q.eq('project_id', args.projectId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows: ProjectHoursRow[] = [];
  for (const r of (data ?? []) as unknown as RawEntry[]) {
    const project = r.project;
    const user = r.timesheet?.user;
    if (!project || !user) continue;

    const hrs =
      Number(r.mon_hrs ?? 0) + Number(r.tue_hrs ?? 0) + Number(r.wed_hrs ?? 0) +
      Number(r.thu_hrs ?? 0) + Number(r.fri_hrs ?? 0) + Number(r.sat_hrs ?? 0) +
      Number(r.sun_hrs ?? 0);

    if (hrs === 0) continue;

    rows.push({
      project_id: project.id,
      project_number: project.project_number,
      project_name: project.name,
      user_id: user.id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      hrs,
    });
  }
  return rows;
}
