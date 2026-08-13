'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Plus, Paperclip, MessageSquare, CheckSquare, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateTask } from '@/features/projects/actions/tasks';
import {
  createSubitem, toggleSubitem, deleteSubitem,
  createComment, deleteComment,
  registerAttachment, deleteAttachment, getAttachmentUrl,
  fetchTaskDetails,
  type TaskDetails,
} from '@/features/projects/actions/task-details';
import { getSupabaseBrowser } from '@/shared/supabase/client';
import { friendlyError } from '@/shared/lib/errors';
import type { TaskRow, TaskPriority, TaskStatus } from '@/features/projects/types';
import { PHASE_LABEL } from '@/features/projects/types';

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

  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [newSubitem, setNewSubitem] = useState('');
  const [newComment, setNewComment] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshDetails() {
    if (!task) return;
    const d = await fetchTaskDetails(task.id);
    setDetails(d);
  }

  useEffect(() => {
    if (!task) { setDetails(null); return; }
    setDetailsLoading(true);
    fetchTaskDetails(task.id)
      .then((d) => setDetails(d))
      .catch((e) => toast.error(friendlyError(e)))
      .finally(() => setDetailsLoading(false));
  }, [task]);

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

          <SectionDivider label="Checklist" icon={<CheckSquare className="h-3 w-3" />} count={details ? `${details.subitems.filter((s) => s.done).length}/${details.subitems.length}` : null} />
          <ul className="space-y-1.5">
            {(details?.subitems ?? []).map((s) => (
              <li key={s.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(e) => {
                    const nextDone = e.target.checked;
                    setDetails((d) => d ? { ...d, subitems: d.subitems.map((x) => x.id === s.id ? { ...x, done: nextDone } : x) } : d);
                    start(async () => {
                      const res = await toggleSubitem({ id: s.id, done: nextDone });
                      if (res?.error) { toast.error(res.error); refreshDetails(); }
                    });
                  }}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span className={`flex-1 text-sm ${s.done ? 'line-through text-[var(--color-text-muted)]' : ''}`}>{s.title}</span>
                <button
                  type="button"
                  aria-label="Remove"
                  className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-status-declined-fg)]"
                  onClick={() => start(async () => {
                    const res = await deleteSubitem({ id: s.id });
                    if (res?.error) toast.error(res.error);
                    else refreshDetails();
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const title = newSubitem.trim();
              if (!title) return;
              setNewSubitem('');
              start(async () => {
                const res = await createSubitem({ task_id: task.id, title });
                if (res?.error) toast.error(res.error);
                else refreshDetails();
              });
            }}
          >
            <Plus className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <input
              value={newSubitem}
              onChange={(e) => setNewSubitem(e.target.value)}
              placeholder="Add checklist item"
              className={`${inputCls} text-sm`}
            />
          </form>

          <SectionDivider label="Attachments" icon={<Paperclip className="h-3 w-3" />} count={details ? String(details.attachments.length) : null} />
          <ul className="space-y-1.5">
            {(details?.attachments ?? []).map((a) => (
              <li key={a.id} className="group flex items-center gap-2 rounded-md border border-[var(--color-border-soft)] p-2">
                <Paperclip className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.filename}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)} KB` : ''}
                    {a.mime_type ? ` · ${a.mime_type}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Open"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                  onClick={() => start(async () => {
                    const res = await getAttachmentUrl(a.storage_path);
                    if ('error' in res) toast.error(res.error);
                    else window.open(res.url, '_blank', 'noopener,noreferrer');
                  })}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-status-declined-fg)]"
                  onClick={() => start(async () => {
                    const res = await deleteAttachment({ id: a.id });
                    if (res?.error) toast.error(res.error);
                    else refreshDetails();
                  })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              const ext = file.name.split('.').pop() ?? 'bin';
              const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
              const path = `${task.id}/${yyyymmdd}-${crypto.randomUUID()}.${ext}`;
              const sb = getSupabaseBrowser();
              const { error: upErr } = await sb.storage.from('task-attachments').upload(path, file, { upsert: false });
              if (upErr) { toast.error(friendlyError(upErr)); return; }
              start(async () => {
                const res = await registerAttachment({
                  task_id: task.id,
                  storage_path: path,
                  filename: file.name,
                  mime_type: file.type || undefined,
                  size_bytes: file.size,
                });
                if (res?.error) toast.error(res.error);
                else refreshDetails();
              });
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <Plus className="h-3 w-3" /> Upload file
          </button>

          <SectionDivider label="Comments" icon={<MessageSquare className="h-3 w-3" />} count={details ? String(details.comments.length) : null} />
          <ul className="space-y-2">
            {(details?.comments ?? []).map((c) => (
              <li key={c.id} className="rounded-md border border-[var(--color-border-soft)] p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium">{c.author_name ?? 'Someone'}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{c.body}</div>
              </li>
            ))}
          </ul>
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const body = newComment.trim();
              if (!body) return;
              setNewComment('');
              start(async () => {
                const res = await createComment({ task_id: task.id, body });
                if (res?.error) toast.error(res.error);
                else refreshDetails();
              });
            }}
          >
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className={`${inputCls} text-sm resize-y`}
            />
            <div className="flex justify-end">
              <button type="submit" disabled={pending || !newComment.trim()} className="inline-flex items-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] px-3 py-1 text-xs disabled:opacity-40">Send</button>
            </div>
          </form>

          {detailsLoading && !details ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <Loader2 className="h-3 w-3 animate-spin" /> loading details…
            </div>
          ) : null}
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

function SectionDivider({ label, icon, count }: { label: string; icon: React.ReactNode; count: string | null }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border-soft)]">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {icon} {label}
      </span>
      {count ? <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{count}</span> : null}
    </div>
  );
}

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
