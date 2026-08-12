'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateTask } from '@/app/(app)/projects/actions';
import { friendlyError } from '@/lib/errors';
import type { TaskRow, TaskPriority, TaskStatus } from '@/lib/projects/types';
import { PHASE_LABEL } from '@/lib/projects/types';

export interface Assignable {
  id: string;
  full_name: string;
}

interface Props {
  task: TaskRow | null;                    // null → drawer closed
  assignableUsers: Assignable[];
  onClose: () => void;
}

// Right slide-over. Fields: assignee, due date, priority, status.
// ponytail: subitems/files/comments deferred — no schema yet.
export function TaskDrawer({ task, assignableUsers, onClose }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Local draft so edits don't flicker while server round-trips.
  const [draft, setDraft] = useState<TaskRow | null>(task);
  useEffect(() => setDraft(task), [task]);

  if (!task || !draft) return null;

  function patch<K extends keyof TaskRow>(field: K, value: TaskRow[K]) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
    start(async () => {
      const res = await updateTask({ id: task!.id, [field]: value } as Parameters<typeof updateTask>[0]);
      if (res?.error) {
        toast.error(friendlyError(res.error));
        setDraft(task);  // rollback
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={`Task: ${task.title}`}
        className="fixed top-0 right-0 z-50 h-screen w-[420px] max-w-full overflow-y-auto bg-[var(--color-surface)] border-l border-[var(--color-border-soft)] shadow-2xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-2 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {PHASE_LABEL[draft.phase]}{draft.section_name ? ` · ${draft.section_name}` : ''}
            </div>
            <h2 className="mt-0.5 text-sm font-medium leading-snug">{draft.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <Field label="Assignee">
            <select
              value={draft.assignee_id ?? ''}
              onChange={(e) => patch('assignee_id', e.target.value || null)}
              disabled={pending}
              className={inputCls}
            >
              <option value="">— unassigned —</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={draft.due_date ?? ''}
              onChange={(e) => patch('due_date', e.target.value || null)}
              disabled={pending}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                value={draft.priority}
                onChange={(e) => patch('priority', e.target.value as TaskPriority)}
                disabled={pending}
                className={inputCls}
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => patch('status', e.target.value as TaskStatus)}
                disabled={pending}
                className={inputCls}
              >
                <option value="todo">To do</option>
                <option value="doing">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field>
          </div>

          <p className="text-[11px] text-[var(--color-text-muted)]">
            Subitems, attachments, and comments coming soon.
          </p>
        </div>

        {pending ? (
          <div className="fixed bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-[11px] shadow-lg ring-1 ring-[var(--color-border-soft)]">
            <Loader2 className="h-3 w-3 animate-spin" /> saving…
          </div>
        ) : null}
      </aside>
    </>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm disabled:opacity-60';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
