/**
 * Hours-by-category aggregator. Groups approved timesheet entries by
 * main category and sub-category so admins can see time distribution.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CategoryHoursRow {
  main_category: string;
  sub_category: string;
  hrs: number;
}

export interface CategoryBreakdown {
  main_category: string;
  total_hrs: number;
  by_sub: { sub_category: string; hrs: number }[];
}

export function aggregateByCategory(rows: readonly CategoryHoursRow[]): CategoryBreakdown[] {
  if (rows.length === 0) return [];

  const byMain = new Map<string, CategoryBreakdown>();
  for (const r of rows) {
    let acc = byMain.get(r.main_category);
    if (!acc) {
      acc = { main_category: r.main_category, total_hrs: 0, by_sub: [] };
      byMain.set(r.main_category, acc);
    }
    acc.total_hrs += r.hrs;

    const sub = acc.by_sub.find((s) => s.sub_category === r.sub_category);
    if (sub) sub.hrs += r.hrs;
    else acc.by_sub.push({ sub_category: r.sub_category, hrs: r.hrs });
  }

  for (const m of byMain.values()) {
    m.by_sub.sort((a, b) => b.hrs - a.hrs);
  }
  return [...byMain.values()].sort((a, b) => b.total_hrs - a.total_hrs);
}

export interface FetchCategoryHoursArgs {
  from: string;
  to: string;
}

interface RawEntry {
  main_category: string;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  sub_category: { name: string } | null;
  timesheet: { status: string; week_start: string } | null;
}

export async function fetchCategoryHours(
  sb: SupabaseClient,
  args: FetchCategoryHoursArgs,
): Promise<CategoryHoursRow[]> {
  const { data, error } = await sb
    .from('timesheet_entries')
    .select(
      `main_category, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs,
       sub_category:sub_categories ( name ),
       timesheet:timesheets!inner ( status, week_start )`,
    )
    .eq('timesheet.status', 'approved')
    .gte('timesheet.week_start', args.from)
    .lte('timesheet.week_start', args.to);
  if (error) throw new Error(error.message);

  const rows: CategoryHoursRow[] = [];
  for (const r of (data ?? []) as unknown as RawEntry[]) {
    const hrs =
      Number(r.mon_hrs ?? 0) + Number(r.tue_hrs ?? 0) + Number(r.wed_hrs ?? 0) +
      Number(r.thu_hrs ?? 0) + Number(r.fri_hrs ?? 0) + Number(r.sat_hrs ?? 0) +
      Number(r.sun_hrs ?? 0);
    if (hrs === 0) continue;
    rows.push({
      main_category: r.main_category,
      sub_category: r.sub_category?.name ?? '(unknown)',
      hrs,
    });
  }
  return rows;
}

export function toCsv(breakdown: readonly CategoryBreakdown[]): string {
  const lines = ['main_category,sub_category,hours'];
  for (const m of breakdown) {
    for (const s of m.by_sub) {
      lines.push(`${csvCell(m.main_category)},${csvCell(s.sub_category)},${s.hrs.toFixed(2)}`);
    }
  }
  return lines.join('\n');
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
