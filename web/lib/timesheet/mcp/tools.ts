// Business logic layer for the timesheet MCP surface.
//
// Mirrors the expense MCP module (web/lib/expenses/mcp/tools.ts). Every
// handler takes an already-authenticated SupabaseClient — the transport
// binds auth.uid() before calling in. RLS on `timesheets` restricts reads
// to the caller unless they're an admin.

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const mainCategory = z.enum(['Project', 'Admin', 'Office & Sales']);

export const listTimesheetsInput = z.object({
  status: z.enum(['draft', 'submitted', 'approved', 'declined']).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export const weekInput = z.object({ week_start: dateStr });

export const entryInput = z.object({
  main_category: mainCategory,
  sub_category_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  mon_hrs: z.number().nonnegative().default(0),
  tue_hrs: z.number().nonnegative().default(0),
  wed_hrs: z.number().nonnegative().default(0),
  thu_hrs: z.number().nonnegative().default(0),
  fri_hrs: z.number().nonnegative().default(0),
  sat_hrs: z.number().nonnegative().default(0),
  sun_hrs: z.number().nonnegative().default(0),
  description: z.string().trim().min(1).max(2000),
});

export const replaceEntriesInput = z.object({
  week_start: dateStr,
  entries: z.array(entryInput),
});

export const submitInput = weekInput;

export const adminActInput = z.object({
  user_id: z.string().uuid(),
  week_start: dateStr,
});
export const adminApproveInput = adminActInput.extend({
  comment: z.string().max(500).optional(),
});
export const adminReasonInput = adminActInput.extend({
  reason: z.string().min(3).max(500),
});

async function findByWeek(
  sb: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<{ id: string } | null> {
  const { data, error } = await sb
    .from('timesheets')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null) ?? null;
}

export async function listTimesheets(
  sb: SupabaseClient,
  input: z.infer<typeof listTimesheetsInput>,
) {
  let q = sb.from('timesheets').select('*').order('week_start', { ascending: false });
  if (input.status) q = q.eq('status', input.status);
  if (input.from) q = q.gte('week_start', input.from);
  if (input.to) q = q.lte('week_start', input.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function getTimesheet(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof weekInput>,
) {
  const row = await findByWeek(sb, userId, input.week_start);
  if (!row) throw new Error(`No timesheet for week_start=${input.week_start}`);
  const [{ data: ts }, { data: entries }, { data: totals }] = await Promise.all([
    sb.from('timesheets').select('*').eq('id', row.id).single(),
    sb
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', row.id)
      .order('position'),
    sb.from('v_timesheet_totals').select('*').eq('timesheet_id', row.id).maybeSingle(),
  ]);
  return { timesheet: ts, entries: entries ?? [], totals };
}

export async function ensureWeek(
  sb: SupabaseClient,
  input: z.infer<typeof weekInput>,
) {
  const { data, error } = await sb.rpc('create_or_get_week', {
    p_week_start: input.week_start,
  });
  if (error) throw new Error(error.message);
  return { id: data as string, week_start: input.week_start };
}

export async function replaceTimesheetEntries(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof replaceEntriesInput>,
) {
  let row = await findByWeek(sb, userId, input.week_start);
  if (!row) {
    // Auto-create the draft — LLM shouldn't need a separate ensure_week call
    // just to log the first entries of a fresh week.
    const { data: id, error } = await sb.rpc('create_or_get_week', {
      p_week_start: input.week_start,
    });
    if (error) throw new Error(error.message);
    row = { id: id as string };
  }
  const lines = input.entries.map((e, i) => ({
    main_category: e.main_category,
    sub_category_id: e.sub_category_id,
    project_id: e.project_id ?? null,
    mon_hrs: e.mon_hrs, tue_hrs: e.tue_hrs, wed_hrs: e.wed_hrs, thu_hrs: e.thu_hrs,
    fri_hrs: e.fri_hrs, sat_hrs: e.sat_hrs, sun_hrs: e.sun_hrs,
    description: e.description,
    position: i,
  }));
  const { error } = await sb.rpc('replace_timesheet_entries', {
    p_timesheet_id: row.id,
    p_entries: lines,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, count: lines.length };
}

export async function submitTimesheet(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof submitInput>,
) {
  const row = await findByWeek(sb, userId, input.week_start);
  if (!row) throw new Error(`No timesheet for week_start=${input.week_start}`);
  const { error } = await sb.rpc('submit_timesheet', { p_timesheet_id: row.id });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'submitted' };
}

export async function listSubCategories(sb: SupabaseClient) {
  const { data, error } = await sb
    .from('sub_categories')
    .select('id, main_category, name, requires_project, consumes_til, consumes_vacation, is_overtime_taken, sort_order')
    .eq('is_active', true)
    .order('main_category')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveProjects(sb: SupabaseClient) {
  const { data, error } = await sb
    .from('projects')
    .select('id, project_number, name, status')
    .eq('status', 'active')
    .order('project_number');
  if (error) throw new Error(error.message);
  return data;
}

// -- Admin-only wrappers ------------------------------------------------------

export async function approveTimesheet(
  sb: SupabaseClient,
  input: z.infer<typeof adminApproveInput>,
) {
  const row = await findByWeek(sb, input.user_id, input.week_start);
  if (!row) throw new Error('timesheet not found');
  const { error } = await sb.rpc('approve_timesheet', {
    p_timesheet_id: row.id,
    p_comment: input.comment ?? null,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'approved' };
}

export async function declineTimesheet(
  sb: SupabaseClient,
  input: z.infer<typeof adminReasonInput>,
) {
  const row = await findByWeek(sb, input.user_id, input.week_start);
  if (!row) throw new Error('timesheet not found');
  const { error } = await sb.rpc('decline_timesheet', {
    p_timesheet_id: row.id,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'declined' };
}

export async function unlockTimesheet(
  sb: SupabaseClient,
  input: z.infer<typeof adminReasonInput>,
) {
  const row = await findByWeek(sb, input.user_id, input.week_start);
  if (!row) throw new Error('timesheet not found');
  const { error } = await sb.rpc('unlock_timesheet', {
    p_timesheet_id: row.id,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'unlocked' };
}
