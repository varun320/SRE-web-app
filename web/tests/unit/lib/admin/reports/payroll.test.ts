import { describe, it, expect } from 'vitest';
import { aggregatePayroll, type PeriodSummaryRow } from '@/lib/admin/reports/payroll';

const EPOCH = new Date('2026-01-05T00:00:00Z'); // Monday

function row(input: Partial<PeriodSummaryRow> & Pick<PeriodSummaryRow, 'user_id' | 'week_start'>): PeriodSummaryRow {
  return {
    timesheet_id: input.timesheet_id ?? `ts-${input.user_id}-${input.week_start}`,
    user_id: input.user_id,
    employee_code: input.employee_code ?? 'E001',
    full_name: input.full_name ?? 'Test User',
    week_start: input.week_start,
    regular_hrs: input.regular_hrs ?? 0,
    overtime_earned: input.overtime_earned ?? 0,
    til_used: input.til_used ?? 0,
    vacation_used: input.vacation_used ?? 0,
    til_payout_hrs: input.til_payout_hrs ?? 0,
    til_closing: input.til_closing ?? null,
    vacation_closing: input.vacation_closing ?? null,
  };
}

describe('aggregatePayroll', () => {
  it('groups two weeks in the same pay period and one in the next', () => {
    const rows = [
      row({ user_id: 'u1', week_start: '2026-01-05', regular_hrs: 40, overtime_earned: 2, til_payout_hrs: 0, til_closing: 42, vacation_closing: 200 }),
      row({ user_id: 'u1', week_start: '2026-01-12', regular_hrs: 32, overtime_earned: 0, til_used: 8, til_closing: 34, vacation_closing: 200 }),
      row({ user_id: 'u1', week_start: '2026-01-19', regular_hrs: 40, overtime_earned: 4, til_closing: 38, vacation_closing: 200 }),
    ];

    const out = aggregatePayroll(rows, { epoch: EPOCH });

    expect(out).toHaveLength(2);

    const [first, second] = out;
    expect(first.period_start).toBe('2026-01-05');
    expect(first.period_end).toBe('2026-01-18');
    expect(first.regular_hrs).toBe(72);
    expect(first.overtime_hrs).toBe(2);
    expect(first.til_used_delta).toBe(8);
    expect(first.til_earned_delta).toBe(2);
    // Closing comes from the LATEST week in the period (2026-01-12, not 2026-01-05).
    expect(first.til_closing).toBe(34);
    expect(first.vacation_closing).toBe(200);

    expect(second.period_start).toBe('2026-01-19');
    expect(second.period_end).toBe('2026-02-01');
    expect(second.regular_hrs).toBe(40);
    expect(second.overtime_hrs).toBe(4);
    expect(second.til_closing).toBe(38);
  });

  it('separates rows by employee', () => {
    const rows = [
      row({ user_id: 'u1', employee_code: 'E001', week_start: '2026-01-05', regular_hrs: 40, til_closing: 10 }),
      row({ user_id: 'u2', employee_code: 'E002', week_start: '2026-01-05', regular_hrs: 32, til_closing: 5 }),
    ];

    const out = aggregatePayroll(rows, { epoch: EPOCH });
    expect(out).toHaveLength(2);
    const e001 = out.find((r) => r.employee_code === 'E001')!;
    const e002 = out.find((r) => r.employee_code === 'E002')!;
    expect(e001.regular_hrs).toBe(40);
    expect(e002.regular_hrs).toBe(32);
  });

  it('emits no rows for an empty input', () => {
    expect(aggregatePayroll([], { epoch: EPOCH })).toEqual([]);
  });

  it('handles weeks before the epoch via negative buckets', () => {
    // 2025-12-22 is two weeks before 2026-01-05 → bucket -1
    const rows = [
      row({ user_id: 'u1', week_start: '2025-12-22', regular_hrs: 40, til_closing: 5 }),
    ];

    const out = aggregatePayroll(rows, { epoch: EPOCH });
    expect(out).toHaveLength(1);
    expect(out[0].period_start).toBe('2025-12-22');
    expect(out[0].period_end).toBe('2026-01-04');
  });

  it('outputs rows sorted by employee_code then period_start', () => {
    const rows = [
      row({ user_id: 'u2', employee_code: 'E002', week_start: '2026-01-19' }),
      row({ user_id: 'u1', employee_code: 'E001', week_start: '2026-01-19' }),
      row({ user_id: 'u1', employee_code: 'E001', week_start: '2026-01-05' }),
    ];
    const out = aggregatePayroll(rows, { epoch: EPOCH });
    expect(out.map((r) => `${r.employee_code}|${r.period_start}`)).toEqual([
      'E001|2026-01-05',
      'E001|2026-01-19',
      'E002|2026-01-19',
    ]);
  });

  it('treats missing closings as null', () => {
    const rows = [
      row({ user_id: 'u1', week_start: '2026-01-05', regular_hrs: 40 }),
    ];
    const out = aggregatePayroll(rows, { epoch: EPOCH });
    expect(out[0].til_closing).toBeNull();
    expect(out[0].vacation_closing).toBeNull();
  });
});
