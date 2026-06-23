import { describe, it, expect } from 'vitest';
import { currentMonday, isMondayISO, weekDays } from '@/lib/dates';

describe('dates', () => {
  it('currentMonday returns a Monday', () => {
    expect(isMondayISO(currentMonday(new Date('2026-04-09')))).toBe(true);
    expect(currentMonday(new Date('2026-04-09'))).toBe('2026-04-06');
  });
  it('weekDays returns 7 dates starting from given Monday', () => {
    expect(weekDays('2026-04-06')).toEqual([
      '2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-11','2026-04-12',
    ]);
  });
  it('isMondayISO is false for non-Monday', () => {
    expect(isMondayISO('2026-04-07')).toBe(false);
  });
});
