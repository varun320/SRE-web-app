import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ id: string }> }

export default async function EmployeeDetail({ params }: Props) {
  const { id } = await params;
  const sb = await getSupabaseServer();
  const { data: u } = await sb.from('users').select('id, full_name, email, employee_code, department, is_active, position_id').eq('id', id).maybeSingle();
  if (!u) notFound();
  const { data: pos } = u.position_id ? await sb.from('positions').select('name, annual_vacation_hours').eq('id', u.position_id).maybeSingle() : { data: null };
  const { data: weeks } = await sb.from('timesheets').select('id, week_start, status').eq('user_id', id).order('week_start', { ascending: false }).limit(20);
  const { data: til } = await sb.from('v_til_balance').select('closing_balance').eq('user_id', id).maybeSingle();
  const { data: vac } = await sb.from('v_vacation_balance').select('closing_balance').eq('user_id', id).maybeSingle();

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{u.employee_code}</div>
        <h2 className="text-xl font-semibold">{u.full_name}</h2>
        <div className="text-sm text-[var(--color-text-muted)]">{u.email} · {pos?.name ?? 'no position'} · {u.department ?? 'no dept'}</div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">TIL balance</div>
          <div className="text-2xl font-mono">{Number(til?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Vacation balance</div>
          <div className="text-2xl font-mono">{Number(vac?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Recent weeks</h3>
        {weeks && weeks.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {weeks.map((w) => (
              <li key={w.id}>
                <Link className="text-[var(--color-accent)] hover:underline font-mono" href={`/admin/employees/${id}/week/${w.week_start}`}>{w.week_start}</Link>
                {' — '}
                <span className="text-[var(--color-text-muted)]">{w.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No timesheets yet.</p>
        )}
      </div>
    </div>
  );
}
