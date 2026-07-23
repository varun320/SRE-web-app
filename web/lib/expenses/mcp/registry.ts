// Tool registry shared by both MCP transports (stdio + remote HTTP).
//
// Despite the folder name, this is the app-wide MCP registry — it wires up
// both expense and timesheet tool handlers. The transport layer resolves
// the caller's Supabase session, then calls buildToolRegistry({ sb, userId,
// isAdmin }) to get the array of tools that user is allowed to invoke.

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
  listCreditCards,
  listExpenseLines,
  listExpenses,
  listExpensesInput,
  listLinesInput,
  listPayouts,
  listPayoutsInput,
  recordPayout,
  recordPayoutInput,
  replaceExpenseLines,
  replaceLinesInput,
  submitExpense,
  submitInput,
  unlockExpense,
  unlockInput,
  uploadReceiptInput,
  uploadReceiptTool,
  upsertDraft,
  upsertDraftInput,
} from './tools.js';
import {
  adminApproveInput,
  adminReasonInput,
  approveTimesheet,
  declineTimesheet,
  ensureWeek,
  getTimesheet,
  listActiveProjects,
  listSubCategories,
  listTimesheets,
  listTimesheetsInput,
  replaceEntriesInput,
  replaceTimesheetEntries,
  submitInput as tsSubmitInput,
  submitTimesheet,
  unlockTimesheet,
  weekInput,
} from '../../timesheet/mcp/tools.js';

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
      name: 'list_expense_lines',
      description:
        "List line items for an expense report by invoice_no (dated rows with category, amount, GST, optional credit card + receipt).",
      input: listLinesInput,
      handler: (a) => listExpenseLines(sb, userId, listLinesInput.parse(a)),
    },
    {
      name: 'replace_expense_lines',
      description:
        'Replace-all line items on a DRAFT expense report atomically. Report totals (amount_cad, gst_cad) are recomputed from the lines by the DB.',
      input: replaceLinesInput,
      handler: (a) => replaceExpenseLines(sb, userId, replaceLinesInput.parse(a)),
    },
    {
      name: 'upload_receipt',
      description:
        'Upload a receipt image (jpg/png/webp/heic) or PDF for an expense report. Pass raw bytes as content_base64 (max 5 MB decoded). Returns storage_key — pass that as receipt_url on the matching line in replace_expense_lines.',
      input: uploadReceiptInput,
      handler: (a) => uploadReceiptTool(sb, userId, uploadReceiptInput.parse(a)),
    },
    {
      name: 'list_credit_cards',
      description:
        "List the signed-in user's credit cards (id + label + last_four). Use to reference credit_card_id on lines.",
      input: z.object({}),
      handler: () => listCreditCards(sb, userId),
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

    // --- Timesheet -----------------------------------------------------------
    {
      name: 'list_timesheets',
      description:
        "List the signed-in user's timesheets, newest week first. Optional status/date range filters.",
      input: listTimesheetsInput,
      handler: (a) => listTimesheets(sb, listTimesheetsInput.parse(a)),
    },
    {
      name: 'get_timesheet',
      description:
        'Get one timesheet by week_start (Monday, YYYY-MM-DD), including entries and computed totals (base/OT/TIL/vacation).',
      input: weekInput,
      handler: (a) => getTimesheet(sb, userId, weekInput.parse(a)),
    },
    {
      name: 'ensure_week',
      description:
        'Create-or-get the draft timesheet for a given Monday. Returns { id, week_start }. Call before replace_entries if you want to be explicit; replace_entries also auto-creates.',
      input: weekInput,
      handler: (a) => ensureWeek(sb, weekInput.parse(a)),
    },
    {
      name: 'replace_entries',
      description:
        'Atomically replace all entries on a draft (or declined) timesheet. Auto-creates the week if missing. Each entry needs main_category, sub_category_id, mon..sun hours, description, and project_id if the sub-category requires one.',
      input: replaceEntriesInput,
      handler: (a) => replaceTimesheetEntries(sb, userId, replaceEntriesInput.parse(a)),
    },
    {
      name: 'submit_timesheet',
      description: 'Submit a draft (or previously declined) timesheet to admin for approval.',
      input: tsSubmitInput,
      handler: (a) => submitTimesheet(sb, userId, tsSubmitInput.parse(a)),
    },
    {
      name: 'list_sub_categories',
      description:
        'List timesheet sub-categories with their IDs, main_category, requires_project flag, and TIL/vacation semantics. Use to pick a valid sub_category_id for entries.',
      input: z.object({}),
      handler: () => listSubCategories(sb),
    },
    {
      name: 'list_projects',
      description:
        'List active projects with IDs and project numbers. Use to pick a project_id when a sub-category requires one.',
      input: z.object({}),
      handler: () => listActiveProjects(sb),
    },
    {
      name: 'approve_timesheet',
      description: 'Admin only. Approve a submitted timesheet (locks it, freezes ledgers).',
      input: adminApproveInput,
      adminOnly: true,
      handler: (a) => approveTimesheet(sb, adminApproveInput.parse(a)),
    },
    {
      name: 'decline_timesheet',
      description: 'Admin only. Decline a submitted timesheet with a reason.',
      input: adminReasonInput,
      adminOnly: true,
      handler: (a) => declineTimesheet(sb, adminReasonInput.parse(a)),
    },
    {
      name: 'unlock_timesheet',
      description:
        'Admin only. Unlock an approved timesheet so the employee can amend and resubmit. Marks subsequent ledger rows stale.',
      input: adminReasonInput,
      adminOnly: true,
      handler: (a) => unlockTimesheet(sb, adminReasonInput.parse(a)),
    },
  ];

  return all.filter((t) => isAdmin || !t.adminOnly);
}
