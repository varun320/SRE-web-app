import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditCardInput, ExpenseDraftInput, ExpenseLineInput, PayoutInput } from './schemas';

export async function upsertCreditCard(sb: SupabaseClient, input: CreditCardInput): Promise<string> {
  if (input.is_default) {
    await sb.from('user_credit_cards').update({ is_default: false })
      .neq('id', input.id ?? '00000000-0000-0000-0000-000000000000');
  }
  if (input.id) {
    const { error } = await sb
      .from('user_credit_cards')
      .update({
        label: input.label,
        last_four: input.last_four ?? null,
        is_default: input.is_default,
        is_active: input.is_active,
      })
      .eq('id', input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  if (!uid) throw new Error('not authenticated');
  const { data, error } = await sb
    .from('user_credit_cards')
    .insert({
      user_id: uid,
      label: input.label,
      last_four: input.last_four ?? null,
      is_default: input.is_default,
      is_active: input.is_active,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteCreditCard(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from('user_credit_cards').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function upsertExpenseDraft(sb: SupabaseClient, input: ExpenseDraftInput): Promise<string> {
  const { data, error } = await sb.rpc('expense_upsert_draft', { payload: input });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function replaceExpenseLines(
  sb: SupabaseClient,
  expenseId: string,
  lines: readonly ExpenseLineInput[],
): Promise<void> {
  const { error } = await sb.rpc('expense_lines_replace', {
    p_expense_id: expenseId,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);
}

export async function submitExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('expense_submit', { p_expense_id: id });
  if (error) throw new Error(error.message);
}

export async function unsubmitExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('expense_unsubmit', { p_expense_id: id });
  if (error) throw new Error(error.message);
}

export async function deleteExpenseDraft(sb: SupabaseClient, id: string): Promise<void> {
  // RLS on expense_reports allows delete only when user_id=auth.uid() and status='draft'.
  const { error } = await sb.from('expense_reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function approveExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('expense_approve', { p_expense_id: id });
  if (error) throw new Error(error.message);
}

export async function declineExpense(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('expense_decline', { p_expense_id: id, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function unlockExpense(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('expense_unlock', { p_expense_id: id, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function upsertPayout(sb: SupabaseClient, input: PayoutInput): Promise<string> {
  const { data, error } = await sb.rpc('payout_upsert', { payload: input });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deletePayout(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('payout_delete', { p_payout_id: id });
  if (error) throw new Error(error.message);
}

export async function adminDeleteExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('expense_admin_delete', { p_expense_id: id });
  if (error) throw new Error(error.message);
}
