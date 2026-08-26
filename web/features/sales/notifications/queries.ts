import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { SalesNotificationCategory, SalesNotificationRow } from './types';

// The sales_notifications table ships with a migration that may not be applied
// yet in a given environment. Rather than 500 the bell / inbox before the
// migration lands, treat "table doesn't exist" as an empty result. Covers both
// the PG error code (42P01) and PostgREST's schema-cache miss (PGRST205, which
// also surfaces as a message including "Could not find the table").
function isMissingTable(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  if (error.code === 'PGRST205') return true;
  return /could not find the table/i.test(error.message ?? '');
}

export async function fetchSalesUnreadCount(
  sb: SupabaseClient,
): Promise<number> {
  const { count, error } = await sb
    .from('sales_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) {
    if (isMissingTable(error)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function fetchSalesRecent(
  sb: SupabaseClient,
  limit = 10,
): Promise<SalesNotificationRow[]> {
  const { data, error } = await sb
    .from('sales_notifications')
    .select('id, engineer_id, category, opportunity_id, title, body, action_url, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as SalesNotificationRow[];
}

interface FetchPageOpts {
  category?: SalesNotificationCategory | null;
  limit: number;
  before?: string | null;
}

export async function fetchSalesPage(
  sb: SupabaseClient,
  { category, limit, before }: FetchPageOpts,
): Promise<SalesNotificationRow[]> {
  let q = sb
    .from('sales_notifications')
    .select('id, engineer_id, category, opportunity_id, title, body, action_url, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (category) q = q.eq('category', category);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as SalesNotificationRow[];
}
