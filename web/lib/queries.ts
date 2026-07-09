import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, SubCategory, Timesheet, TimesheetEntryDraft, MainCategory } from './types';

export async function fetchSubCategories(sb: SupabaseClient): Promise<SubCategory[]> {
  const { data, error } = await sb
    .from('sub_categories')
    .select('id, main_category, name, requires_project, consumes_til, consumes_vacation, is_overtime_taken, sort_order')
    .eq('is_active', true)
    .order('main_category').order('sort_order');
  if (error) throw error;
  return data as SubCategory[];
}

export async function fetchProjects(sb: SupabaseClient): Promise<Project[]> {
  const { data, error } = await sb
    .from('projects')
    .select('id, project_number, name, status')
    .eq('status', 'active')
    .order('project_number');
  if (error) throw error;
  return data as Project[];
}

export async function ensureWeek(sb: SupabaseClient, weekStart: string): Promise<string> {
  const { data, error } = await sb.rpc('create_or_get_week', { p_week_start: weekStart });
  if (error) throw error;
  return data as string;
}

export async function fetchTimesheet(sb: SupabaseClient, id: string): Promise<{ timesheet: Timesheet; entries: TimesheetEntryDraft[] }> {
  const [{ data: tsRow, error: tsErr }, { data: entryRows, error: enErr }] = await Promise.all([
    sb.from('timesheets').select('id,user_id,week_start,status,submitted_at,decided_at,decline_reason,locked').eq('id', id).single(),
    sb.from('timesheet_entries').select('id,main_category,sub_category_id,project_id,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,description,position').eq('timesheet_id', id).order('position'),
  ]);
  if (tsErr) throw tsErr;
  if (enErr) throw enErr;
  return {
    timesheet: tsRow as Timesheet,
    entries: (entryRows ?? []).map((r) => ({ ...r, main_category: r.main_category as MainCategory })),
  };
}

export async function replaceEntries(sb: SupabaseClient, timesheetId: string, entries: Omit<TimesheetEntryDraft,'id'>[]): Promise<void> {
  // Skip rows without a main_category — main_category is a Postgres enum and
  // rejects empty strings. Unfinished rows stay in client state; the moment
  // the user picks a category, autosave picks them up.
  const persistable = entries.filter((e) => e.main_category && e.main_category.length > 0);

  const { error: delErr } = await sb.from('timesheet_entries').delete().eq('timesheet_id', timesheetId);
  if (delErr) throw delErr;
  if (persistable.length === 0) return;
  const payload = persistable.map((e, i) => ({
    timesheet_id: timesheetId,
    main_category: e.main_category,
    sub_category_id: e.sub_category_id,
    project_id: e.project_id,
    mon_hrs: e.mon_hrs, tue_hrs: e.tue_hrs, wed_hrs: e.wed_hrs, thu_hrs: e.thu_hrs,
    fri_hrs: e.fri_hrs, sat_hrs: e.sat_hrs, sun_hrs: e.sun_hrs,
    description: e.description,
    position: i,
  }));
  const { error } = await sb.from('timesheet_entries').insert(payload);
  if (error) throw error;
}

export async function submitTimesheet(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('submit_timesheet', { p_timesheet_id: id });
  if (error) throw error;
}
