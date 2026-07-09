import { DAY_KEYS } from '@/lib/dates';

interface Row {
  mon_hrs: number; tue_hrs: number; wed_hrs: number; thu_hrs: number;
  fri_hrs: number; sat_hrs: number; sun_hrs: number;
}

export function DailyBreakdown({ rows }: { rows: Row[] }) {
  const totals = DAY_KEYS.map((k) => rows.reduce((acc, r) => acc + (r[k] || 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const overtime = totals.map((t) => Math.max(0, t - 8));
  const otTotal = overtime.reduce((a, b) => a + b, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Category</th>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
            <th key={d} className="num">{d}</th>
          ))}
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Regular</td>
          {totals.map((t, i) => (
            <td key={i} className="num">{(t - overtime[i]).toFixed(2)}</td>
          ))}
          <td className="num">{(grand - otTotal).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Overtime</td>
          {overtime.map((t, i) => (
            <td key={i} className="num">{t.toFixed(2)}</td>
          ))}
          <td className="num">{otTotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td className="font-semibold">Total</td>
          {totals.map((t, i) => (
            <td key={i} className="num font-semibold">{t.toFixed(2)}</td>
          ))}
          <td className="num font-semibold">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
