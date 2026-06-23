import { getSupabaseServer } from '@/lib/supabase/server';
import { Header } from '@/components/shell/Header';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="min-h-dvh flex flex-col">
      <Header email={user.email ?? ''} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
