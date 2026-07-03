import { getSupabaseServer } from '@/lib/supabase/server';
import { Palmtree } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { LedgerHero } from '@/components/ledger/LedgerHero';
import { format, parseISO } from 'date-fns';

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

  const last12 = live.slice(0, 12).reverse();
  const bars = last12.map((r) => Number(r.vacation_used ?? 0));
  const line = last12.map((r) => Number(r.closing_balance ?? 0));
  const labels = last12.map((r) => format(parseISO(r.week_start), 'MMM d'));
  const emphasize = last12.length ? last12.length - 1 : undefined;

  const monthUsed = last12.slice(-4).reduce((sum, r) => sum + Number(r.vacation_used ?? 0), 0);

  const eyebrow =
    current
      ? `LEDGER · VACATION · UPDATED ${format(parseISO(current.week_start), 'MMM d').toUpperCase()}`
      : 'LEDGER · VACATION';

  return (
    <main className="mx-auto max-w-5xl px-4 md:px-6 py-6 space-y-6">
      {live.length ? (
        <LedgerHero
          eyebrow={eyebrow}
          title={lowBalance ? 'Running low on vacation' : 'Vacation remaining'}
          balance={balance}
          unit="h"
          balanceLabel={
            current
              ? `Closing balance for the week of ${format(parseISO(current.week_start), 'MMM d, yyyy')}`
              : undefined
          }
          tone={lowBalance ? 'rose' : 'emerald'}
          bars={bars}
          line={line}
          labels={labels}
          emphasize={emphasize}
          delta={
            monthUsed > 0
              ? { value: -monthUsed, unit: 'h', label: 'used this month' }
              : { value: 0, unit: 'h', label: 'used this month' }
          }
          stats={[
            { label: 'Annual entitlement', value: opening, unit: 'h', decimals: 1, hint: 'from your position' },
            { label: 'Used lifetime', value: usedYtd, unit: 'h', decimals: 1 },
            { label: 'Remaining', value: balance, unit: 'h', decimals: 1 },
          ]}
          ribbon={
            lowBalance
              ? { tone: 'warn', text: `Under 8 hours left — plan your time off carefully.` }
              : { tone: 'info', text: 'Log “Vacation Hours” under Admin on a timesheet to book time off.' }
          }
        />
      ) : (
        <EmptyState
          icon={Palmtree}
          title="No vacation history yet"
          description="Once your first week is approved, your balance and trend will show up here — even if you didn’t use vacation."
        />
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Weekly movements</h2>
          <span className="text-xs text-[var(--color-text-muted)]">Newest first.</span>
        </div>
        {(rows ?? []).length === 0 ? null : (
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
