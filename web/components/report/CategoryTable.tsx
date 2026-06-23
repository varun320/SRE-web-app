import type { MainCategory } from '@/lib/types';

interface Row { main_category: MainCategory; row_total: number; }

export function CategoryTable({ rows }: { rows: Row[] }) {
  const byCat = new Map<MainCategory, number>();
  for (const r of rows) byCat.set(r.main_category, (byCat.get(r.main_category) ?? 0) + Number(r.row_total));
  const grand = [...byCat.values()].reduce((a, b) => a + b, 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Main Category</th><th className="text-right p-2">Hours</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...byCat.entries()].map(([cat, hrs]) => (
          <tr key={cat} className="border-t border-[var(--color-border)]">
            <td className="p-2 font-sans">{cat}</td>
            <td className="text-right p-2">{hrs.toFixed(2)}</td>
          </tr>
        ))}
        <tr className="border-t border-[var(--color-border)] font-semibold">
          <td className="p-2 font-sans">Total</td>
          <td className="text-right p-2">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
