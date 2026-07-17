'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';

interface Preset {
  label: string;
  compute: (today: Date) => { from: string; to: string };
}

function mondayOnOrBefore(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  x.setUTCDate(x.getUTCDate() - back);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESETS: Preset[] = [
  {
    label: 'This pay period',
    compute: (today) => {
      const monday = mondayOnOrBefore(today);
      // Bi-weekly bucket anchored at the same epoch the aggregator uses.
      const epoch = new Date('2026-01-05T00:00:00Z');
      const diffDays = Math.floor((monday.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = Math.floor(diffDays / 14);
      const start = addDays(epoch, bucket * 14);
      return { from: iso(start), to: iso(addDays(start, 13)) };
    },
  },
  {
    label: 'Last pay period',
    compute: (today) => {
      const this_ = PRESETS[0].compute(today);
      const start = addDays(new Date(`${this_.from}T00:00:00Z`), -14);
      return { from: iso(start), to: iso(addDays(start, 13)) };
    },
  },
  {
    label: 'Last 4 weeks',
    compute: (today) => {
      const monday = mondayOnOrBefore(today);
      const start = addDays(monday, -28);
      return { from: iso(start), to: iso(addDays(monday, 6)) };
    },
  },
  {
    label: 'Month to date',
    compute: (today) => {
      const start = mondayOnOrBefore(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      );
      const monday = mondayOnOrBefore(today);
      return { from: iso(start), to: iso(addDays(monday, 6)) };
    },
  },
];

interface Props {
  /** Default values when nothing is in the URL. */
  defaultFrom?: string;
  defaultTo?: string;
}

export function DateRangePicker({ defaultFrom, defaultTo }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const from = sp.get('from') ?? defaultFrom ?? '';
  const to = sp.get('to') ?? defaultTo ?? '';

  const apply = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set('from', nextFrom);
    params.set('to', nextTo);
    start(() => router.push(`?${params.toString()}`));
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="rp-from" className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">From</label>
          <DatePicker value={from} onChange={(v) => apply(v, to)} ariaLabel="Range from" className="min-w-[140px]" />
        </div>
        <div className="space-y-1">
          <label htmlFor="rp-to" className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">To</label>
          <DatePicker value={to} onChange={(v) => apply(from, v)} ariaLabel="Range to" className="min-w-[140px]" />
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                const { from: f, to: t } = p.compute(new Date());
                apply(f, t);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      {pending ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : null}
    </div>
  );
}
