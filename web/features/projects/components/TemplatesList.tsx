'use client';

import { useState, useTransition } from 'react';
import { Plus, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { StatusBadge } from '@/shared/ui/status-badge';
import {
  createTemplate, deleteTemplate,
  createTemplateSection, deleteTemplateSection,
  createTemplateTask, deleteTemplateTask,
} from '@/features/projects/actions/templates';
import type { TemplateWithTasks } from '@/features/projects/queries';

const PHASE_LABEL = { pre: 'Pre-Job', during: 'During Job', post: 'Post-Job' } as const;

interface Props {
  templates: TemplateWithTasks[];
  isAdmin: boolean;
}

export function TemplatesList({ templates, isAdmin }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(templates.slice(0, 1).map((t) => t.id)));
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();

  return (
    <>
      {isAdmin ? (
        <div className="flex justify-end">
          {!creating ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New template
            </Button>
          ) : (
            <form
              action={(fd) => start(async () => {
                const res = await createTemplate(fd);
                if (res?.error) toast.error(res.error);
                else { toast.success('Template added'); setCreating(false); }
              })}
              className="flex items-center gap-2 rounded-md border border-[var(--color-accent)]/60 bg-[var(--color-surface-2)]/40 p-2"
            >
              <input name="name" placeholder="Template name" required className={inputCls + ' w-56'} />
              <input name="description" placeholder="Description (optional)" className={inputCls + ' w-72'} />
              <Button type="submit" size="xs">Create</Button>
              <Button type="button" variant="outline" size="xs" onClick={() => setCreating(false)}>Cancel</Button>
            </form>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            isAdmin={isAdmin}
            open={expanded.has(t.id)}
            onToggle={() => setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
              return next;
            })}
          />
        ))}
        {templates.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            No templates yet.
          </div>
        ) : null}
      </div>
    </>
  );
}

interface CardProps {
  template: TemplateWithTasks;
  isAdmin: boolean;
  open: boolean;
  onToggle: () => void;
}

function TemplateCard({ template, isAdmin, open, onToggle }: CardProps) {
  const [addingSection, setAddingSection] = useState(false);
  const [, start] = useTransition();

  const byPhase = { pre: [] as typeof template.sections, during: [] as typeof template.sections, post: [] as typeof template.sections };
  for (const s of template.sections) byPhase[s.phase].push(s);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-sm font-medium">{template.name}</h2>
            {template.description ? (
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">{template.description}</p>
            ) : null}
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge tone="muted">{template.task_count} tasks</StatusBadge>
          <StatusBadge tone={template.usage_count > 0 ? 'info' : 'muted'}>
            used by {template.usage_count}
          </StatusBadge>
          {isAdmin ? (
            <form action={(fd) => start(async () => {
              const res = await deleteTemplate(fd);
              if (res?.error) toast.error(res.error);
              else toast.success('Template deleted');
            })}>
              <input type="hidden" name="id" value={template.id} />
              <button
                type="submit"
                aria-label="Delete template"
                title={template.usage_count > 0 ? `Blocked — used by ${template.usage_count} project(s)` : 'Delete template'}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {open ? (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border-soft)] pt-3">
          {(['pre', 'during', 'post'] as const).map((phase) => (
            <div key={phase}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1.5">
                {PHASE_LABEL[phase]}
              </div>
              {byPhase[phase].length === 0 ? (
                <p className="text-[11px] text-[var(--color-text-muted)]">— no sections —</p>
              ) : (
                <div className="space-y-2">
                  {byPhase[phase].map((s) => (
                    <SectionBlock key={s.id} section={s} isAdmin={isAdmin} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAdmin ? (
            !addingSection ? (
              <Button variant="outline" size="xs" onClick={() => setAddingSection(true)}>
                <Plus className="h-3 w-3" /> Add section
              </Button>
            ) : (
              <form
                action={(fd) => start(async () => {
                  const res = await createTemplateSection(fd);
                  if (res?.error) toast.error(res.error);
                  else { toast.success('Section added'); setAddingSection(false); }
                })}
                className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-accent)]/60 bg-[var(--color-surface-2)]/40 p-2"
              >
                <input type="hidden" name="template_id" value={template.id} />
                <select name="phase" defaultValue="pre" className={inputCls + ' w-28'}>
                  <option value="pre">Pre</option>
                  <option value="during">During</option>
                  <option value="post">Post</option>
                </select>
                <input name="name" placeholder="Section name (e.g. Meetings)" required className={inputCls + ' flex-1 min-w-[200px]'} />
                <Button type="submit" size="xs">Add</Button>
                <Button type="button" variant="outline" size="xs" onClick={() => setAddingSection(false)}>Cancel</Button>
              </form>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface SectionBlockProps {
  section: TemplateWithTasks['sections'][number];
  isAdmin: boolean;
}

function SectionBlock({ section, isAdmin }: SectionBlockProps) {
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="rounded-md border border-[var(--color-border-soft)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">{section.name}</div>
        {isAdmin ? (
          <form action={(fd) => start(async () => {
            const res = await deleteTemplateSection(fd);
            if (res?.error) toast.error(res.error);
          })}>
            <input type="hidden" name="id" value={section.id} />
            <button
              type="submit"
              aria-label="Delete section"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </form>
        ) : null}
      </div>

      <ul className="mt-1.5 space-y-0.5">
        {section.tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-xs">
            <span className="flex-1 text-[var(--color-text)]">{t.title}</span>
            {t.default_priority !== 'med' ? (
              <span className="text-[10px] text-[var(--color-text-muted)]">{t.default_priority}</span>
            ) : null}
            {isAdmin ? (
              <form action={(fd) => start(async () => {
                const res = await deleteTemplateTask(fd);
                if (res?.error) toast.error(res.error);
              })}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  aria-label="Remove task"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {section.tasks.length === 0 ? (
          <li className="text-[10px] text-[var(--color-text-muted)] italic">no tasks</li>
        ) : null}
      </ul>

      {isAdmin ? (
        !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <Plus className="h-3 w-3" /> add task
          </button>
        ) : (
          <form
            action={(fd) => start(async () => {
              const res = await createTemplateTask(fd);
              if (res?.error) toast.error(res.error);
              else { toast.success('Task added'); setAdding(false); }
            })}
            className="mt-2 flex items-center gap-1.5"
          >
            <input type="hidden" name="section_id" value={section.id} />
            <input name="title" placeholder="Task title" required className={inputCls + ' flex-1'} />
            <select name="priority" defaultValue="med" className={inputCls + ' w-20'}>
              <option value="low">low</option>
              <option value="med">med</option>
              <option value="high">high</option>
            </select>
            <Button type="submit" size="xs">Add</Button>
            <Button type="button" variant="outline" size="xs" onClick={() => setAdding(false)}>×</Button>
          </form>
        )
      ) : null}
    </div>
  );
}

const inputCls =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs';
