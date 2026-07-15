import { getSupabaseServer } from '@/lib/supabase/server';
import { Clock4 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function TilPage() {
  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('til_ledger')
    .select('week_start, opening_balance, overtime_earned, til_used, closing_balance, frozen, stale')
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);

  const live = (rows ?? []).filter((r) => !r.stale);
  const current = live[0];
  const balance = Number(current?.closing_balance ?? 0);
  const earnedYtd = live.reduce((sum, r) => sum + Number(r.overtime_earned ?? 0), 0);
  const usedYtd = live.reduce((sum, r) => sum + Number(r.til_used ?? 0), 0);

  return (
    <main className="w-full px-3 md:px-4 py-6 md:py-10 space-y-8">
      <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, var(--color-accent-tint) 0%, transparent 70%)' }}
        />
        <header className="relative max-w-3xl">
          <h1 className="text-h1">TIL bank</h1>
          <p className="mt-2 text-body-lg text-[var(--color-text-muted)]">
            Every hour above 40 base hours in a week gets added here when the week is approved.
            Spend it later by logging <strong className="text-[var(--color-text)]">Overtime Taken</strong> or{' '}
            <strong className="text-[var(--color-text)]">TIL Payout</strong> under the Admin category.
          </p>
        </header>
      </section>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border-soft)]">
        <StatCell
          label={`Current balance${current ? ` · ${current.week_start}` : ''}`}
          value={`${balance.toFixed(2)} h`}
        />
        <StatCell label="OT earned (lifetime)" value={`${earnedYtd.toFixed(2)} h`} />
        <StatCell label="TIL used (lifetime)"  value={`${usedYtd.toFixed(2)} h`} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3">Weekly movements</h2>
          <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">
            Newest first. <em>Superseded</em> rows were replaced by a cascade recompute.
          </p>
        </div>
        {(rows ?? []).length === 0 ? (
          <EmptyState
            icon={Clock4}
            title="No TIL history yet"
            description="Once your first week is approved, a ledger row appears here."
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th className="num">Opening</th>
                    <th className="num">+ OT earned</th>
                    <th className="num">− TIL used</th>
                    <th className="num">Closing</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r) => {
                    const earned = Number(r.overtime_earned);
                    const used = Number(r.til_used);
                    return (
                      <tr key={r.week_start} className={r.stale ? 'opacity-50' : ''}>
                        <td className="font-mono text-xs">{r.week_start}</td>
                        <td className="num">{Number(r.opening_balance).toFixed(2)}</td>
                        <td className="num">
                          {earned > 0
                            ? <span className="text-[var(--color-status-approved-fg)]">+{earned.toFixed(2)}</span>
                            : <span className="col-muted">0.00</span>}
                        </td>
                        <td className="num">
                          {used > 0
                            ? <span className="text-[var(--color-status-declined-fg)]">−{used.toFixed(2)}</span>
                            : <span className="col-muted">0.00</span>}
                        </td>
                        <td className="num font-medium">{Number(r.closing_balance).toFixed(2)}</td>
                        <td>
                          {r.stale
                            ? <StatusBadge tone="muted">Superseded</StatusBadge>
                            : r.frozen
                              ? <StatusBadge tone="info">Frozen</StatusBadge>
                              : <StatusBadge tone="neutral">Live</StatusBadge>}
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

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-1">
      <div className="text-caption text-[var(--color-text-muted)]">{label}</div>
      <div className="font-mono tabular text-[22px] font-medium leading-none text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}
