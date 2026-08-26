import type { SupabaseClient } from '@supabase/supabase-js';

export async function markSalesRead(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb
    .from('sales_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markSalesAllRead(sb: SupabaseClient): Promise<void> {
  const { error } = await sb
    .from('sales_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
