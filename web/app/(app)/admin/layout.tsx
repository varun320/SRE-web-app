import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';
import { AdminSubnav } from '@/components/shell/AdminSubnav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const admin = await fetchIsAdmin(sb);
  if (!admin) redirect('/week/current');
  return (
    <main className="mx-auto max-w-7xl">
      <div className="px-4 md:px-6 pt-6 md:pt-8 pb-3 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      </div>
      <AdminSubnav />
      {children}
    </main>
  );
}
