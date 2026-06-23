import { getSupabaseServer } from '@/lib/supabase/server';

export default async function VacationPage() {
  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('vacation_ledger')
    .select('week_start, opening_balance, vacation_used, closing_balance, frozen, stale')
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);
  const current = (rows ?? []).find((r) => !r.stale);
  return (
    <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
      <header className="flex items-end justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Vacation bank</h1>
        <div className="font-mono tabular-nums text-3xl">{Number(current?.closing_balance ?? 0).toFixed(2)} hrs</div>
      </header>
      <table className="w-full text-sm">
        <thead className="text-[var(--color-text-muted)]"><tr>
          <th className="text-left p-2">Week</th>
          <th className="text-right p-2">Opening</th>
          <th className="text-right p-2">Used</th>
          <th className="text-right p-2">Closing</th>
          <th className="p-2"></th>
        </tr></thead>
        <tbody className="font-mono tabular-nums">
          {(rows ?? []).map((r) => (
            <tr key={r.week_start} className={`border-t border-[var(--color-border)] ${r.stale ? 'opacity-40 line-through' : ''}`}>
              <td className="p-2 font-sans">{r.week_start}</td>
              <td className="text-right p-2">{Number(r.opening_balance).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.vacation_used).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.closing_balance).toFixed(2)}</td>
              <td className="p-2 text-xs text-[var(--color-text-muted)]">{r.stale ? 'superseded' : r.frozen ? 'frozen' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
