'use client';
import type { TimesheetTotals } from '@/lib/totals';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { InfoHint } from '@/components/ui/info-hint';

interface Props {
  totals: TimesheetTotals;
  openingTil: number;
  openingVacation: number;
}

const TILE_TONES: Record<string, { bg: string; fg: string }> = {
  neutral:   { bg: 'var(--color-surface-2)',           fg: 'var(--color-text)' },
  blue:      { bg: 'var(--color-status-submitted-bg)', fg: 'var(--color-status-submitted-fg)' },
  green:     { bg: 'var(--color-status-approved-bg)',  fg: 'var(--color-status-approved-fg)' },
  amber:     { bg: 'var(--color-status-declined-bg)',  fg: 'var(--color-status-declined-fg)' },
};

interface TileProps {
  label: string;
  value: number;
  sub?: string;
  tone?: keyof typeof TILE_TONES;
  hint: ReactNode;
}

function Tile({ label, value, sub, tone = 'neutral', hint }: TileProps) {
  const { bg, fg } = TILE_TONES[tone];
  const [animKey, setAnimKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setAnimKey((k) => k + 1);
      prev.current = value;
    }
  }, [value]);

  return (
    <div
      className="rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-1"
      style={{ background: bg, color: fg }}
    >
      <span className="text-[11px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">
        {label}
        <InfoHint label={label}>{hint}</InfoHint>
      </span>
      <span key={animKey} className="kpi-value text-3xl font-mono tabular-nums leading-none">{value.toFixed(2)}</span>
      {sub ? <span className="text-xs opacity-70">{sub}</span> : null}
    </div>
  );
}

export function KpiStrip({ totals, openingTil, openingVacation }: Props) {
  const tilRemaining = openingTil + totals.overtime_earned - totals.til_used;
  const vacRemaining = openingVacation - totals.vacation_used;

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          label="Hours this week"
          value={totals.total_hrs}
          sub="across all activities"
          tone="neutral"
          hint="Total hours you've logged across every row, Monday through Sunday."
        />
        <Tile
          label="Overtime earned"
          value={totals.overtime_earned}
          sub="added to TIL bank"
          tone="blue"
          hint="Any hours above 8 in a single day are overtime. They get added to your TIL (time-in-lieu) bank automatically."
        />
        <Tile
          label="TIL remaining"
          value={tilRemaining}
          sub={`${openingTil.toFixed(0)}h opening`}
          tone="green"
          hint="Time-in-lieu balance you can spend later. Opening balance plus overtime earned, minus any TIL you've used this week."
        />
        <Tile
          label="Vacation remaining"
          value={vacRemaining}
          sub={`${openingVacation.toFixed(0)}h opening`}
          tone={vacRemaining < 0 ? 'amber' : 'green'}
          hint="Vacation hours left for the year. Logging Vacation Hours under Admin draws from this balance."
        />
      </div>
    </div>
  );
}
