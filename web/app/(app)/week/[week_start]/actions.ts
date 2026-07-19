'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { ensureWeek, replaceEntries } from '@/lib/queries';
import { friendlyError } from '@/lib/errors';
import { revalidatePath } from 'next/cache';
import type { MainCategory, TimesheetEntryDraft } from '@/lib/types';

interface CopyResult {
  ok?: true;
  copied?: number;
  error?: string;
}

/**
 * Copy the previous week's entries into the given week's timesheet.
 * Replaces whatever's currently there. Hours copy as-is — the user can
 * tweak day cells before saving.
 */
export async function copyLastWeek(currentWeekStart: string): Promise<CopyResult> {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) return { error: 'Not signed in.' };

  const prev = shiftMonday(currentWeekStart, -7);
  if (!prev) return { error: 'Invalid week' };

  const { data: prevTs, error: prevErr } = await sb
    .from('timesheets')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', prev)
    .maybeSingle();
  if (prevErr) return { error: friendlyError(prevErr) };
  if (!prevTs) return { error: `No timesheet exists for the week of ${prev} — nothing to copy.` };

  const { data: prevEntries, error: entriesErr } = await sb
    .from('timesheet_entries')
    .select('main_category, sub_category_id, project_id, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs, description, position')
    .eq('timesheet_id', prevTs.id)
    .order('position');
  if (entriesErr) return { error: friendlyError(entriesErr) };
  if (!prevEntries || prevEntries.length === 0) {
    return { error: 'Previous week had no rows to copy.' };
  }

  let currentTsId: string;
  try {
    currentTsId = await ensureWeek(sb, currentWeekStart);
  } catch (e) {
    return { error: friendlyError(e, 'Could not open the current week') };
  }

  const payload: Omit<TimesheetEntryDraft, 'id'>[] = prevEntries.map((r) => ({
    main_category: r.main_category as MainCategory,
    sub_category_id: r.sub_category_id,
    project_id: r.project_id,
    mon_hrs: r.mon_hrs,
    tue_hrs: r.tue_hrs,
    wed_hrs: r.wed_hrs,
    thu_hrs: r.thu_hrs,
    fri_hrs: r.fri_hrs,
    sat_hrs: r.sat_hrs,
    sun_hrs: r.sun_hrs,
    description: r.description,
    position: r.position,
  }));

  try {
    await replaceEntries(sb, currentTsId, payload);
  } catch (e) {
    return { error: friendlyError(e, 'Copy failed') };
  }

  revalidatePath(`/week/${currentWeekStart}`);
  return { ok: true, copied: payload.length };
}

function shiftMonday(iso: string, days: number): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
