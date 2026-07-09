interface Row { main_category: string; sub_category: string; row_total: number; }

export function SubCategoryTable({ rows }: { rows: Row[] }) {
  const grouped = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!grouped.has(r.main_category)) grouped.set(r.main_category, new Map());
    const sub = grouped.get(r.main_category)!;
    sub.set(r.sub_category, (sub.get(r.sub_category) ?? 0) + Number(r.row_total));
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Main</th>
          <th>Sub-category</th>
          <th className="num">Hours</th>
          <th className="num">% of category</th>
        </tr>
      </thead>
      <tbody>
        {[...grouped.entries()].flatMap(([main, subs]) => {
          const catTotal = [...subs.values()].reduce((a, b) => a + b, 0);
          return [...subs.entries()].map(([sub, hrs]) => (
            <tr key={`${main}-${sub}`}>
              <td>{main}</td>
              <td>{sub}</td>
              <td className="num">{hrs.toFixed(2)}</td>
              <td className="num">{catTotal > 0 ? ((hrs / catTotal) * 100).toFixed(1) + '%' : '—'}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}
