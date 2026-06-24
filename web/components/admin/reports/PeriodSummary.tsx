import type { PeriodSummaryRow } from '@/lib/admin/reports/payroll';

interface Props {
  employee: { full_name: string; employee_code: string; department: string | null };
  from: string;
  to: string;
  rows: PeriodSummaryRow[];
}

export function PeriodSummary({ employee, from, to, rows }: Props) {
  const totals = rows.reduce(
    (a, r) => ({
      total: a.total + r.regular_hrs + r.overtime_earned + r.til_payout_hrs,
      regular: a.regular + r.regular_hrs,
      ot: a.ot + r.overtime_earned,
      payout: a.payout + r.til_payout_hrs,
      vac: a.vac + r.vacation_used,
      til: a.til + r.til_used,
    }),
    { total: 0, regular: 0, ot: 0, payout: 0, vac: 0, til: 0 },
  );

  const generated = new Date().toISOString().slice(0, 10);

  return (
    <article className="period-summary mx-auto max-w-3xl bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] shadow-[var(--shadow-card)] p-6 md:p-10 space-y-6 print:max-w-none print:shadow-none print:border-0 print:p-0">
      <header className="flex items-start justify-between border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Sulfur Recovery Engineering Inc.
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Period summary</h1>
          <div className="mt-2 text-sm text-[var(--color-text-muted)]">
            {from} → {to}
          </div>
        </div>
        <div className="text-right text-xs text-[var(--color-text-muted)]">
          Generated {generated}
        </div>
      </header>

      <section>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Employee</div>
        <div className="mt-1 text-lg font-medium">{employee.full_name}</div>
        <div className="text-xs text-[var(--color-text-muted)] font-mono">
          {employee.employee_code}
          {employee.department ? <> · {employee.department}</> : null}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Weekly detail</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            No approved weeks in this range.
          </p>
        ) : (
          <table className="w-full text-sm border border-[var(--color-border-soft)] rounded-md overflow-hidden">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/50">
              <tr>
                <th className="text-left px-3 py-2 font-normal">Week of</th>
                <th className="text-right px-3 py-2 font-normal">Regular</th>
                <th className="text-right px-3 py-2 font-normal">Overtime</th>
                <th className="text-right px-3 py-2 font-normal">TIL payout</th>
                <th className="text-right px-3 py-2 font-normal">TIL used</th>
                <th className="text-right px-3 py-2 font-normal">Vacation</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {rows.map((r) => (
                <tr key={r.week_start} className="border-t border-[var(--color-border-soft)]">
                  <td className="px-3 py-2 font-sans">{r.week_start}</td>
                  <td className="text-right px-3 py-2">{r.regular_hrs.toFixed(2)}</td>
                  <td className="text-right px-3 py-2">{r.overtime_earned.toFixed(2)}</td>
                  <td className="text-right px-3 py-2">{r.til_payout_hrs.toFixed(2)}</td>
                  <td className="text-right px-3 py-2">{r.til_used.toFixed(2)}</td>
                  <td className="text-right px-3 py-2">{r.vacation_used.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-mono tabular-nums">
              <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
                <td className="px-3 py-2 font-sans font-medium">Total</td>
                <td className="text-right px-3 py-2 font-medium">{totals.regular.toFixed(2)}</td>
                <td className="text-right px-3 py-2 font-medium">{totals.ot.toFixed(2)}</td>
                <td className="text-right px-3 py-2 font-medium">{totals.payout.toFixed(2)}</td>
                <td className="text-right px-3 py-2 font-medium">{totals.til.toFixed(2)}</td>
                <td className="text-right px-3 py-2 font-medium">{totals.vac.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <Summary label="Total hours" value={totals.total} />
        <Summary label="Overtime earned" value={totals.ot} />
        <Summary label="TIL paid out" value={totals.payout} />
        <Summary label="Vacation taken" value={totals.vac} />
      </section>

      <section className="grid grid-cols-2 gap-6 pt-8 mt-4 border-t border-[var(--color-border)] text-sm">
        <SignatureLine label="Employee signature" />
        <SignatureLine label="Approver signature" />
      </section>

      {/* Print-only helper at the bottom */}
      <p className="hidden print:block text-[10px] text-[var(--color-text-muted)] text-center mt-6">
        Generated from the SRE Timesheet system on {generated}.
      </p>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--color-border-soft)] py-1">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-mono tabular-nums">{value.toFixed(2)} hrs</span>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b border-[var(--color-text)] h-12" />
      <div className="mt-1 text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
