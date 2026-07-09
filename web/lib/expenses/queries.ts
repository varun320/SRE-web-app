import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditCard, ExpenseBalanceRow, ExpenseLineItem, ExpensePayout, ExpenseReport, ExpenseSummary } from './types';

export async function fetchMyCreditCards(sb: SupabaseClient): Promise<CreditCard[]> {
  const { data, error } = await sb
    .from('user_credit_cards')
    .select('*')
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CreditCard[];
}

export async function fetchExpenseLines(sb: SupabaseClient, expenseId: string): Promise<ExpenseLineItem[]> {
  const { data, error } = await sb
    .from('expense_line_items')
    .select('*')
    .eq('expense_id', expenseId)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseLineItem[];
}

export async function fetchMyExpenses(sb: SupabaseClient): Promise<ExpenseReport[]> {
  const { data, error } = await sb
    .from('expense_reports')
    .select('*')
    .order('submission_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseReport[];
}

export async function fetchExpenseById(sb: SupabaseClient, id: string): Promise<ExpenseReport | null> {
  const { data, error } = await sb.from('expense_reports').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExpenseReport | null) ?? null;
}

export async function fetchExpenseByInvoice(
  sb: SupabaseClient,
  userId: string,
  invoiceNo: string,
): Promise<ExpenseReport | null> {
  const { data, error } = await sb
    .from('expense_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('invoice_no', invoiceNo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExpenseReport | null) ?? null;
}

export async function fetchBalanceForUser(sb: SupabaseClient, userId: string): Promise<ExpenseBalanceRow[]> {
  const { data, error } = await sb
    .from('v_expense_balance_full')
    .select('*')
    .eq('user_id', userId)
    .order('submission_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseBalanceRow[];
}

export async function fetchSummary(sb: SupabaseClient, userId: string): Promise<ExpenseSummary | null> {
  const { data, error } = await sb
    .from('v_expense_summary')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExpenseSummary | null) ?? null;
}

export async function fetchPayouts(sb: SupabaseClient, invoiceNo?: string): Promise<ExpensePayout[]> {
  let q = sb.from('expense_payouts').select('*').order('payout_date', { ascending: false });
  if (invoiceNo) q = q.eq('invoice_no', invoiceNo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpensePayout[];
}
