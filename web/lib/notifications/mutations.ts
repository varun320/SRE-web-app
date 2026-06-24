import type { SupabaseClient } from '@supabase/supabase-js';

/** Mark a single notification as read. RLS scopes by user_id = auth.uid(). */
export async function markRead(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Mark every unread notification for the current user as read. */
export async function markAllRead(sb: SupabaseClient): Promise<void> {
  const { error } = await sb
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
