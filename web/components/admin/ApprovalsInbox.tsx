'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox, X, Check, ArrowLeftCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { approveTimesheet, declineTimesheet } from '@/lib/admin/mutations';
import type { QueueRow } from '@/lib/admin/queries';
import type { MainCategory } from '@/lib/types';

// The right-pane payload the server pre-fetches when a row is picked (?panel=<id>).
export interface PanelPayload {
  timesheet_id: string;
  user_id: string;
  full_name: string;
  employee_code: string;
  week_start: string;
  submitted_at: string | null;
  decline_reason: string | null;
  total_hrs: number;
  overtime_earned: number;
  til_used: number;
  vacation_used: number;
  lines: PanelLine[];
}

export interface PanelLine {
  main_category: MainCategory;
  sub_category: string;
  project_number: number | null;
  description: string | null;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  row_total: number;
}

interface Props {
  queue: QueueRow[];
  panel: PanelPayload | null;
}

const DAYS: Array<{ key: keyof PanelLine; label: string }> = [
  { key: 'mon_hrs', label: 'Mon' },
  { key: 'tue_hrs', label: 'Tue' },
  { key: 'wed_hrs', label: 'Wed' },
  { key: 'thu_hrs', label: 'Thu' },
  { key: 'fri_hrs', label: 'Fri' },
  { key: 'sat_hrs', label: 'Sat' },
  { key: 'sun_hrs', label: 'Sun' },
];

export function ApprovalsInbox({ queue, panel }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkSendBackOpen, setBulkSendBackOpen] = useState(false);

  const selectedId = panel?.timesheet_id ?? null;

  const setPanel = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set('panel', id);
    else next.delete('panel');
    startTransition(() => router.push(`?${next.toString()}`, { scroll: false }));
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkApprove = () => {
    if (checked.size === 0) return;
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const ids = Array.from(checked);
      const results = await Promise.allSettled(ids.map((id) => approveTimesheet(sb, id, null)));
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      if (okCount > 0) toast.success(`Approved ${okCount} timesheet${okCount === 1 ? '' : 's'}.`);
      if (failCount > 0) toast.error(`${failCount} failed to approve.`);
      setChecked(new Set());
      if (selectedId && ids.includes(selectedId)) setPanel(null);
      router.refresh();
    });
  };

  const bulkSendBack = (reason: string) => {
    if (checked.size === 0 || reason.trim().length === 0) return;
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      const ids = Array.from(checked);
      const results = await Promise.allSettled(ids.map((id) => declineTimesheet(sb, id, reason.trim())));
      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      if (okCount > 0) toast.success(`Sent ${okCount} timesheet${okCount === 1 ? '' : 's'} back.`);
      if (failCount > 0) toast.error(`${failCount} failed.`);
      setBulkSendBackOpen(false);
      setChecked(new Set());
      if (selectedId && ids.includes(selectedId)) setPanel(null);
      router.refresh();
    });
  };

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox zero"
        description="No timesheets waiting for approval. New submissions land here oldest-first."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
      {/* LEFT — inbox list */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
        <ul>
          {queue.map((r) => {
            const active = r.timesheet_id === selectedId;
            const isChecked = checked.has(r.timesheet_id);
            return (
              <li key={r.timesheet_id}>
                <div
                  className={[
                    'group w-full px-4 py-3 border-b border-[var(--color-border-soft)] flex items-center gap-3 transition-colors',
                    active
                      ? 'bg-[var(--color-accent-tint)] border-l-2 border-l-[var(--color-accent)] pl-[calc(1rem-2px)]'
                      : 'hover:bg-[var(--color-surface-2)]/40',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(r.timesheet_id)}
                    aria-label={`Select ${r.full_name}'s week of ${r.week_start}`}
                    className="h-4 w-4 shrink-0 rounded accent-[var(--color-accent)] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setPanel(active ? null : r.timesheet_id)}
                    aria-current={active ? 'true' : undefined}
                    className="flex-1 min-w-0 text-left flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[14px]">{r.full_name}</div>
                      <div className="text-[12px] col-muted font-mono">{r.employee_code} · {r.week_start}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular tabular-nums text-[13px]">{r.total_hrs.toFixed(2)} h</div>
                      <div className="text-[10px] col-muted">
                        {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* RIGHT — side panel */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] min-h-[400px] flex flex-col overflow-hidden">
        {!panel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
            <ArrowLeftCircle className="h-6 w-6 text-[var(--color-text-subtle)]" aria-hidden />
            <p className="text-h3 font-medium">Pick a week to review</p>
            <p className="text-body-sm col-muted max-w-sm">
              Click any row on the left. The full timesheet loads here and you can approve or send it back.
            </p>
          </div>
        ) : (
          <>
            {/* Panel header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-soft)]">
              <div className="min-w-0">
                <div className="text-h3 font-semibold">{panel.full_name}</div>
                <div className="mt-0.5 text-body-sm col-muted">
                  Week of <span className="font-mono">{panel.week_start}</span>
                  {panel.submitted_at ? (
                    <> · submitted {formatDistanceToNow(new Date(panel.submitted_at), { addSuffix: true })}</>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close panel"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Totals strip */}
            <div className="grid grid-cols-4 gap-0 border-b border-[var(--color-border-soft)]">
              <TotalCell label="Hours" value={panel.total_hrs.toFixed(2)} />
              <TotalCell label="Overtime" value={panel.overtime_earned.toFixed(2)} tone={panel.overtime_earned > 0 ? 'info' : 'neutral'} />
              <TotalCell label="TIL used" value={panel.til_used.toFixed(2)} />
              <TotalCell label="Vacation used" value={panel.vacation_used.toFixed(2)} />
            </div>

            {/* Line items */}
            <div className="flex-1 overflow-auto">
              {panel.lines.length === 0 ? (
                <div className="p-8 text-center text-body-sm col-muted">No entries logged.</div>
              ) : (
                <table className="data-table dense">
                  <thead>
                    <tr>
                      <th>Category / project</th>
                      <th>Description</th>
                      {DAYS.map((d) => (
                        <th key={d.label} className="num">{d.label}</th>
                      ))}
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.lines.map((l, i) => (
                      <tr key={i} className="align-top">
                        <td>
                          <div className="text-[11px] col-muted">{l.main_category}</div>
                          <div>{l.sub_category}</div>
                          {l.project_number != null ? (
                            <div className="text-[11px] col-muted font-mono">#{l.project_number}</div>
                          ) : null}
                        </td>
                        <td className="max-w-[280px]">
                          <div className="whitespace-pre-wrap break-words text-[13px]">
                            {l.description?.trim() ? l.description : (
                              <span className="col-muted italic">no description</span>
                            )}
                          </div>
                        </td>
                        {DAYS.map((d) => {
                          const v = Number(l[d.key] ?? 0);
                          return (
                            <td key={d.label} className="num">
                              {v > 0 ? v.toFixed(2) : <span className="col-muted">—</span>}
                            </td>
                          );
                        })}
                        <td className="num font-semibold">{Number(l.row_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Panel actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30">
              <Button
                variant="outline"
                size="md"
                disabled={pending}
                onClick={() => setSendBackOpen(true)}
              >
                Send back
              </Button>
              <Button
                variant="default"
                size="md"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await approveTimesheet(getSupabaseBrowser(), panel.timesheet_id, null);
                      toast.success(`Approved ${panel.full_name}'s week of ${panel.week_start}.`);
                      setPanel(null);
                      router.refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Approval failed');
                    }
                  });
                }}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </div>
          </>
        )}
      </div>

      {panel && sendBackOpen ? (
        <SendBackModal
          fullName={panel.full_name}
          onClose={() => setSendBackOpen(false)}
          onConfirm={(reason) => {
            startTransition(async () => {
              try {
                await declineTimesheet(getSupabaseBrowser(), panel.timesheet_id, reason);
                toast.success(`Sent back to ${panel.full_name}.`);
                setSendBackOpen(false);
                setPanel(null);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Send back failed');
              }
            });
          }}
          pending={pending}
        />
      ) : null}

      {/* Bulk-select toolbar — sticky at the bottom whenever any row is checked. */}
      {checked.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur shadow-[var(--shadow-elevation)]">
          <div className="w-full max-w-full px-3 md:px-4 h-14 flex items-center justify-between gap-3">
            <span className="text-body-strong">
              <span className="font-mono tabular">{checked.size}</span> selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setChecked(new Set())} disabled={pending}>
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkSendBackOpen(true)} disabled={pending}>
                Send back…
              </Button>
              <Button variant="default" size="sm" onClick={bulkApprove} disabled={pending}>
                <Check className="h-4 w-4" />
                Approve {checked.size}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkSendBackOpen ? (
        <SendBackModal
          fullName={`${checked.size} timesheets`}
          onClose={() => setBulkSendBackOpen(false)}
          onConfirm={(reason) => bulkSendBack(reason)}
          pending={pending}
        />
      ) : null}
    </div>
  );
}

function TotalCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'info';
}) {
  return (
    <div className="px-4 py-3 border-r border-[var(--color-border-soft)] last:border-r-0">
      <div className="text-[11px] col-muted uppercase tracking-wider">{label}</div>
      <div
        className="mt-0.5 font-mono tabular text-[20px] leading-none"
        style={{
          color: tone === 'info' ? 'var(--color-status-submitted-fg)' : 'var(--color-text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SendBackModal({
  fullName,
  onClose,
  onConfirm,
  pending,
}: {
  fullName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-elevation)] p-5 space-y-4">
        <header>
          <h2 className="text-h3 font-semibold">Send this back to {fullName}?</h2>
          <p className="mt-1 text-body-sm col-muted">
            They&apos;ll see the reason when they open the week. Be specific about what to fix.
          </p>
        </header>
        <div className="space-y-1.5">
          <label htmlFor="send-back-reason" className="block text-caption">Reason</label>
          <textarea
            id="send-back-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Project code on row 3 doesn't match the PO — swap it for PRJ-104."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Keep reviewing</Button>
          <Button
            onClick={() => onConfirm(reason.trim())}
            disabled={pending || reason.trim().length === 0}
          >
            {pending ? 'Sending back…' : 'Send back'}
          </Button>
        </div>
      </div>
    </div>
  );
}
