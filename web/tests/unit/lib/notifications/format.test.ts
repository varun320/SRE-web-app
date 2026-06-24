import { describe, it, expect } from 'vitest';
import { formatNotification } from '@/lib/notifications/format';
import type { NotificationRow } from '@/lib/notifications/queries';

function n(over: Partial<NotificationRow>): NotificationRow {
  return {
    id: 'n1',
    kind: 'timesheet_approved',
    timesheet_id: 'ts1',
    ts_user_id: 'u1',
    ts_week_start: '2026-01-05',
    actor_id: 'a1',
    payload: {},
    read_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

describe('formatNotification', () => {
  it('renders submitted with employee name and admin link', () => {
    const out = formatNotification(n({
      kind: 'timesheet_submitted',
      payload: { week_start: '2026-01-05', employee_name: 'Alice' },
    }));
    expect(out.title).toBe('Alice submitted the week of 2026-01-05');
    expect(out.href).toBe('/admin/employees/u1/week/2026-01-05');
    expect(out.tone).toBe('info');
  });

  it('renders approved with actor name and employee link', () => {
    const out = formatNotification(n({
      kind: 'timesheet_approved',
      payload: { week_start: '2026-01-05', actor_name: 'Maaz' },
    }));
    expect(out.title).toBe('Maaz approved your week of 2026-01-05');
    expect(out.href).toBe('/week/2026-01-05');
    expect(out.tone).toBe('success');
  });

  it('renders declined with reason appended', () => {
    const out = formatNotification(n({
      kind: 'timesheet_declined',
      payload: { week_start: '2026-01-05', actor_name: 'Maaz', reason: 'fix hours' },
    }));
    expect(out.title).toContain('declined your week of 2026-01-05');
    expect(out.title).toContain('fix hours');
    expect(out.tone).toBe('danger');
  });

  it('renders unlocked with warning tone', () => {
    const out = formatNotification(n({ kind: 'timesheet_unlocked', payload: { week_start: '2026-01-05', actor_name: 'Maaz' } }));
    expect(out.tone).toBe('warning');
    expect(out.title).toContain('unlocked');
  });

  it('renders force-submitted with on-behalf phrasing', () => {
    const out = formatNotification(n({
      kind: 'timesheet_force_submitted',
      payload: { week_start: '2026-01-05', actor_name: 'Maaz' },
    }));
    expect(out.title).toContain('submitted your week');
    expect(out.title).toContain('on your behalf');
  });

  it('falls back to ts_week_start when payload.week_start is missing', () => {
    const out = formatNotification(n({
      kind: 'timesheet_approved',
      payload: { actor_name: 'X' },
      ts_week_start: '2026-02-09',
    }));
    expect(out.title).toContain('2026-02-09');
    expect(out.href).toBe('/week/2026-02-09');
  });

  it('falls back to /week/current when no week data is available', () => {
    const out = formatNotification(n({
      kind: 'timesheet_approved',
      payload: {},
      ts_week_start: null,
    }));
    expect(out.href).toBe('/week/current');
  });

  it('falls back to /admin for submitted notifications missing target', () => {
    const out = formatNotification(n({
      kind: 'timesheet_submitted',
      payload: {},
      ts_user_id: null,
      ts_week_start: null,
    }));
    expect(out.href).toBe('/admin');
  });
});
