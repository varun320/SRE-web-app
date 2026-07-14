import { getSupabaseServer } from '@/lib/supabase/server';
import { Palmtree } from 'lucide-react';
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
    <main className="w-full px-3 md:px-4 py-6 md:py-10 space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-h1">Vacation</h1>
        <p className="mt-2 text-body-lg text-[var(--color-text-muted)]">
          Your annual entitlement is set by your position. To use vacation, log{' '}
          <strong className="text-[var(--color-text)]">Vacation Hours</strong> under the Admin category
          on a timesheet — the hours come out of this balance when the week is approved.
        </p>
      </header>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border-soft)]">
        <StatCell
          label={`Remaining${current ? ` · ${current.week_start}` : ''}`}
          value={`${balance.toFixed(2)} h`}
          muted={lowBalance}
        />
        <StatCell label="Opening (annual)" value={`${opening.toFixed(2)} h`} />
        <StatCell label="Used (lifetime)"  value={`${usedYtd.toFixed(2)} h`} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3">Weekly movements</h2>
          <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">Newest first.</p>
        </div>
        {(rows ?? []).length === 0 ? (
          <EmptyState
            icon={Palmtree}
            title="No vacation history yet"
            description="Once your first week is approved, a ledger row appears here — even if you didn't use vacation."
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th className="num">Opening</th>
                    <th className="num">− Used</th>
                    <th className="num">Closing</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r) => {
                    const used = Number(r.vacation_used);
                    return (
                      <tr key={r.week_start} className={r.stale ? 'opacity-50' : ''}>
                        <td className="font-mono text-xs">{r.week_start}</td>
                        <td className="num">{Number(r.opening_balance).toFixed(2)}</td>
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

function StatCell({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-1">
      <div className="text-caption text-[var(--color-text-muted)]">{label}</div>
      <div
        className="font-mono tabular text-[22px] font-medium leading-none"
        style={{ color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}
      >
        {value}
      </div>
    </div>
  );
}
