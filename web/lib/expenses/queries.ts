import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditCard, ExpenseBalanceRow, ExpenseLineFavourite, ExpenseLineItem, ExpensePayout, ExpenseReport, ExpenseSummary } from './types';

export async function fetchMyFavourites(sb: SupabaseClient): Promise<ExpenseLineFavourite[]> {
  const { data, error } = await sb
    .from('expense_line_favourites')
    .select('*')
    .order('label', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseLineFavourite[];
}

export async function fetchMyCreditCards(sb: SupabaseClient): Promise<CreditCard[]> {
  // Explicit user_id filter — RLS allows admins to read every user's cards
  // (needed for admin views), so without this filter the personal Settings
  // page would show an admin every employee's cards.
  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from('user_credit_cards')
    .select('*')
    .eq('user_id', uid)
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
  _userId: string,
  invoiceNo: string,
): Promise<ExpenseReport | null> {
  // RLS already scopes reads: employees see own rows; admins see any row in
  // their org. An extra user_id filter here would 404 an admin viewing an
  // employee's invoice via the shared /expenses/[invoice_no] URL.
  const { data, error } = await sb
    .from('expense_reports')
    .select('*')
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
