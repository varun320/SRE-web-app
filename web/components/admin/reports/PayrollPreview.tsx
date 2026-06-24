import type { PayrollRow } from '@/lib/admin/reports/payroll';
import { EmptyState } from '@/components/ui/empty-state';
import { Wallet, Download, Clock4, Plane, Users, CalendarRange } from 'lucide-react';

interface Props {
  rows: PayrollRow[];
  downloadHref: string;
}

export function PayrollPreview({ rows, downloadHref }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No approved weeks in this range"
        description="Adjust the date range, or wait for more submissions to be approved."
      />
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      regular: acc.regular + r.regular_hrs,
      ot: acc.ot + r.overtime_hrs,
      payout: acc.payout + r.til_payout_hrs,
      vac: acc.vac + r.vacation_used_delta,
    }),
    { regular: 0, ot: 0, payout: 0, vac: 0 },
  );
  const uniqueEmployees = new Set(rows.map((r) => r.user_id)).size;
  const uniquePeriods = new Set(rows.map((r) => r.period_start)).size;

  // Group rows visually by employee — show name on first row only.
  let prevEmp = '';

  return (
    <section className="space-y-4">
      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={Users}        label="Employees"   value={uniqueEmployees} suffix=""    tone="blue" />
        <Metric icon={CalendarRange} label="Pay periods" value={uniquePeriods}   suffix=""    tone="violet" />
        <Metric icon={Clock4}       label="Regular hours" value={totals.regular} suffix="h"   tone="emerald" />
        <Metric icon={Plane}        label="Overtime hours" value={totals.ot}     suffix="h"   tone={totals.ot > 0 ? 'amber' : 'muted'} />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text)]">{rows.length}</span> row{rows.length === 1 ? '' : 's'} ·
          {' '}TIL payout <span className="font-mono">{totals.payout.toFixed(2)}h</span>
          {' '}· vacation taken <span className="font-mono">{totals.vac.toFixed(2)}h</span>
        </p>
        <a
          href={downloadHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
              <tr>
                <Th>Employee</Th>
                <Th>Pay period</Th>
                <Th align="right" hint="Hours worked at regular rate (total minus overtime minus TIL paid out as cash).">Regular</Th>
                <Th align="right" hint="Hours above 8 per day (TIL Payout rows excluded). Added to the employee's TIL bank on approval.">Overtime</Th>
                <Th align="right" hint="Banked TIL the employee converted to cash this period.">TIL payout</Th>
                <Th align="right" hint="Net TIL movement: overtime earned minus TIL used / paid out.">TIL Δ</Th>
                <Th align="right" hint="TIL bank balance at the end of the latest week in the period.">TIL closing</Th>
                <Th align="right" hint="Vacation hours used in this period.">Vac used</Th>
                <Th align="right" hint="Vacation bank balance at the end of the latest week in the period.">Vac closing</Th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {rows.map((r) => {
                const showEmp = r.employee_code !== prevEmp;
                prevEmp = r.employee_code;
                return (
                  <tr
                    key={`${r.user_id}|${r.period_start}`}
                    className={[
                      'border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40',
                      showEmp ? '' : 'border-t-transparent',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2.5 font-sans">
                      {showEmp ? (
                        <>
                          <div className="font-medium">{r.full_name}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{r.employee_code}</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-[var(--color-text-muted)] pl-3">↪</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-sans text-xs whitespace-nowrap">
                      {r.period_start} <span className="text-[var(--color-text-muted)]">→</span> {r.period_end}
                    </td>
                    <td className="text-right px-3 py-2.5">{r.regular_hrs.toFixed(2)}</td>
                    <td className="text-right px-3 py-2.5">
                      {r.overtime_hrs > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">{r.overtime_hrs.toFixed(2)}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0.00</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2.5">
                      {r.til_payout_hrs > 0 ? r.til_payout_hrs.toFixed(2) : <span className="text-[var(--color-text-muted)]">0.00</span>}
                    </td>
                    <td className="text-right px-3 py-2.5">
                      <Delta earned={r.til_earned_delta} used={r.til_used_delta} />
                    </td>
                    <td className="text-right px-3 py-2.5">{nullable(r.til_closing)}</td>
                    <td className="text-right px-3 py-2.5">
                      {r.vacation_used_delta > 0 ? r.vacation_used_delta.toFixed(2) : <span className="text-[var(--color-text-muted)]">0.00</span>}
                    </td>
                    <td className="text-right px-3 py-2.5">{nullable(r.vacation_closing)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children, align = 'left', hint }: { children: React.ReactNode; align?: 'left' | 'right'; hint?: string }) {
  return (
    <th className={`px-3 py-2.5 font-normal text-${align}`} title={hint}>
      <span className={hint ? 'border-b border-dotted border-[var(--color-border)] cursor-help' : undefined}>
        {children}
      </span>
    </th>
  );
}

const METRIC_TONES = {
  blue:    { ring: 'ring-blue-500/20',    icon: 'text-blue-600 dark:text-blue-300' },
  violet:  { ring: 'ring-violet-500/20',  icon: 'text-violet-600 dark:text-violet-300' },
  emerald: { ring: 'ring-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-300' },
  amber:   { ring: 'ring-amber-500/20',   icon: 'text-amber-600 dark:text-amber-300' },
  muted:   { ring: 'ring-[var(--color-border)]', icon: 'text-[var(--color-text-muted)]' },
} as const;

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  tone: keyof typeof METRIC_TONES;
}) {
  const t = METRIC_TONES[tone];
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 ring-1 ring-inset ${t.ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
        <Icon className={`h-4 w-4 ${t.icon}`} />
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' && suffix ? value.toFixed(2) : value}
        {suffix ? <span className="text-sm text-[var(--color-text-muted)] font-normal ml-0.5">{suffix}</span> : null}
      </div>
    </div>
  );
}

function Delta({ earned, used }: { earned: number; used: number }) {
  const net = earned - used;
  if (net === 0) return <span className="text-[var(--color-text-muted)]">0.00</span>;
  const sign = net > 0 ? '+' : '−';
  const tone = net > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';
  return <span className={tone}>{sign}{Math.abs(net).toFixed(2)}</span>;
}

function nullable(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}
