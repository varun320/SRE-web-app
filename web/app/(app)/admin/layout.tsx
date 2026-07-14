import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';
import { AdminSubnav } from '@/components/shell/AdminSubnav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const admin = await fetchIsAdmin(sb);
  if (!admin) redirect('/home');
  return (
    <main className="w-full">
      <AdminSubnav />
      {children}
    </main>
  );
}
