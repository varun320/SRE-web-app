import Link from 'next/link';
import { ArrowLeft, Columns } from 'lucide-react';
import { getSupabaseServer } from '@/shared/supabase/server';
import { EmptyState } from '@/shared/ui/empty-state';
import { fetchTeamRoster } from '@/features/projects/queries';
import type { TaskRow, TaskStatus } from '@/features/projects/types';
import { KanbanBoard, type BoardTask } from '@/features/projects/components/KanbanBoard';

export default async function BoardPage() {
  const sb = await getSupabaseServer();

  const [tasksRes, users] = await Promise.all([
    sb
      .from('tasks')
      .select('id, project_id, section_name, phase, title, assignee_id, due_date, priority, status, sort_order, projects!inner(project_number, name, template_id)')
      .order('sort_order'),
    fetchTeamRoster(sb),
  ]);
  type Row = TaskRow & { projects: { project_number: number; name: string; template_id: string | null } };
  const rows = ((tasksRes.data ?? []) as unknown as Row[]).filter((r) => r.projects.template_id != null);

  const tasks: BoardTask[] = rows.map((r) => ({
    ...r,
    project_number: r.projects.project_number,
    project_name: r.projects.name,
  }));

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-caption text-[var(--color-text-muted)]">
          <Columns className="h-3.5 w-3.5" /> Board
        </div>
        <h1 className="mt-1 text-h1">Kanban</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-muted)]">
          Drag cards between columns to change status. Click a card to open it.
        </p>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Columns}
          title="No tasks on the board"
          description="Create a job through Projects → New job to populate the board."
        />
      ) : (
        <KanbanBoard tasks={tasks} assignableUsers={users} />
      )}
    </main>
  );
}
