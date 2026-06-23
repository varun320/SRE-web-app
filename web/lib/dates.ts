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
