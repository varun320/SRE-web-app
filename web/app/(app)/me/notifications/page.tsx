import { getSupabaseServer } from '@/lib/supabase/server';
import { NotificationsList } from './NotificationsList';
import { EmailPrefToggle } from '@/components/me/EmailPrefToggle';

interface RawRow {
  id: string;
  kind: string;
  timesheet_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  timesheet: { user_id: string; week_start: string } | null;
}

export default async function NotificationsPage() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: pref } = user
    ? await sb.from('users').select('email_notifications').eq('id', user.id).maybeSingle()
    : { data: null };

  const { data, error } = await sb
    .from('notifications')
    .select(
      `id, kind, timesheet_id, actor_id, payload, read_at, created_at,
       timesheet:timesheets ( user_id, week_start )`,
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const initial = ((data as unknown as RawRow[]) ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as
      | 'timesheet_submitted'
      | 'timesheet_approved'
      | 'timesheet_declined'
      | 'timesheet_unlocked'
      | 'timesheet_force_submitted',
    timesheet_id: r.timesheet_id,
    ts_user_id: r.timesheet?.user_id ?? null,
    ts_week_start: r.timesheet?.week_start ?? null,
    actor_id: r.actor_id,
    payload: r.payload,
    read_at: r.read_at,
    created_at: r.created_at,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Everything that happened on weeks you submitted, approved, or are tracking. Newest first; up to 50.
          </p>
        </div>
      </header>
      <EmailPrefToggle initial={Boolean(pref?.email_notifications)} />
      <NotificationsList initial={initial} />
    </main>
  );
}
