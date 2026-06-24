import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind =
  | 'timesheet_submitted'
  | 'timesheet_approved'
  | 'timesheet_declined'
  | 'timesheet_unlocked'
  | 'timesheet_force_submitted';

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  timesheet_id: string | null;
  /** user_id on the timesheet — owner of the week; used to route admin notifications */
  ts_user_id: string | null;
  ts_week_start: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/** Count of unread notifications for the current user. RLS limits scope. */
export async function fetchUnreadCount(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** N most recent notifications for the current user, joined with timesheet
 * meta so the bell can route to the right page without extra round-trips. */
export async function fetchRecent(sb: SupabaseClient, limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await sb
    .from('notifications')
    .select(
      `id, kind, timesheet_id, actor_id, payload, read_at, created_at,
       timesheet:timesheets ( user_id, week_start )`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  type Raw = Omit<NotificationRow, 'ts_user_id' | 'ts_week_start'> & {
    timesheet: { user_id: string; week_start: string } | null;
  };
  return ((data as unknown as Raw[]) ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    timesheet_id: r.timesheet_id,
    ts_user_id: r.timesheet?.user_id ?? null,
    ts_week_start: r.timesheet?.week_start ?? null,
    actor_id: r.actor_id,
    payload: r.payload,
    read_at: r.read_at,
    created_at: r.created_at,
  }));
}
