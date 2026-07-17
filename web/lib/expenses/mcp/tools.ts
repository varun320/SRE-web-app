// Business logic layer for the expense-tracker MCP surface.
//
// This is the SINGLE source of truth for expense MCP tool handlers. Both the
// stdio server (scripts/mcp-expense) and the remote HTTP server (web/app/mcp)
// import from here.
//
// Every handler takes an already-authenticated SupabaseClient — the transport
// layer is responsible for binding auth.uid() before calling in.

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const upsertDraftInput = z.object({
  id: z.string().uuid().optional(),
  invoice_no: z.string().min(3).max(32),
  period_from: dateStr,
  period_to: dateStr,
  submission_date: dateStr.optional(),
  amount_cad: z.number().nonnegative(),
  gst_cad: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const listExpensesInput = z.object({
  status: z.enum(['draft', 'submitted', 'approved', 'declined', 'paid']).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export const getExpenseInput = z.object({ invoice_no: z.string().min(3) });

export const submitInput = z.object({ invoice_no: z.string().min(3) });

export const listPayoutsInput = z.object({ invoice_no: z.string().min(3).optional() });

export const recordPayoutInput = z.object({
  user_id: z.string().uuid(),
  invoice_no: z.string().min(3),
  payout_date: dateStr,
  amount_cad: z.number().positive(),
  reference: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

export const approveInput = z.object({
  invoice_no: z.string().min(3),
  user_id: z.string().uuid(),
});
export const declineInput = approveInput.extend({ reason: z.string().min(3).max(500) });
export const unlockInput = declineInput;

export const expenseLineInput = z.object({
  line_date: dateStr,
  category: z.string().min(1).max(40),
  description: z.string().trim().min(1).max(500),
  amount_cad: z.number().nonnegative(),
  gst_cad: z.number().nonnegative().default(0),
  credit_card_id: z.string().uuid().nullable().optional(),
  receipt_url: z.string().max(400).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  native_amount: z.number().nonnegative().nullable().optional(),
  native_currency: z.string().regex(/^[A-Za-z]{3}$/).nullable().optional(),
});
export const replaceLinesInput = z.object({
  invoice_no: z.string().min(3),
  lines: z.array(expenseLineInput),
});
export const listLinesInput = z.object({ invoice_no: z.string().min(3) });

async function findByInvoice(
  sb: SupabaseClient,
  userId: string,
  invoiceNo: string,
): Promise<{ id: string } | null> {
  const { data, error } = await sb
    .from('expense_reports')
    .select('id')
    .eq('user_id', userId)
    .eq('invoice_no', invoiceNo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null) ?? null;
}

export async function listExpenses(
  sb: SupabaseClient,
  input: z.infer<typeof listExpensesInput>,
) {
  let q = sb.from('expense_reports').select('*').order('submission_date', { ascending: false });
  if (input.status) q = q.eq('status', input.status);
  if (input.from) q = q.gte('submission_date', input.from);
  if (input.to) q = q.lte('submission_date', input.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function getExpense(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof getExpenseInput>,
) {
  const { data: report, error: rErr } = await sb
    .from('expense_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('invoice_no', input.invoice_no)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!report) throw new Error(`No expense with invoice_no=${input.invoice_no}`);

  const [{ data: bal }, { data: pays }, { data: lines }] = await Promise.all([
    sb.from('v_expense_balance_full').select('*').eq('id', (report as { id: string }).id).maybeSingle(),
    sb.from('expense_payouts').select('*').eq('user_id', userId).eq('invoice_no', input.invoice_no),
    sb.from('expense_line_items').select('*').eq('expense_id', (report as { id: string }).id).order('position'),
  ]);
  return { report, balance: bal, payouts: pays ?? [], lines: lines ?? [] };
}

export async function listExpenseLines(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof listLinesInput>,
) {
  const row = await findByInvoice(sb, userId, input.invoice_no);
  if (!row) throw new Error(`No expense with invoice_no=${input.invoice_no}`);
  const { data, error } = await sb
    .from('expense_line_items')
    .select('*')
    .eq('expense_id', row.id)
    .order('position');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function replaceExpenseLines(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof replaceLinesInput>,
) {
  const row = await findByInvoice(sb, userId, input.invoice_no);
  if (!row) throw new Error(`No expense with invoice_no=${input.invoice_no}`);
  const { error } = await sb.rpc('expense_lines_replace', {
    p_expense_id: row.id,
    p_lines: input.lines,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, count: input.lines.length };
}

export async function listCreditCards(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('user_credit_cards')
    .select('id, label, last_four, is_default, is_active')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('label');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertDraft(
  sb: SupabaseClient,
  input: z.infer<typeof upsertDraftInput>,
) {
  const { data, error } = await sb.rpc('expense_upsert_draft', { payload: input });
  if (error) throw new Error(error.message);
  return { id: data as string };
}

export async function submitExpense(
  sb: SupabaseClient,
  userId: string,
  input: z.infer<typeof submitInput>,
) {
  const row = await findByInvoice(sb, userId, input.invoice_no);
  if (!row) throw new Error(`No expense with invoice_no=${input.invoice_no}`);
  const { error } = await sb.rpc('expense_submit', { p_expense_id: row.id });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'submitted' };
}

export async function listPayouts(
  sb: SupabaseClient,
  input: z.infer<typeof listPayoutsInput>,
) {
  let q = sb.from('expense_payouts').select('*').order('payout_date', { ascending: false });
  if (input.invoice_no) q = q.eq('invoice_no', input.invoice_no);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function getBalanceSummary(sb: SupabaseClient, userId: string) {
  const [{ data: summary }, { data: rows }] = await Promise.all([
    sb.from('v_expense_summary').select('*').eq('user_id', userId).maybeSingle(),
    sb
      .from('v_expense_balance_full')
      .select('*')
      .eq('user_id', userId)
      .order('submission_date', { ascending: false }),
  ]);
  return { summary, invoices: rows ?? [] };
}

// -- Admin-only wrappers ------------------------------------------------------

export async function approveExpense(sb: SupabaseClient, input: z.infer<typeof approveInput>) {
  const row = await findByInvoice(sb, input.user_id, input.invoice_no);
  if (!row) throw new Error('expense not found');
  const { error } = await sb.rpc('expense_approve', { p_expense_id: row.id });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'approved' };
}

export async function declineExpense(sb: SupabaseClient, input: z.infer<typeof declineInput>) {
  const row = await findByInvoice(sb, input.user_id, input.invoice_no);
  if (!row) throw new Error('expense not found');
  const { error } = await sb.rpc('expense_decline', {
    p_expense_id: row.id,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'declined' };
}

export async function unlockExpense(sb: SupabaseClient, input: z.infer<typeof unlockInput>) {
  const row = await findByInvoice(sb, input.user_id, input.invoice_no);
  if (!row) throw new Error('expense not found');
  const { error } = await sb.rpc('expense_unlock', {
    p_expense_id: row.id,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { id: row.id, status: 'unlocked' };
}

export async function recordPayout(sb: SupabaseClient, input: z.infer<typeof recordPayoutInput>) {
  const { data, error } = await sb.rpc('payout_upsert', { payload: input });
  if (error) throw new Error(error.message);
  return { id: data as string };
}
