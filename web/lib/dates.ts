import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export function currentMonday(d: Date = new Date()): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function isMondayISO(iso: string): boolean {
  const d = parseISO(iso);
  return d.getDay() === 1;
}

export function weekDays(weekStartISO: string): string[] {
  const start = parseISO(weekStartISO);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

export const DAY_KEYS = ['mon_hrs','tue_hrs','wed_hrs','thu_hrs','fri_hrs','sat_hrs','sun_hrs'] as const;
export type DayKey = typeof DAY_KEYS[number];

/** "Jul 20, 2026" — the default display format for ISO dates in the UI. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, 'MMM d, yyyy');
}

/** "Mon, Jul 20" — compact form with weekday, for week headers. */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, 'EEE, MMM d');
}

/** "Jul 20, 2026 · 3:42 PM" — for timestamps. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "MMM d, yyyy · h:mm a");
}
