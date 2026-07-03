// Tool registry shared by both MCP transports (stdio + remote HTTP).
//
// The transport layer resolves the caller's Supabase session, then calls
// buildToolRegistry({ sb, userId, isAdmin }) to get the array of tools that
// user is allowed to invoke.

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  approveExpense,
  approveInput,
  declineExpense,
  declineInput,
  getBalanceSummary,
  getExpense,
  getExpenseInput,
  listExpenses,
  listExpensesInput,
  listPayouts,
  listPayoutsInput,
  recordPayout,
  recordPayoutInput,
  submitExpense,
  submitInput,
  unlockExpense,
  unlockInput,
  upsertDraft,
  upsertDraftInput,
} from './tools.js';

export interface ToolDef {
  name: string;
  description: string;
  input: z.ZodTypeAny;
  adminOnly?: boolean;
  handler: (args: unknown) => Promise<unknown>;
}

export interface RegistryContext {
  sb: SupabaseClient;
  userId: string;
  isAdmin: boolean;
}

export function buildToolRegistry(ctx: RegistryContext): ToolDef[] {
  const { sb, userId, isAdmin } = ctx;

  const all: ToolDef[] = [
    {
      name: 'list_expenses',
      description:
        "List the signed-in user's expense reports, newest first. Optional status/date range filters.",
      input: listExpensesInput,
      handler: (a) => listExpenses(sb, listExpensesInput.parse(a)),
    },
    {
      name: 'get_expense',
      description:
        'Get one expense report by invoice_no, including balance and any recorded payouts.',
      input: getExpenseInput,
      handler: (a) => getExpense(sb, userId, getExpenseInput.parse(a)),
    },
    {
      name: 'upsert_expense_draft',
      description:
        'Create-or-update a draft expense report (yellow cells only). Returns the row id.',
      input: upsertDraftInput,
      handler: (a) => upsertDraft(sb, upsertDraftInput.parse(a)),
    },
    {
      name: 'submit_expense',
      description:
        'Submit a draft (or previously declined) expense report to the admin for approval.',
      input: submitInput,
      handler: (a) => submitExpense(sb, userId, submitInput.parse(a)),
    },
    {
      name: 'list_payouts',
      description: 'List payouts. Filter by invoice_no when you care about a single report.',
      input: listPayoutsInput,
      handler: (a) => listPayouts(sb, listPayoutsInput.parse(a)),
    },
    {
      name: 'get_balance_summary',
      description:
        'Get the Summary-sheet totals and the full per-invoice balance & interest table.',
      input: z.object({}),
      handler: () => getBalanceSummary(sb, userId),
    },
    {
      name: 'approve_expense',
      description: 'Admin only. Approve a submitted expense report and lock it.',
      input: approveInput,
      adminOnly: true,
      handler: (a) => approveExpense(sb, approveInput.parse(a)),
    },
    {
      name: 'decline_expense',
      description: 'Admin only. Decline a submitted expense report with a reason.',
      input: declineInput,
      adminOnly: true,
      handler: (a) => declineExpense(sb, declineInput.parse(a)),
    },
    {
      name: 'unlock_expense',
      description:
        'Admin only. Unlock an approved expense so the employee can amend and resubmit.',
      input: unlockInput,
      adminOnly: true,
      handler: (a) => unlockExpense(sb, unlockInput.parse(a)),
    },
    {
      name: 'record_payout',
      description: 'Admin only. Record a payment received against a specific invoice.',
      input: recordPayoutInput,
      adminOnly: true,
      handler: (a) => recordPayout(sb, recordPayoutInput.parse(a)),
    },
  ];

  return all.filter((t) => isAdmin || !t.adminOnly);
}
