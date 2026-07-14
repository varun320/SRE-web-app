import type { SubCategory, TimesheetEntryDraft } from '@/lib/types';

/**
 * A row is persistable when it will pass every DB constraint on
 * timesheet_entries — the NOT NULL columns, the description length check,
 * and the validate_entry trigger (main_category matches sub_category,
 * project_id present iff sub requires it).
 *
 * Autosave must filter with this before calling replace_timesheet_entries.
 * Half-finished rows stay in client state; the DB only ever sees valid ones,
 * so the atomic replace never fails from partial input.
 */
export function isPersistable(
  row: TimesheetEntryDraft,
  subById: ReadonlyMap<string, SubCategory>,
): boolean {
  if (!row.main_category) return false;
  if (!row.sub_category_id) return false;
  const sub = subById.get(row.sub_category_id);
  if (!sub) return false;
  if (sub.main_category !== row.main_category) return false;
  if (!row.description.trim()) return false;
  if (sub.requires_project && !row.project_id) return false;
  if (!sub.requires_project && row.project_id) return false;
  return true;
}

export function filterPersistable(
  rows: readonly TimesheetEntryDraft[],
  subCategories: readonly SubCategory[],
): TimesheetEntryDraft[] {
  const subById = new Map(subCategories.map((s) => [s.id, s]));
  return rows.filter((r) => isPersistable(r, subById));
}
