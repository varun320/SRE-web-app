import { DAY_KEYS } from '@/lib/dates';

interface Row { project_number: number | null; mon_hrs: number; tue_hrs: number; wed_hrs: number; thu_hrs: number; fri_hrs: number; sat_hrs: number; sun_hrs: number; }

export function ProjectTable({ rows }: { rows: Row[] }) {
  const byProj = new Map<number, Record<typeof DAY_KEYS[number], number>>();
  for (const r of rows) {
    if (r.project_number == null) continue;
    if (!byProj.has(r.project_number)) byProj.set(r.project_number, { mon_hrs:0,tue_hrs:0,wed_hrs:0,thu_hrs:0,fri_hrs:0,sat_hrs:0,sun_hrs:0 });
    const acc = byProj.get(r.project_number)!;
    for (const k of DAY_KEYS) acc[k] += Number(r[k] ?? 0);
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Project #</th>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <th key={d} className="p-2">{d}</th>)}
        <th className="text-right p-2">Total</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...byProj.entries()].map(([n, days]) => {
          const total = DAY_KEYS.reduce((acc, k) => acc + days[k], 0);
          return (
            <tr key={n} className="border-t border-[var(--color-border)]">
              <td className="p-2">{n}</td>
              {DAY_KEYS.map((k) => <td key={k} className="text-center p-2">{days[k].toFixed(2)}</td>)}
              <td className="text-right p-2">{total.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
