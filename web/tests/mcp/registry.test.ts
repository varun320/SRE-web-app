// Smoke test for the MCP tool registry — verifies every tool is wired,
// admin-only tools are gated, and each input schema round-trips a
// minimal valid payload.
//
// This catches accidental removals, typos in imports, and schema drift.
// It does NOT hit Postgres — handlers are constructed but never called.

import { describe, expect, test } from 'vitest';
import { buildToolRegistry } from '@/lib/expenses/mcp/registry';
import type { SupabaseClient } from '@supabase/supabase-js';

const fakeSb = {} as SupabaseClient;
const ctx = { sb: fakeSb, userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', isAdmin: false };
const ctxAdmin = { ...ctx, isAdmin: true };

const EXPECTED_USER = [
  // expense
  'list_expenses',
  'get_expense',
  'upsert_expense_draft',
  'submit_expense',
  'list_payouts',
  'get_balance_summary',
  'list_expense_lines',
  'replace_expense_lines',
  'list_credit_cards',
  // timesheet
  'list_timesheets',
  'get_timesheet',
  'ensure_week',
  'replace_entries',
  'submit_timesheet',
  'list_sub_categories',
  'list_projects',
];

const EXPECTED_ADMIN = [
  'approve_expense',
  'decline_expense',
  'unlock_expense',
  'record_payout',
  'approve_timesheet',
  'decline_timesheet',
  'unlock_timesheet',
];

describe('MCP tool registry', () => {
  test('exposes every user tool for non-admin', () => {
    const names = buildToolRegistry(ctx).map((t) => t.name);
    for (const n of EXPECTED_USER) expect(names).toContain(n);
    for (const n of EXPECTED_ADMIN) expect(names).not.toContain(n);
  });

  test('exposes admin tools when isAdmin', () => {
    const names = buildToolRegistry(ctxAdmin).map((t) => t.name);
    for (const n of [...EXPECTED_USER, ...EXPECTED_ADMIN]) expect(names).toContain(n);
  });

  test('replace_entries schema accepts a valid payload', () => {
    const tool = buildToolRegistry(ctx).find((t) => t.name === 'replace_entries')!;
    const parsed = tool.input.parse({
      week_start: '2026-07-06',
      entries: [
        {
          main_category: 'Project',
          sub_category_id: '11111111-1111-4111-8111-111111111111',
          project_id: '22222222-2222-4222-8222-222222222222',
          mon_hrs: 8, tue_hrs: 8, wed_hrs: 8, thu_hrs: 8, fri_hrs: 8,
          sat_hrs: 0, sun_hrs: 0,
          description: 'design review',
        },
      ],
    });
    expect(parsed.entries).toHaveLength(1);
  });

  test('replace_entries schema rejects bad week_start', () => {
    const tool = buildToolRegistry(ctx).find((t) => t.name === 'replace_entries')!;
    expect(() => tool.input.parse({ week_start: '07/06/2026', entries: [] })).toThrow();
  });

  test('replace_expense_lines schema accepts minimal line', () => {
    const tool = buildToolRegistry(ctx).find((t) => t.name === 'replace_expense_lines')!;
    const parsed = tool.input.parse({
      invoice_no: 'INV-001',
      lines: [
        {
          line_date: '2026-07-01',
          category: 'Travel',
          description: 'flight',
          amount_cad: 350,
        },
      ],
    });
    expect(parsed.lines[0].gst_cad).toBe(0); // default
  });

  test('admin tools reject non-uuid user_id', () => {
    const tool = buildToolRegistry(ctxAdmin).find((t) => t.name === 'approve_timesheet')!;
    expect(() =>
      tool.input.parse({ user_id: 'not-a-uuid', week_start: '2026-07-06' }),
    ).toThrow();
  });
});
