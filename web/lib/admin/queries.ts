import type { SupabaseClient } from '@supabase/supabase-js';

export interface QueueRow {
  timesheet_id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_code: string;
  week_start: string;
  submitted_at: string;
  total_hrs: number;
  overtime_earned: number;
}

export async function fetchSubmittedQueue(sb: SupabaseClient): Promise<QueueRow[]> {
  // Step 1: get submitted timesheets joined with user info
  const { data: tsRows, error: tsErr } = await sb
    .from('timesheets')
    .select('id, user_id, week_start, submitted_at')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true });
  if (tsErr) throw tsErr;
  if (!tsRows || tsRows.length === 0) return [];

  const userIds = Array.from(new Set(tsRows.map((r) => r.user_id as string)));
  const { data: userRows, error: usrErr } = await sb
    .from('users')
    .select('id, full_name, email, employee_code')
    .in('id', userIds);
  if (usrErr) throw usrErr;
  const userById = new Map((userRows ?? []).map((u) => [u.id as string, u]));

  const ids = tsRows.map((r) => r.id);
  const { data: totals, error: totErr } = await sb
    .from('v_timesheet_totals')
    .select('timesheet_id, total_hrs, overtime_earned')
    .in('timesheet_id', ids);
  if (totErr) throw totErr;
  const totalsById = new Map((totals ?? []).map((t) => [t.timesheet_id as string, t]));

  return tsRows.map((r) => {
    const u = userById.get(r.user_id as string);
    const t = totalsById.get(r.id as string);
    return {
      timesheet_id: r.id as string,
      user_id: r.user_id as string,
      full_name: (u?.full_name as string) ?? '—',
      email: (u?.email as string) ?? '',
      employee_code: (u?.employee_code as string) ?? '',
      week_start: r.week_start as string,
      submitted_at: r.submitted_at as string,
      total_hrs: Number(t?.total_hrs ?? 0),
      overtime_earned: Number(t?.overtime_earned ?? 0),
    };
  });
}
