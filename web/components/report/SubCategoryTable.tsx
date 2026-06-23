interface Row { main_category: string; sub_category: string; row_total: number; }

export function SubCategoryTable({ rows }: { rows: Row[] }) {
  const grouped = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!grouped.has(r.main_category)) grouped.set(r.main_category, new Map());
    const sub = grouped.get(r.main_category)!;
    sub.set(r.sub_category, (sub.get(r.sub_category) ?? 0) + Number(r.row_total));
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Main</th><th className="text-left p-2">Sub-category</th>
        <th className="text-right p-2">Hours</th><th className="text-right p-2">% of category</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...grouped.entries()].flatMap(([main, subs]) => {
          const catTotal = [...subs.values()].reduce((a, b) => a + b, 0);
          return [...subs.entries()].map(([sub, hrs]) => (
            <tr key={`${main}-${sub}`} className="border-t border-[var(--color-border)]">
              <td className="p-2 font-sans">{main}</td>
              <td className="p-2 font-sans">{sub}</td>
              <td className="text-right p-2">{hrs.toFixed(2)}</td>
              <td className="text-right p-2">{catTotal > 0 ? ((hrs / catTotal) * 100).toFixed(1) + '%' : '—'}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}
