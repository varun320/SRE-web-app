import type { MainCategory } from '@/lib/types';

interface Row { main_category: MainCategory; row_total: number; }

export function CategoryTable({ rows }: { rows: Row[] }) {
  const byCat = new Map<MainCategory, number>();
  for (const r of rows) byCat.set(r.main_category, (byCat.get(r.main_category) ?? 0) + Number(r.row_total));
  const grand = [...byCat.values()].reduce((a, b) => a + b, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Main category</th>
          <th className="num">Hours</th>
        </tr>
      </thead>
      <tbody>
        {[...byCat.entries()].map(([cat, hrs]) => (
          <tr key={cat}>
            <td>{cat}</td>
            <td className="num">{hrs.toFixed(2)}</td>
          </tr>
        ))}
        <tr>
          <td className="font-semibold">Total</td>
          <td className="num font-semibold">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
