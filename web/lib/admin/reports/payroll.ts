/**
 * Payroll aggregator — pure function over v_period_summary rows.
 * Buckets weeks into bi-weekly pay periods aligned to a configurable Monday
 * epoch (default: 2026-01-05 set by the caller / org config).
 */

export interface PeriodSummaryRow {
  timesheet_id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  week_start: string;            // ISO YYYY-MM-DD (Monday)
  regular_hrs: number;
  overtime_earned: number;
  til_used: number;
  vacation_used: number;
  til_payout_hrs: number;
  /** Latest til_ledger closing balance for this week, if attached by caller. */
  til_closing: number | null;
  /** Latest vacation_ledger closing balance for this week, if attached. */
  vacation_closing: number | null;
}

export interface PayrollRow {
  user_id: string;
  employee_code: string;
  full_name: string;
  period_start: string;          // ISO YYYY-MM-DD
  period_end: string;            // ISO YYYY-MM-DD (inclusive, period_start + 13d)
  regular_hrs: number;
  overtime_hrs: number;
  til_payout_hrs: number;
  til_earned_delta: number;
  til_used_delta: number;
  til_closing: number | null;
  vacation_used_delta: number;
  vacation_closing: number | null;
}

export interface AggregateOptions {
  /** Monday that defines the start of period 0. */
  epoch: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 14;

export function aggregatePayroll(
  rows: readonly PeriodSummaryRow[],
  opts: AggregateOptions,
): PayrollRow[] {
  if (rows.length === 0) return [];

  const epochMs = toUtcMidnight(opts.epoch).getTime();

  // Group key: `${user_id}|${bucket}`
  const byKey = new Map<string, PayrollRow & { _latestWeekMs: number }>();

  for (const r of rows) {
    const weekMs = toUtcMidnight(new Date(`${r.week_start}T00:00:00Z`)).getTime();
    const bucket = Math.floor((weekMs - epochMs) / (PERIOD_DAYS * MS_PER_DAY));
    const periodStartMs = epochMs + bucket * PERIOD_DAYS * MS_PER_DAY;
    const periodEndMs = periodStartMs + (PERIOD_DAYS - 1) * MS_PER_DAY;

    const key = `${r.user_id}|${bucket}`;
    let acc = byKey.get(key);

    if (!acc) {
      acc = {
        user_id: r.user_id,
        employee_code: r.employee_code,
        full_name: r.full_name,
        period_start: isoDate(periodStartMs),
        period_end: isoDate(periodEndMs),
        regular_hrs: 0,
        overtime_hrs: 0,
        til_payout_hrs: 0,
        til_earned_delta: 0,
        til_used_delta: 0,
        til_closing: null,
        vacation_used_delta: 0,
        vacation_closing: null,
        _latestWeekMs: -Infinity,
      };
      byKey.set(key, acc);
    }

    acc.regular_hrs        += r.regular_hrs;
    acc.overtime_hrs       += r.overtime_earned;
    acc.til_payout_hrs     += r.til_payout_hrs;
    acc.til_earned_delta   += r.overtime_earned;
    acc.til_used_delta     += r.til_used;
    acc.vacation_used_delta += r.vacation_used;

    // Closing balances come from the latest week in the period.
    if (weekMs >= acc._latestWeekMs) {
      acc._latestWeekMs = weekMs;
      acc.til_closing = r.til_closing ?? acc.til_closing;
      acc.vacation_closing = r.vacation_closing ?? acc.vacation_closing;
    }
  }

  return [...byKey.values()]
    .map(({ _latestWeekMs: _drop, ...rest }) => rest)
    .sort((a, b) =>
      a.employee_code !== b.employee_code
        ? a.employee_code.localeCompare(b.employee_code)
        : a.period_start.localeCompare(b.period_start),
    );
}

function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
