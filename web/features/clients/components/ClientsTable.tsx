'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteClient } from '@/features/clients/actions';
import { toast } from 'sonner';
import type { ClientRow } from '@/features/clients/types';

const INITIAL = 15;
const STEP = 20;

export function ClientsTable({ rows, canEdit = false }: { rows: ClientRow[]; canEdit?: boolean }) {
  const [pending, start] = useTransition();
  const [visible, setVisible] = useState(INITIAL);

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-sm text-[var(--color-text-muted)]">
        No clients yet. Add one above.
      </div>
    );
  }
  const shown = rows.slice(0, visible);
  const remaining = rows.length - visible;
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-4 py-3 font-normal">Name</th>
            <th className="text-left px-4 py-3 font-normal">Location</th>
            <th className="text-left px-4 py-3 font-normal">Coordinates</th>
            <th className="text-left px-4 py-3 font-normal">SharePoint</th>
            {canEdit && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
              <td className="px-4 py-3">
                <Link href={`/clients/${c.id}`} className="hover:underline font-medium">{c.name}</Link>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.location ?? '—'}</td>
              <td className="px-4 py-3 font-mono tabular-nums text-xs">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</td>
              <td className="px-4 py-3">
                {c.sharepointUrl
                  ? <a href={c.sharepointUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">Open</a>
                  : <span className="text-[var(--color-text-muted)]">—</span>}
              </td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <form action={(fd) => start(async () => {
                    const res = await deleteClient(fd);
                    if (res?.error) toast.error(res.error);
                    else toast.success('Deleted');
                  })}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="outline" size="sm" disabled={pending}>Delete</Button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 ? (
        <div className="border-t border-[var(--color-border-soft)] px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + STEP)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <ChevronDown className="h-3 w-3" />
            Show {Math.min(remaining, STEP)} more · {remaining} remaining
          </button>
        </div>
      ) : null}
    </div>
  );
}
