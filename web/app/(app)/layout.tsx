import { getSupabaseServer } from '@/lib/supabase/server';
import { Header } from '@/components/shell/Header';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const admin = await fetchIsAdmin(supabase);
  return (
    <div className="min-h-dvh flex flex-col">
      <Header email={user.email ?? ''} isAdmin={admin} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
