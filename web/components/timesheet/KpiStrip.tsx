import type { TimesheetTotals } from '@/lib/totals';

interface Props {
  totals: TimesheetTotals;
  openingTil: number;
  openingVacation: number;
}

function Kpi({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <span className={`text-2xl ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</span>
    </div>
  );
}

export function KpiStrip({ totals, openingTil, openingVacation }: Props) {
  const tilRemaining = openingTil + totals.overtime_earned - totals.til_used;
  const vacRemaining = openingVacation - totals.vacation_used;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-6 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <Kpi label="Total Hours" value={totals.total_hrs.toFixed(2)} />
      <Kpi label="Overtime Earned" value={totals.overtime_earned.toFixed(2)} />
      <Kpi label="TIL Used" value={totals.til_used.toFixed(2)} />
      <Kpi label="TIL Remaining" value={tilRemaining.toFixed(2)} />
      <Kpi label="Vacation Used" value={totals.vacation_used.toFixed(2)} />
      <Kpi label="Vacation Remaining" value={vacRemaining.toFixed(2)} />
    </div>
  );
}
