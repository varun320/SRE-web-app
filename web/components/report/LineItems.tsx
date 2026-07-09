import type { MainCategory } from '@/lib/types';
import { subCategoryLabel } from '@/lib/categoryDescriptions';

interface Row {
  main_category: MainCategory;
  sub_category: string;
  project_number: number | null;
  description: string | null;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  row_total: number;
}

const DAYS: Array<{ key: keyof Row; label: string }> = [
  { key: 'mon_hrs', label: 'Mon' },
  { key: 'tue_hrs', label: 'Tue' },
  { key: 'wed_hrs', label: 'Wed' },
  { key: 'thu_hrs', label: 'Thu' },
  { key: 'fri_hrs', label: 'Fri' },
  { key: 'sat_hrs', label: 'Sat' },
  { key: 'sun_hrs', label: 'Sun' },
];

export function LineItems({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Category / project</th>
          <th>Description</th>
          {DAYS.map((d) => (
            <th key={d.label} className="num">{d.label}</th>
          ))}
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="align-top">
            <td>
              <div className="text-xs col-muted">{r.main_category}</div>
              <div>{subCategoryLabel(r.sub_category)}</div>
              {r.project_number != null ? (
                <div className="text-xs col-muted">#{r.project_number}</div>
              ) : null}
            </td>
            <td className="max-w-[420px]">
              <div className="whitespace-pre-wrap break-words">
                {r.description?.trim() ? r.description : (
                  <span className="col-muted italic">no description</span>
                )}
              </div>
            </td>
            {DAYS.map((d) => {
              const v = Number(r[d.key] ?? 0);
              return (
                <td key={d.label} className="num">
                  {v > 0 ? v.toFixed(2) : <span className="col-muted">—</span>}
                </td>
              );
            })}
            <td className="num font-semibold">{Number(r.row_total).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
