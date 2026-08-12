import type { NotificationRow, NotificationKind } from './queries';

export interface FormattedNotification {
  title: string;
  href: string;
  tone: 'info' | 'success' | 'danger' | 'warning' | 'neutral';
}

/** Render copy + click target for one notification. Used by both the bell
 * dropdown and the full /me/notifications list — single source of truth. */
export function formatNotification(n: NotificationRow): FormattedNotification {
  const payload = n.payload as { week_start?: string; employee_name?: string; actor_name?: string; reason?: string };
  const week = payload.week_start ?? n.ts_week_start ?? '';
  const employee = payload.employee_name ?? 'an employee';
  const actor = payload.actor_name ?? 'an admin';
  const reason = payload.reason ? ` — ${payload.reason}` : '';

  switch (n.kind as NotificationKind) {
    case 'timesheet_submitted':
      return {
        title: `${employee} submitted the week of ${week}`,
        href: n.ts_user_id && week ? `/admin/employees/${n.ts_user_id}/week/${week}` : '/admin',
        tone: 'info',
      };
    case 'timesheet_approved':
      return {
        title: `${actor} approved your week of ${week}`,
        href: week ? `/week/${week}` : '/week/current',
        tone: 'success',
      };
    case 'timesheet_declined':
      return {
        title: `${actor} declined your week of ${week}${reason}`,
        href: week ? `/week/${week}` : '/week/current',
        tone: 'danger',
      };
    case 'timesheet_unlocked':
      return {
        title: `${actor} unlocked your week of ${week}${reason}`,
        href: week ? `/week/${week}` : '/week/current',
        tone: 'warning',
      };
    case 'timesheet_force_submitted':
      return {
        title: `${actor} submitted your week of ${week} on your behalf${reason}`,
        href: week ? `/week/${week}` : '/week/current',
        tone: 'info',
      };
    default:
      return { title: 'Notification', href: '/me/notifications', tone: 'neutral' };
  }
}
