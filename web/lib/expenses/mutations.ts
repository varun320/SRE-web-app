import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExpenseDraftInput, PayoutInput } from './schemas';

export async function upsertExpenseDraft(sb: SupabaseClient, input: ExpenseDraftInput): Promise<string> {
  const { data, error } = await sb.rpc('expense_upsert_draft', { payload: input });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function submitExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('expense_submit', { p_expense_id: id });
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
