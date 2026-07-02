import { describe, it, expect } from 'vitest';
import {
  approveInput,
  declineInput,
  getExpenseInput,
  listExpensesInput,
  recordPayoutInput,
  submitInput,
  unlockInput,
  upsertDraftInput,
} from './tools.js';

describe('input schemas', () => {
  it('accepts a well-formed draft', () => {
    const parsed = upsertDraftInput.parse({
      invoice_no: 'UC2026005',
      period_from: '2026-04-01',
      period_to: '2026-04-30',
      amount_cad: 6500,
      gst_cad: 325,
      notes: 'April travel',
    });
    expect(parsed.amount_cad).toBe(6500);
    expect(parsed.gst_cad).toBe(325);
  });

  it('rejects short invoice_no', () => {
    expect(() =>
      upsertDraftInput.parse({
        invoice_no: 'X',
        period_from: '2026-04-01',
        period_to: '2026-04-30',
        amount_cad: 100,
      }),
    ).toThrow();
  });

  it('rejects bad date format', () => {
    expect(() =>
      upsertDraftInput.parse({
        invoice_no: 'UC2026005',
        period_from: '04-01-2026',
        period_to: '2026-04-30',
        amount_cad: 100,
      }),
    ).toThrow();
  });

  it('accepts optional filters on list_expenses', () => {
    expect(listExpensesInput.parse({})).toEqual({});
    expect(listExpensesInput.parse({ status: 'submitted' }).status).toBe('submitted');
  });

  it('requires reason on decline / unlock', () => {
    expect(() =>
      declineInput.parse({ user_id: '00000000-0000-0000-0000-000000000000', invoice_no: 'UC1' }),
    ).toThrow();
    expect(() =>
      unlockInput.parse({ user_id: '00000000-0000-0000-0000-000000000000', invoice_no: 'UC2026001' }),
    ).toThrow();
  });

  it('validates payout amount is positive', () => {
    expect(() =>
      recordPayoutInput.parse({
        user_id: '00000000-0000-0000-0000-000000000000',
        invoice_no: 'UC2026001',
        payout_date: '2026-05-01',
        amount_cad: 0,
      }),
    ).toThrow();
  });

  it('parses minimal submit / get / approve inputs', () => {
    expect(submitInput.parse({ invoice_no: 'UC2026001' }).invoice_no).toBe('UC2026001');
    expect(getExpenseInput.parse({ invoice_no: 'UC2026001' }).invoice_no).toBe('UC2026001');
    expect(
      approveInput.parse({
        user_id: '00000000-0000-0000-0000-000000000000',
        invoice_no: 'UC2026001',
      }).invoice_no,
    ).toBe('UC2026001');
  });
});
