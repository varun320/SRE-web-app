/**
 * Current TIL + vacation balance per active employee.
 * PostgREST has no DISTINCT ON; we fetch all live ledger rows and pick the
 * latest per user in JS. Acceptable scale: weeks × employees per org.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BalanceRow {
  user_id: string;
  employee_code: string;
  full_name: string;
  position: string | null;
  department: string | null;
  til_closing: number;
  til_week: string | null;
  vacation_closing: number;
  vacation_week: string | null;
}

export async function fetchCurrentBalances(sb: SupabaseClient): Promise<BalanceRow[]> {
  const [usersRes, tilRes, vacRes, posRes] = await Promise.all([
    sb.from('users')
      .select('id, employee_code, full_name, department, position_id, is_active')
      .eq('is_active', true)
      .order('employee_code'),
    sb.from('til_ledger')
      .select('user_id, week_start, closing_balance')
      .eq('stale', false)
      .order('week_start', { ascending: false }),
    sb.from('vacation_ledger')
      .select('user_id, week_start, closing_balance')
      .eq('stale', false)
      .order('week_start', { ascending: false }),
    sb.from('positions').select('id, name'),
  ]);

  if (usersRes.error) throw new Error(usersRes.error.message);
  if (tilRes.error)   throw new Error(tilRes.error.message);
  if (vacRes.error)   throw new Error(vacRes.error.message);
  if (posRes.error)   throw new Error(posRes.error.message);

  const latestTil = pickLatest(tilRes.data ?? []);
  const latestVac = pickLatest(vacRes.data ?? []);
  const positionById = new Map((posRes.data ?? []).map((p) => [p.id as string, p.name as string]));

  return (usersRes.data ?? []).map((u) => {
    const til = latestTil.get(u.id);
    const vac = latestVac.get(u.id);
    return {
      user_id: u.id,
      employee_code: u.employee_code,
      full_name: u.full_name,
      position: u.position_id ? positionById.get(u.position_id) ?? null : null,
      department: u.department,
      til_closing: Number(til?.closing_balance ?? 0),
      til_week: til?.week_start ?? null,
      vacation_closing: Number(vac?.closing_balance ?? 0),
      vacation_week: vac?.week_start ?? null,
    };
  });
}

function pickLatest(
  rows: { user_id: string; week_start: string; closing_balance: number }[],
): Map<string, { week_start: string; closing_balance: number }> {
  const m = new Map<string, { week_start: string; closing_balance: number }>();
  for (const r of rows) {
    const prev = m.get(r.user_id);
    if (!prev || r.week_start > prev.week_start) {
      m.set(r.user_id, { week_start: r.week_start, closing_balance: r.closing_balance });
    }
  }
  return m;
}
