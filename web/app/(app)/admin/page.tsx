import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalQueue } from '@/components/admin/ApprovalQueue';

export default async function AdminHome() {
  const sb = await getSupabaseServer();
  const rows = await fetchSubmittedQueue(sb);
  return <ApprovalQueue rows={rows} />;
}
