'use client';

import { useState } from 'react';
import { ExternalLink, MessageSquare, ClipboardList, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { StatusBadge } from '@/shared/ui/status-badge';
import { OPPORTUNITY_STAGES, daysInStage } from '@/features/sales/types';
import type { OpportunityDetail, OpportunityStage } from '@/features/sales/types';

interface Props {
  opportunity: OpportunityDetail | null;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStageChange: (id: string, stage: OpportunityStage) => void;
  onAddNote: (id: string, body: string) => void;
  pending: boolean;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtCurrency(n?: number): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function OpportunityDrawer({
  opportunity,
  canEdit,
  open,
  onOpenChange,
  onStageChange,
  onAddNote,
  pending,
}: Props) {
  const [note, setNote] = useState('');

  if (!opportunity) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" />
      </Dialog>
    );
  }

  const o = opportunity;
  const days = daysInStage(o.stageEnteredAt);
  const cf = o.customFields ?? {};
  const notes = o.notes.slice(0, 5);

  const submit = () => {
    const body = note.trim();
    if (!body) return;
    onAddNote(o.id, body);
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>{o.name}</DialogTitle>
              <DialogDescription>
                {cf.sre_proposal_number ?? '—'}
                <span className="mx-2 text-[var(--color-text-subtle)]">·</span>
                {cf.sre_customer_country ?? '—'}
                <span className="mx-2 text-[var(--color-text-subtle)]">·</span>
                {cf.sre_scope_type ?? '—'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetaCell label="Value" value={fmtCurrency(o.monetaryValue)} />
          <MetaCell label="Status" value={o.status} />
          <MetaCell label="Engineer" value={cf.sre_assigned_engineer ?? '—'} />
          <MetaCell
            label="Days in stage"
            value={
              <span className="inline-flex items-center gap-2">
                {days}d
                {days >= 30 ? <StatusBadge tone="danger">aging</StatusBadge> : null}
              </span>
            }
          />
          <MetaCell label="Created" value={fmtDate(o.createdAt)} />
          <MetaCell label="Updated" value={fmtDate(o.updatedAt)} />
        </div>

        {cf.sre_next_action ? (
          <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 px-3 py-2 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
              Next action
            </div>
            <div className="mt-0.5 text-[var(--color-text)]">{cf.sre_next_action}</div>
          </div>
        ) : null}

        {cf.sre_proposal_sharepoint_url ? (
          <a
            href={cf.sre_proposal_sharepoint_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open SharePoint proposal
          </a>
        ) : null}

        {!canEdit ? (
          <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Read-only — this opportunity is assigned to {o.customFields?.sre_assigned_engineer ?? 'another engineer'}. Only the assigned engineer or an admin can change the stage or add notes.
          </div>
        ) : null}

        <div>
          <label className="block text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] mb-1">
            Stage
          </label>
          <select
            value={o.stage}
            onChange={(e) => onStageChange(o.id, e.target.value as OpportunityStage)}
            disabled={pending || !canEdit}
            className="w-full rounded-md border border-[var(--color-border-soft)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
          >
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <section>
          <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] mb-1.5">
            <MessageSquare className="h-3 w-3" /> Notes ({o.notes.length})
          </h4>
          {notes.length === 0 ? (
            <div className="text-xs text-[var(--color-text-subtle)] italic">No notes yet.</div>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-md border border-[var(--color-border-soft)] px-3 py-2 text-sm"
                >
                  <div className="text-[11px] text-[var(--color-text-subtle)] mb-0.5">
                    {n.author} · {fmtDate(n.createdAt)}
                  </div>
                  <div className="text-[var(--color-text)] whitespace-pre-wrap">{n.body}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={canEdit ? 'Add a note…' : 'Read-only'}
              rows={2}
              disabled={!canEdit}
              className="flex-1 rounded-md border border-[var(--color-border-soft)] bg-transparent px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50"
            />
            <Button
              onClick={submit}
              disabled={pending || !canEdit || note.trim().length === 0}
              size="sm"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </div>
        </section>

        {o.tasks.length > 0 ? (
          <section>
            <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] mb-1.5">
              <ClipboardList className="h-3 w-3" /> Tasks
            </h4>
            <ul className="space-y-1">
              {o.tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border-soft)] px-3 py-1.5 text-sm"
                >
                  <span className={t.done ? 'line-through text-[var(--color-text-muted)]' : ''}>
                    {t.title}
                  </span>
                  {t.dueAt ? (
                    <span className="text-[11px] font-mono tabular text-[var(--color-text-subtle)]">
                      {fmtDate(t.dueAt)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="mt-0.5 text-[var(--color-text)]">{value}</div>
    </div>
  );
}
