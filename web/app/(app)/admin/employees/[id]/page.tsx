import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { EmployeeEditForm, type EmployeeEditValues } from '@/components/admin/EmployeeEditForm';
import { StatusBadge } from '@/components/ui/status-badge';

interface Props { params: Promise<{ id: string }> }

export default async function EmployeeDetail({ params }: Props) {
  const { id } = await params;
  const sb = await getSupabaseServer();
  const { data: u } = await sb
    .from('users')
    .select('id, full_name, email, employee_code, department, is_active, position_id')
    .eq('id', id)
    .maybeSingle();
  if (!u) notFound();

  const [{ data: pos }, { data: positions }, { data: roles }, { data: weeks }, { data: til }, { data: vac }, { data: tilSeed }, { data: vacSeed }] = await Promise.all([
    u.position_id
      ? sb.from('positions').select('name, annual_vacation_hours').eq('id', u.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('positions').select('id, name, annual_vacation_hours').order('name'),
    sb.from('user_roles').select('role').eq('user_id', id),
    sb.from('timesheets').select('id, week_start, status').eq('user_id', id).order('week_start', { ascending: false }).limit(20),
    sb.from('v_til_balance').select('closing_balance').eq('user_id', id).maybeSingle(),
    sb.from('v_vacation_balance').select('closing_balance').eq('user_id', id).maybeSingle(),
    sb.from('til_ledger').select('opening_balance').eq('user_id', id).eq('frozen', true).order('week_start', { ascending: true }).limit(1).maybeSingle(),
    sb.from('vacation_ledger').select('opening_balance').eq('user_id', id).eq('frozen', true).order('week_start', { ascending: true }).limit(1).maybeSingle(),
  ]);

  const isAdmin = (roles ?? []).some((r) => r.role === 'admin');
  const editValues: EmployeeEditValues = {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    employee_code: u.employee_code,
    department: u.department,
    position_id: u.position_id,
    is_active: u.is_active,
    role: isAdmin ? 'admin' : 'employee',
  };

  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-6">
      <div>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <ChevronLeftIcon className="size-3.5" />
          All employees
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{u.employee_code}</div>
            <h2 className="text-xl font-semibold tracking-tight">{u.full_name}</h2>
          </div>
          <StatusBadge tone={u.is_active ? 'success' : 'muted'}>
            {u.is_active ? 'Active' : 'Inactive'}
          </StatusBadge>
          {isAdmin ? <StatusBadge tone="info">Admin</StatusBadge> : null}
        </div>
        <div className="mt-1 text-sm text-[var(--color-text-muted)]">
          {u.email} · {pos?.name ?? 'no position'} · {u.department ?? 'no dept'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border-soft)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">TIL balance</div>
          <div className="text-2xl font-mono">{Number(til?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border-soft)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Vacation balance</div>
          <div className="text-2xl font-mono">{Number(vac?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
      </div>

      <EmployeeEditForm
        employee={editValues}
        positions={positions ?? []}
        openingTil={Number(tilSeed?.opening_balance ?? 0)}
        openingVacation={Number(vacSeed?.opening_balance ?? 0)}
      />

      <div>
        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Recent weeks</h3>
        {weeks && weeks.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {weeks.map((w) => (
              <li key={w.id}>
                <Link className="text-[var(--color-accent)] hover:underline font-mono" href={`/admin/employees/${id}/week/${w.week_start}`}>
                  {w.week_start}
                </Link>
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
