import type { SupabaseClient } from '@supabase/supabase-js';

export async function approveTimesheet(sb: SupabaseClient, id: string, comment: string | null): Promise<void> {
  const { error } = await sb.rpc('approve_timesheet', { p_timesheet_id: id, p_comment: comment });
  if (error) throw error;
}

export async function declineTimesheet(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('decline_timesheet', { p_timesheet_id: id, p_reason: reason });
  if (error) throw error;
}

export async function unlockTimesheet(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('unlock_timesheet', { p_timesheet_id: id, p_reason: reason });
  if (error) throw error;
}

export async function adminForceSubmit(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('admin_force_submit', { p_timesheet_id: id, p_reason: reason });
  if (error) throw error;
}
