import type { SubCategory, TimesheetEntryDraft } from './types';
import { DAY_KEYS } from './dates';

export interface TimesheetTotals {
  total_hrs: number;
  overtime_earned: number;
  til_used: number;
  vacation_used: number;
}

export function computeTotals(
  rows: readonly TimesheetEntryDraft[],
  subCategories: readonly SubCategory[],
): TimesheetTotals {
  const subById = new Map(subCategories.map((s) => [s.id, s]));
  let total_hrs = 0;
  let til_used = 0;
  let vacation_used = 0;
  const dayBaseTotals: Record<typeof DAY_KEYS[number], number> = {
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
  };

  for (const row of rows) {
    const sub = row.sub_category_id ? subById.get(row.sub_category_id) : undefined;
    const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
    total_hrs += rowTotal;
    if (sub?.consumes_til) til_used += rowTotal;
    if (sub?.consumes_vacation) vacation_used += rowTotal;

    if (sub?.name !== 'TIL Payout') {
      for (const k of DAY_KEYS) dayBaseTotals[k] += row[k] || 0;
    }
  }

  const overtime_earned = DAY_KEYS.reduce((acc, k) => acc + Math.max(0, dayBaseTotals[k] - 8), 0);
  return { total_hrs, overtime_earned, til_used, vacation_used };
}
