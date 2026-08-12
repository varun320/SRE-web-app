import Link from 'next/link';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { EmptyState } from '@/shared/ui/empty-state';
import { fetchMyTasks, fetchTeamRoster, type MyTaskRow } from '@/features/projects/queries';
import { MyTasksList } from '@/features/projects/components/MyTasksList';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}

interface Buckets {
  overdue: MyTaskRow[];
  today: MyTaskRow[];
  thisWeek: MyTaskRow[];
  later: MyTaskRow[];
  noDate: MyTaskRow[];
  completed: MyTaskRow[];
}

function bucket(tasks: MyTaskRow[]): Buckets {
  const b: Buckets = { overdue: [], today: [], thisWeek: [], later: [], noDate: [], completed: [] };
  for (const t of tasks) {
    if (t.status === 'done') { b.completed.push(t); continue; }
    const d = daysUntil(t.due_date);
    if (d === null) b.noDate.push(t);
    else if (d < 0) b.overdue.push(t);
    else if (d === 0) b.today.push(t);
    else if (d <= 7) b.thisWeek.push(t);
    else b.later.push(t);
  }
  return b;
}

export default async function MyTasksPage() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const [tasks, users] = await Promise.all([fetchMyTasks(sb, userId), fetchTeamRoster(sb)]);
  const buckets = bucket(tasks);
  const openCount = tasks.length - buckets.completed.length;

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <ListChecks className="h-3.5 w-3.5" /> My tasks
        </div>
        <h1 className="mt-1 text-h1">Your open work</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          {openCount} open · {buckets.completed.length} completed. Click any task to edit; tick the box to mark done.
        </p>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing assigned to you"
          description="Ask a project lead to add you to a job's team, or create your own job through Projects → New job."
        />
      ) : (
        <MyTasksList buckets={buckets} assignableUsers={users} />
      )}
    </main>
  );
}
