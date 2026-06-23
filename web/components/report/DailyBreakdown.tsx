import { DAY_KEYS } from '@/lib/dates';

interface Row { mon_hrs: number; tue_hrs: number; wed_hrs: number; thu_hrs: number; fri_hrs: number; sat_hrs: number; sun_hrs: number; }

export function DailyBreakdown({ rows }: { rows: Row[] }) {
  const totals = DAY_KEYS.map((k) => rows.reduce((acc, r) => acc + (r[k] || 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const overtime = totals.map((t) => Math.max(0, t - 8));
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Category</th>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <th key={d} className="p-2">{d}</th>)}
        <th className="text-right p-2">Total</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        <tr className="border-t border-[var(--color-border)]"><td className="p-2 font-sans">Regular</td>
          {totals.map((t, i) => <td key={i} className="text-center p-2">{(t - overtime[i]).toFixed(2)}</td>)}
          <td className="text-right p-2">{(grand - overtime.reduce((a,b)=>a+b,0)).toFixed(2)}</td>
        </tr>
        <tr className="border-t border-[var(--color-border)]"><td className="p-2 font-sans">Overtime</td>
          {overtime.map((t, i) => <td key={i} className="text-center p-2">{t.toFixed(2)}</td>)}
          <td className="text-right p-2">{overtime.reduce((a,b)=>a+b,0).toFixed(2)}</td>
        </tr>
        <tr className="border-t border-[var(--color-border)] font-semibold"><td className="p-2 font-sans">Total</td>
          {totals.map((t, i) => <td key={i} className="text-center p-2">{t.toFixed(2)}</td>)}
          <td className="text-right p-2">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
