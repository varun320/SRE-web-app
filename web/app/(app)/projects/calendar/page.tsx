import Link from 'next/link';
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchTasksInRange, fetchTeamRoster } from '@/features/projects/queries';
import { CalendarGrid } from '@/features/projects/components/CalendarGrid';

// Month string helpers — kept local to this route, tiny and dumb.
function parseMonth(m: string | undefined): { year: number; month: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    return { year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)) };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
function firstOfMonth(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
function lastOfMonth(y: number, m: number): string {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
function shift(y: number, m: number, delta: number): string {
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(y: number, m: number): string {
  return new Date(y, m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const params = await searchParams;
  const { year, month } = parseMonth(params.m);
  const from = firstOfMonth(year, month);
  const to = lastOfMonth(year, month);

  const sb = await getSupabaseServer();
  const [tasks, users] = await Promise.all([fetchTasksInRange(sb, from, to), fetchTeamRoster(sb)]);

  const prev = shift(year, month, -1);
  const next = shift(year, month, +1);
  const label = monthLabel(year, month);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
              <CalendarIcon className="h-3.5 w-3.5" /> Calendar
            </div>
            <h1 className="mt-1 text-h1">{label}</h1>
            <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} due this month. Click any chip to open the task.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/projects/calendar?m=${prev}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/projects/calendar"
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--color-surface-2)]"
            >
              Today
            </Link>
            <Link
              href={`/projects/calendar?m=${next}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CalendarGrid year={year} month={month} tasks={tasks} assignableUsers={users} />
    </main>
  );
}
