import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/totals';
import type { TimesheetEntryDraft, SubCategory } from '@/lib/types';

const subs = {
  admin_regular:  { id: 'a1', main_category: 'Admin' as const, name: 'Administrative', requires_project: false, consumes_til: false, consumes_vacation: false, is_overtime_taken: false, sort_order: 60 },
  admin_payout:   { id: 'a2', main_category: 'Admin' as const, name: 'TIL Payout',     requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: false, sort_order: 20 },
  admin_overtaken:{ id: 'a3', main_category: 'Admin' as const, name: 'Overtime Taken', requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: true,  sort_order: 10 },
  admin_vacation: { id: 'a4', main_category: 'Admin' as const, name: 'Vacation Hours', requires_project: false, consumes_til: false, consumes_vacation: true,  is_overtime_taken: false, sort_order: 40 },
} satisfies Record<string, SubCategory>;

function row(sub: SubCategory, hrs: Partial<Record<'mon_hrs'|'tue_hrs'|'wed_hrs'|'thu_hrs'|'fri_hrs'|'sat_hrs'|'sun_hrs', number>>): TimesheetEntryDraft {
  return {
    main_category: sub.main_category, sub_category_id: sub.id, project_id: null,
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
    ...hrs, description: 'x', position: 0,
  };
}

describe('computeTotals', () => {
  it('sums total hours across all rows and days', () => {
    const rows = [
      row(subs.admin_regular, { mon_hrs: 8, tue_hrs: 8 }),
      row(subs.admin_regular, { wed_hrs: 4 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.total_hrs).toBe(20);
  });

  it('accrues overtime only after 40 base hours in the week', () => {
    // 40 regular + 8 weekend = 8h overtime
    const rows = [
      row(subs.admin_regular, { mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8, fri_hrs: 8 }),
      row(subs.admin_regular, { sat_hrs: 8 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.overtime_earned).toBe(8);
  });

  it('does not treat TIL Payout as base hours', () => {
    const rows = [
      row(subs.admin_regular, { mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8, fri_hrs: 8 }),
      row(subs.admin_payout,  { mon_hrs: 20 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.overtime_earned).toBe(0);
  });

  it('does not treat TIL Overtime Taken as base hours (does not inflate overtime)', () => {
    // Utsav scenario: 32h work Mon–Thu + 8h TIL Overtime Taken on Fri.
    // Base = 32, no overtime should accrue from time-off row.
    const rows = [
      row(subs.admin_regular,   { mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8 }),
      row(subs.admin_overtaken, { fri_hrs: 8 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.overtime_earned).toBe(0);
    expect(t.til_used).toBe(8);
  });

  it('does not treat Vacation Hours as base hours', () => {
    const rows = [
      row(subs.admin_regular,  { mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8 }),
      row(subs.admin_vacation, { fri_hrs: 8 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.overtime_earned).toBe(0);
    expect(t.vacation_used).toBe(8);
  });

  it('counts TIL used as sum of consumes_til rows', () => {
    const rows = [
      row(subs.admin_overtaken, { mon_hrs: 8 }),
      row(subs.admin_payout,    { tue_hrs: 4 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.til_used).toBe(12);
  });

  it('counts vacation used as sum of consumes_vacation rows', () => {
    const rows = [
      row(subs.admin_vacation, { mon_hrs: 8, tue_hrs: 8 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.vacation_used).toBe(16);
  });
});
