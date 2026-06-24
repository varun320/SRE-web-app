/**
 * Shared period-summary query used by every report.
 * Reads from the v_period_summary view; RLS enforces admin vs employee scope.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PeriodSummaryRow } from './payroll';

export interface FetchPeriodArgs {
  from: string;         // ISO YYYY-MM-DD, inclusive (Monday)
  to: string;           // ISO YYYY-MM-DD, inclusive (Monday)
  userId?: string;
}

export async function fetchPeriodSummary(
  sb: SupabaseClient,
  args: FetchPeriodArgs,
): Promise<PeriodSummaryRow[]> {
  let q = sb
    .from('v_period_summary')
    .select(
      'timesheet_id, user_id, employee_code, full_name, week_start, ' +
        'regular_hrs, overtime_earned, til_used, vacation_used, til_payout_hrs',
    )
    .gte('week_start', args.from)
    .lte('week_start', args.to)
    .order('employee_code', { ascending: true })
    .order('week_start', { ascending: true });

  if (args.userId) q = q.eq('user_id', args.userId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const summaryRows = (data ?? []) as Omit<PeriodSummaryRow, 'til_closing' | 'vacation_closing'>[];

  // Closings come from the ledger tables — one query per ledger, scoped to
  // the same date range. Joined in memory by (user_id, week_start).
  const userIds = Array.from(new Set(summaryRows.map((r) => r.user_id)));
  if (userIds.length === 0) {
    return summaryRows.map((r) => ({ ...r, til_closing: null, vacation_closing: null }));
  }

  const [tilRes, vacRes] = await Promise.all([
    sb.from('til_ledger')
      .select('user_id, week_start, closing_balance')
      .in('user_id', userIds)
      .gte('week_start', args.from)
      .lte('week_start', args.to)
      .eq('stale', false),
    sb.from('vacation_ledger')
      .select('user_id, week_start, closing_balance')
      .in('user_id', userIds)
      .gte('week_start', args.from)
      .lte('week_start', args.to)
      .eq('stale', false),
  ]);
  if (tilRes.error) throw new Error(tilRes.error.message);
  if (vacRes.error) throw new Error(vacRes.error.message);

  const tilBy = ledgerMap(tilRes.data ?? []);
  const vacBy = ledgerMap(vacRes.data ?? []);

  return summaryRows.map((r) => ({
    ...r,
    til_closing: tilBy.get(`${r.user_id}|${r.week_start}`) ?? null,
    vacation_closing: vacBy.get(`${r.user_id}|${r.week_start}`) ?? null,
  }));
}

function ledgerMap(rows: { user_id: string; week_start: string; closing_balance: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(`${r.user_id}|${r.week_start}`, Number(r.closing_balance));
  return m;
}
