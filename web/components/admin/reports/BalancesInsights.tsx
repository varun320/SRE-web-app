'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Battery,
  Clock,
  Palmtree,
  UserX,
  Users,
} from 'lucide-react';
import type { BalanceRow } from '@/lib/admin/reports/balances';
import { StatusBadge } from '@/shared/ui/status-badge';

// Signal thresholds. These are heuristics — tune once we've seen real payroll
// cycles. Kept as constants so a future PR can promote them to org settings
// without touching the UI code.
const TIL_CAP_HOURS = 80;
const VACATION_LOW_HOURS = 8;
const STALE_WEEK_DAYS = 14;

interface Props {
  rows: BalanceRow[];
}

interface Insights {
  totalEmployees: number;
  totalTil: number;
  totalVacation: number;
  avgTil: number;
  avgVacation: number;
  lowVacation: BalanceRow[];
  highTil: BalanceRow[];
  staleWeeks: { row: BalanceRow; daysStale: number }[];
  negativeBalances: BalanceRow[];
  tilBuckets: { label: string; count: number }[];
  vacBuckets: { label: string; count: number }[];
  byDepartment: { department: string; count: number; til: number; vacation: number }[];
  byPosition: { position: string; count: number; til: number; vacation: number }[];
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

function bucket(rows: BalanceRow[], key: 'til' | 'vac'): { label: string; count: number }[] {
  const stops =
    key === 'til'
      ? [
          { label: '0–20h', max: 20 },
          { label: '20–50h', max: 50 },
          { label: '50–80h', max: 80 },
          { label: '80h+', max: Infinity },
        ]
      : [
          { label: '<20h', max: 20 },
          { label: '20–80h', max: 80 },
          { label: '80–160h', max: 160 },
          { label: '160h+', max: Infinity },
        ];
  const counts = stops.map((s) => ({ label: s.label, count: 0 }));
  for (const r of rows) {
    const v = key === 'til' ? r.til_closing : r.vacation_closing;
    for (let i = 0; i < stops.length; i++) {
      if (v < stops[i].max) {
        counts[i].count += 1;
        break;
      }
    }
  }
  return counts;
}

function computeInsights(rows: BalanceRow[]): Insights {
  const totalTil = rows.reduce((a, r) => a + r.til_closing, 0);
  const totalVacation = rows.reduce((a, r) => a + r.vacation_closing, 0);
  const totalEmployees = rows.length;

  const lowVacation = rows
    .filter((r) => r.vacation_closing < VACATION_LOW_HOURS)
    .sort((a, b) => a.vacation_closing - b.vacation_closing);

  const highTil = rows
    .filter((r) => r.til_closing >= TIL_CAP_HOURS)
    .sort((a, b) => b.til_closing - a.til_closing);

  const negativeBalances = rows.filter(
    (r) => r.til_closing < 0 || r.vacation_closing < 0,
  );

  const staleWeeks = rows
    .map((r) => {
      const latest = r.til_week && r.vacation_week
        ? r.til_week > r.vacation_week
          ? r.til_week
          : r.vacation_week
        : r.til_week ?? r.vacation_week;
      const d = daysAgo(latest);
      return d != null ? { row: r, daysStale: d } : null;
    })
    .filter((x): x is { row: BalanceRow; daysStale: number } => x !== null && x.daysStale > STALE_WEEK_DAYS)
    .sort((a, b) => b.daysStale - a.daysStale);

  // Group rollups — department, then position.
  const deptMap = new Map<string, { count: number; til: number; vacation: number }>();
  for (const r of rows) {
    const k = r.department ?? '—';
    const prev = deptMap.get(k) ?? { count: 0, til: 0, vacation: 0 };
    deptMap.set(k, {
      count: prev.count + 1,
      til: prev.til + r.til_closing,
      vacation: prev.vacation + r.vacation_closing,
    });
  }
  const byDepartment = Array.from(deptMap.entries())
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.til - a.til);

  const posMap = new Map<string, { count: number; til: number; vacation: number }>();
  for (const r of rows) {
    const k = r.position ?? '—';
    const prev = posMap.get(k) ?? { count: 0, til: 0, vacation: 0 };
    posMap.set(k, {
      count: prev.count + 1,
      til: prev.til + r.til_closing,
      vacation: prev.vacation + r.vacation_closing,
    });
  }
  const byPosition = Array.from(posMap.entries())
    .map(([position, v]) => ({ position, ...v }))
    .sort((a, b) => b.til - a.til);

  return {
    totalEmployees,
    totalTil,
    totalVacation,
    avgTil: totalEmployees ? totalTil / totalEmployees : 0,
    avgVacation: totalEmployees ? totalVacation / totalEmployees : 0,
    lowVacation,
    highTil,
    staleWeeks,
    negativeBalances,
    tilBuckets: bucket(rows, 'til'),
    vacBuckets: bucket(rows, 'vac'),
    byDepartment,
    byPosition,
  };
}

export function BalancesInsights({ rows }: Props) {
  const i = useMemo(() => computeInsights(rows), [rows]);
  if (rows.length === 0) return null;

  const alertCount =
    i.lowVacation.length +
    i.highTil.length +
    i.staleWeeks.length +
    i.negativeBalances.length;

  return (
    <section className="space-y-4">
      <KpiStrip
        employees={i.totalEmployees}
        totalTil={i.totalTil}
        avgTil={i.avgTil}
        totalVac={i.totalVacation}
        avgVac={i.avgVacation}
        alertCount={alertCount}
      />

      {alertCount > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AlertList
            icon={Palmtree}
            tone="danger"
            title="Low vacation"
            subtitle={`< ${VACATION_LOW_HOURS}h remaining`}
            people={i.lowVacation.map((r) => ({
              user_id: r.user_id,
              name: r.full_name,
              code: r.employee_code,
              value: `${r.vacation_closing.toFixed(1)}h`,
            }))}
          />
          <AlertList
            icon={Battery}
            tone="warning"
            title="TIL near/over cap"
            subtitle={`≥ ${TIL_CAP_HOURS}h banked`}
            people={i.highTil.map((r) => ({
              user_id: r.user_id,
              name: r.full_name,
              code: r.employee_code,
              value: `${r.til_closing.toFixed(1)}h`,
            }))}
          />
          <AlertList
            icon={UserX}
            tone="warning"
            title="Stale timesheets"
            subtitle={`No ledger update in > ${STALE_WEEK_DAYS}d`}
            people={i.staleWeeks.map(({ row, daysStale }) => ({
              user_id: row.user_id,
              name: row.full_name,
              code: row.employee_code,
              value: `${daysStale}d`,
            }))}
          />
          <AlertList
            icon={AlertTriangle}
            tone="danger"
            title="Negative balance"
            subtitle="TIL or vacation < 0"
            people={i.negativeBalances.map((r) => ({
              user_id: r.user_id,
              name: r.full_name,
              code: r.employee_code,
              value:
                r.til_closing < 0
                  ? `TIL ${r.til_closing.toFixed(1)}h`
                  : `Vac ${r.vacation_closing.toFixed(1)}h`,
            }))}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BucketCard
          icon={Clock}
          title="TIL distribution"
          buckets={i.tilBuckets}
          totalEmployees={i.totalEmployees}
        />
        <BucketCard
          icon={Palmtree}
          title="Vacation distribution"
          buckets={i.vacBuckets}
          totalEmployees={i.totalEmployees}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RollupTable
          title="By department"
          headerLabel="Department"
          rows={i.byDepartment.map((d) => ({
            label: d.department,
            count: d.count,
            til: d.til,
            vacation: d.vacation,
          }))}
        />
        <RollupTable
          title="By position"
          headerLabel="Position"
          rows={i.byPosition.map((d) => ({
            label: d.position,
            count: d.count,
            til: d.til,
            vacation: d.vacation,
          }))}
        />
      </div>
    </section>
  );
}

interface KpiStripProps {
  employees: number;
  totalTil: number;
  avgTil: number;
  totalVac: number;
  avgVac: number;
  alertCount: number;
}

function KpiStrip({
  employees,
  totalTil,
  avgTil,
  totalVac,
  avgVac,
  alertCount,
}: KpiStripProps) {
  const items = [
    {
      icon: Users,
      label: 'Active employees',
      value: employees.toString(),
      hint: undefined as string | undefined,
    },
    {
      icon: Clock,
      label: 'Org-wide TIL',
      value: `${totalTil.toFixed(1)}h`,
      hint: `avg ${avgTil.toFixed(1)}h / person`,
    },
    {
      icon: Palmtree,
      label: 'Org-wide vacation',
      value: `${totalVac.toFixed(1)}h`,
      hint: `avg ${avgVac.toFixed(1)}h / person`,
    },
    {
      icon: AlertTriangle,
      label: 'Needs attention',
      value: alertCount.toString(),
      hint:
        alertCount === 0
          ? 'all clear'
          : `${alertCount} employee${alertCount === 1 ? '' : 's'}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
              <Icon className="h-3 w-3" />
              {it.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-[var(--color-text)] tabular">
              {it.value}
            </div>
            {it.hint ? (
              <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                {it.hint}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface AlertListProps {
  icon: typeof AlertTriangle;
  tone: 'danger' | 'warning';
  title: string;
  subtitle: string;
  people: { user_id: string; name: string; code: string; value: string }[];
}

function AlertList({ icon: Icon, tone, title, subtitle, people }: AlertListProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border-soft)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon
            className={`h-4 w-4 ${
              tone === 'danger'
                ? 'text-[var(--color-status-declined-fg)]'
                : 'text-[var(--color-status-submitted-fg)]'
            }`}
          />
          <div>
            <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
            <div className="text-[11px] text-[var(--color-text-subtle)]">{subtitle}</div>
          </div>
        </div>
        <StatusBadge tone={people.length === 0 ? 'muted' : tone}>
          {people.length}
        </StatusBadge>
      </header>
      {people.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[var(--color-text-subtle)] italic">
          None — all clear.
        </div>
      ) : (
        <ul className="max-h-40 overflow-y-auto">
          {people.slice(0, 8).map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[var(--color-border-soft)] last:border-b-0 hover:bg-[var(--color-surface-2)]/40"
            >
              <Link
                href={`/admin/employees/${p.user_id}`}
                className="min-w-0 flex-1 truncate text-[var(--color-text)] hover:underline"
              >
                <span className="font-mono text-[10px] text-[var(--color-text-subtle)] mr-2">
                  {p.code}
                </span>
                {p.name}
              </Link>
              <span className="ml-2 shrink-0 font-mono tabular text-[var(--color-text-muted)]">
                {p.value}
              </span>
            </li>
          ))}
          {people.length > 8 ? (
            <li className="px-3 py-1.5 text-[11px] text-[var(--color-text-subtle)] italic">
              +{people.length - 8} more…
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

interface BucketCardProps {
  icon: typeof Clock;
  title: string;
  buckets: { label: string; count: number }[];
  totalEmployees: number;
}

function BucketCard({ icon: Icon, title, buckets, totalEmployees }: BucketCardProps) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] mb-2">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {buckets.map((b) => {
          const pct = totalEmployees ? (b.count / totalEmployees) * 100 : 0;
          return (
            <li key={b.label} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-[var(--color-text-muted)]">{b.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)]"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right shrink-0 font-mono tabular text-[var(--color-text)]">
                {b.count} <span className="text-[var(--color-text-subtle)]">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface RollupTableProps {
  title: string;
  headerLabel: string;
  rows: { label: string; count: number; til: number; vacation: number }[];
}

function RollupTable({ title, headerLabel, rows }: RollupTableProps) {
  if (rows.length <= 1 && rows[0]?.label === '—') return null;
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)] border-b border-[var(--color-border-soft)]">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-[var(--color-text-subtle)]">
          <tr>
            <th className="text-left px-3 py-1.5 font-medium">{headerLabel}</th>
            <th className="text-right px-3 py-1.5 font-medium">Count</th>
            <th className="text-right px-3 py-1.5 font-medium">TIL</th>
            <th className="text-right px-3 py-1.5 font-medium">Vac</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--color-border-soft)]">
              <td className="px-3 py-1.5 text-[var(--color-text)]">{r.label}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular text-[var(--color-text-muted)]">
                {r.count}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular text-[var(--color-text)]">
                {r.til.toFixed(1)}h
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular text-[var(--color-text)]">
                {r.vacation.toFixed(1)}h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
