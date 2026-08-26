import type { SupabaseClient } from '@supabase/supabase-js';
import type { SalesNotificationCategory, SalesNotificationRow } from './types';

export async function fetchSalesUnreadCount(
  sb: SupabaseClient,
): Promise<number> {
  const { count, error } = await sb
    .from('sales_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) {
    // ponytail: swallow "relation does not exist" so the bell still works before
    // the migration has been applied; other errors bubble up.
    if (error.code === '42P01') return 0;
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
    if (error.code === '42P01') return [];
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
    if (error.code === '42P01') return [];
    throw new Error(error.message);
  }
  return (data ?? []) as SalesNotificationRow[];
}
