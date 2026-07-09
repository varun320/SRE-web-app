import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';
import { AdminSubnav } from '@/components/shell/AdminSubnav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const admin = await fetchIsAdmin(sb);
  if (!admin) redirect('/week/current');
  return (
    <main className="w-full">
      <div className="px-3 md:px-4 pt-4 md:pt-6 pb-3 flex items-baseline justify-between gap-4">
        <h1 className="text-h1">Admin</h1>
      </div>
      <AdminSubnav />
      {children}
    </main>
  );
}
