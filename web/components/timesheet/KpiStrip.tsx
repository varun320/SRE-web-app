'use client';
import type { TimesheetTotals } from '@/lib/totals';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { InfoHint } from '@/components/ui/info-hint';

interface Props {
  totals: TimesheetTotals;
  openingTil: number;
  openingVacation: number;
}

type Tone = 'neutral' | 'info' | 'success' | 'warning';

// Per DESIGN.md § 3.5:
//   Card treatment (border, no shadow).
//   Value: 28 px / 500 weight, tabular.
//   Label: body-sm muted above value.
//   Optional inline hint: caption muted below value.
// Tone is carried by the value colour, not by tinting the whole tile.
const VALUE_COLOR: Record<Tone, string> = {
  neutral: 'var(--color-text)',
  info:    'var(--color-status-submitted-fg)',
  success: 'var(--color-status-approved-fg)',
  warning: 'var(--color-status-declined-fg)',
};

interface TileProps {
  label: string;
  value: number;
  sub?: string;
  tone?: Tone;
  hint: ReactNode;
}

function Tile({ label, value, sub, tone = 'neutral', hint }: TileProps) {
  const [animKey, setAnimKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setAnimKey((k) => k + 1);
      prev.current = value;
    }
  }, [value]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-5 py-4 flex flex-col gap-1">
      <span className="text-[13px] font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
        {label}
        <InfoHint label={label}>{hint}</InfoHint>
      </span>
      <span
        key={animKey}
        className="kpi-value text-[28px] font-medium font-mono tabular-nums leading-none"
        style={{ color: VALUE_COLOR[tone] }}
      >
        {value.toFixed(2)}
      </span>
      {sub ? <span className="text-xs text-[var(--color-text-muted)]">{sub}</span> : null}
    </div>
  );
}

export function KpiStrip({ totals, openingTil, openingVacation }: Props) {
  const tilRemaining = openingTil + totals.overtime_earned - totals.til_used;
  const vacRemaining = openingVacation - totals.vacation_used;

  return (
    <div className="px-3 md:px-4 pb-4">
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
          tone={totals.overtime_earned > 0 ? 'info' : 'neutral'}
          hint="Overtime is anything above 40 base hours in the week (Mon–Sun combined). Time-off rows — TIL taken, TIL payout, vacation — do not count as base hours, so taking TIL doesn't inflate overtime. Overtime is banked as TIL automatically."
        />
        <Tile
          label="TIL remaining"
          value={tilRemaining}
          sub={`${openingTil.toFixed(0)}h opening`}
          tone="success"
          hint="Time-in-lieu balance you can spend later. Opening balance plus overtime earned, minus any TIL you've used this week."
        />
        <Tile
          label="Vacation remaining"
          value={vacRemaining}
          sub={`${openingVacation.toFixed(0)}h opening`}
          tone={vacRemaining < 0 ? 'warning' : 'success'}
          hint="Vacation hours left for the year. Logging Vacation Hours under Admin draws from this balance."
        />
      </div>
    </div>
  );
}
