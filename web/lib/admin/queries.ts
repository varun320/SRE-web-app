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
    .select(`
      id, user_id, week_start, submitted_at,
      users!inner ( full_name, email, employee_code )
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true });
  if (tsErr) throw tsErr;
  if (!tsRows || tsRows.length === 0) return [];

  // Step 2: fetch totals via the view (separate query — views aren't always embeddable)
  const ids = tsRows.map((r) => r.id);
  const { data: totals, error: totErr } = await sb
    .from('v_timesheet_totals')
    .select('timesheet_id, total_hrs, overtime_earned')
    .in('timesheet_id', ids);
  if (totErr) throw totErr;
  const byId = new Map((totals ?? []).map((t) => [t.timesheet_id, t]));

  type Row = {
    id: string;
    user_id: string;
    week_start: string;
    submitted_at: string;
    users: { full_name: string; email: string; employee_code: string };
  };
  return (tsRows as unknown as Row[]).map((r) => {
    const t = byId.get(r.id);
    return {
      timesheet_id: r.id,
      user_id: r.user_id,
      full_name: r.users.full_name,
      email: r.users.email,
      employee_code: r.users.employee_code,
      week_start: r.week_start,
      submitted_at: r.submitted_at,
      total_hrs: Number(t?.total_hrs ?? 0),
      overtime_earned: Number(t?.overtime_earned ?? 0),
    };
  });
}
