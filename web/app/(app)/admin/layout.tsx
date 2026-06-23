import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const admin = await fetchIsAdmin(sb);
  if (!admin) redirect('/week/current');
  return (
    <main className="mx-auto max-w-6xl">
      <div className="px-6 pt-8 pb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex gap-4 text-sm text-[var(--color-text-muted)]">
          <Link href="/admin">Approvals</Link>
          <Link href="/admin/employees">Employees</Link>
          <Link href="/admin/projects">Projects</Link>
          <Link href="/admin/positions">Positions</Link>
          <Link href="/admin/approvals">Audit log</Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
