import type { SubCategory, TimesheetEntryDraft } from './types';
import { DAY_KEYS } from './dates';

export interface TimesheetTotals {
  total_hrs: number;
  overtime_earned: number;
  til_used: number;
  vacation_used: number;
}

// Overtime rule (per Utsav / 2026-07-08 comments):
//   * Standard workweek is 40 hours (Mon–Fri, 8h/day).
//   * Overtime accrues only after the employee has logged 40 base hours across
//     Mon–Sun combined. Weekend hours are NOT automatically overtime — they
//     only become overtime once the 40h threshold is crossed.
//   * Time-off rows never contribute to base hours: TIL Payout, TIL Overtime
//     Taken (consumes_til), and Vacation Hours (consumes_vacation). Otherwise
//     taking TIL as time off would inflate overtime earned in the same week.
export function computeTotals(
  rows: readonly TimesheetEntryDraft[],
  subCategories: readonly SubCategory[],
): TimesheetTotals {
  const subById = new Map(subCategories.map((s) => [s.id, s]));
  let total_hrs = 0;
  let til_used = 0;
  let vacation_used = 0;
  let base_hrs = 0;

  for (const row of rows) {
    const sub = row.sub_category_id ? subById.get(row.sub_category_id) : undefined;
    const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
    total_hrs += rowTotal;
    if (sub?.consumes_til) til_used += rowTotal;
    if (sub?.consumes_vacation) vacation_used += rowTotal;
    const isTimeOff = sub?.consumes_til || sub?.consumes_vacation;
    if (!isTimeOff) base_hrs += rowTotal;
  }

  const overtime_earned = Math.max(0, base_hrs - 40);
  return { total_hrs, overtime_earned, til_used, vacation_used };
}
