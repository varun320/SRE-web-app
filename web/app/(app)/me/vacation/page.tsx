import { getSupabaseServer } from '@/lib/supabase/server';
import { Palmtree, TrendingDown, Calendar, Snowflake } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function VacationPage() {
  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('vacation_ledger')
    .select('week_start, opening_balance, vacation_used, closing_balance, frozen, stale')
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);

  const live = (rows ?? []).filter((r) => !r.stale);
  const current = live[0];
  const balance = Number(current?.closing_balance ?? 0);
  const usedYtd = live.reduce((sum, r) => sum + Number(r.vacation_used ?? 0), 0);
  const opening = Number(live[live.length - 1]?.opening_balance ?? 0);
  const lowBalance = balance < 8;

  return (
    <main className="mx-auto max-w-5xl px-4 md:px-6 py-6 space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-gradient-to-br from-[var(--color-status-approved-bg)] via-[var(--color-surface)] to-[var(--color-surface-2)] p-5 md:p-7 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
              <Palmtree className="h-3.5 w-3.5" />
              Vacation hours
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your time off this year</h1>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              Your annual entitlement is set by your position. To use vacation, log{' '}
              <strong>Vacation Hours</strong> under the Admin category on a timesheet — the hours come
              out of this balance when the week is approved.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Remaining</div>
            <div
              className={`font-mono tabular-nums text-4xl md:text-5xl font-semibold ${
                lowBalance
                  ? 'text-[var(--color-status-declined-fg)]'
                  : 'text-[var(--color-status-approved-fg)]'
              }`}
            >
              {balance.toFixed(2)}
              <span className="text-base font-normal text-[var(--color-text-muted)] ml-1">hrs</span>
            </div>
            {current ? (
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                as of week of {current.week_start}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={Calendar}     label="Opening (annual)" value={opening} tone="info" />
        <Stat icon={TrendingDown} label="Used (lifetime)"  value={usedYtd} tone="warning" />
        <Stat icon={Snowflake}    label="Closing balance"  value={balance} tone={lowBalance ? 'danger' : 'success'} />
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Weekly movements</h2>
          <span className="text-xs text-[var(--color-text-muted)]">Newest first.</span>
        </div>
        {(rows ?? []).length === 0 ? (
          <EmptyState
            icon={Palmtree}
            title="No vacation history yet"
            description="Once your first week is approved, a ledger row will appear here — even if you didn’t use vacation."
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/40">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-normal">Week of</th>
                    <th className="text-right px-4 py-2.5 font-normal">Opening</th>
                    <th className="text-right px-4 py-2.5 font-normal">− Used</th>
                    <th className="text-right px-4 py-2.5 font-normal">Closing</th>
                    <th className="text-left px-4 py-2.5 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {(rows ?? []).map((r) => {
                    const used = Number(r.vacation_used);
                    return (
                      <tr
                        key={r.week_start}
                        className={`border-t border-[var(--color-border-soft)] ${r.stale ? 'opacity-50' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-sans">{r.week_start}</td>
                        <td className="text-right px-4 py-2.5">{Number(r.opening_balance).toFixed(2)}</td>
                        <td className="text-right px-4 py-2.5">
                          {used > 0 ? (
                            <span className="text-amber-700 dark:text-amber-300">−{used.toFixed(2)}</span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">0.00</span>
                          )}
                        </td>
                        <td className="text-right px-4 py-2.5 font-medium">{Number(r.closing_balance).toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-sans">
                          {r.stale ? (
                            <StatusBadge tone="muted">Superseded</StatusBadge>
                          ) : r.frozen ? (
                            <StatusBadge tone="info">Frozen</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Live</StatusBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

const TONE = {
  success: { ring: 'ring-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-300' },
  warning: { ring: 'ring-amber-500/20',   icon: 'text-amber-600 dark:text-amber-300' },
  info:    { ring: 'ring-blue-500/20',    icon: 'text-blue-600 dark:text-blue-300' },
  danger:  { ring: 'ring-red-500/20',     icon: 'text-red-600 dark:text-red-300' },
} as const;

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE;
}) {
  const s = TONE[tone];
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 ring-1 ring-inset ${s.ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
        <Icon className={`h-4 w-4 ${s.icon}`} />
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
        {value.toFixed(2)}
        <span className="text-sm text-[var(--color-text-muted)] font-normal ml-1">hrs</span>
      </div>
    </div>
  );
}
