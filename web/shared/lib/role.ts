import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchIsAdmin(sb: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from('user_roles').select('role').eq('user_id', user.id);
  return (data ?? []).some((r) => r.role === 'admin');
}
