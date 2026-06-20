import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalQueue } from '@/components/admin/ApprovalQueue';
import { Clock4, CheckCircle2, XCircle, FileDown } from 'lucide-react';

export default async function AdminHome() {
  const sb = await getSupabaseServer();
  const rows = await fetchSubmittedQueue(sb);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: approvedThisWeek }, { count: declinedThisWeek }, { count: importedThisWeek }] =
    await Promise.all([
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'approve').gte('at', since),
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'decline').gte('at', since),
      sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'imported').gte('at', since),
    ]);

  return (
    <div className="px-4 md:px-6 py-6 space-y-5">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Approval queue</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Submitted timesheets waiting for review, oldest first.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock4}        label="Pending review"       value={rows.length}                tone="info" />
        <StatCard icon={CheckCircle2}  label="Approved (7d)"        value={approvedThisWeek ?? 0}      tone="success" />
        <StatCard icon={XCircle}       label="Declined (7d)"        value={declinedThisWeek ?? 0}      tone="danger" />
        <StatCard icon={FileDown}      label="Imported (7d)"        value={importedThisWeek ?? 0}      tone="muted" />
      </div>

      <ApprovalQueue rows={rows} />
    </div>
  );
}

const TONE_STYLES = {
  info:    { ring: 'ring-blue-500/20',    icon: 'text-blue-600 dark:text-blue-300' },
  success: { ring: 'ring-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-300' },
  danger:  { ring: 'ring-red-500/20',     icon: 'text-red-600 dark:text-red-300' },
  muted:   { ring: 'ring-[var(--color-border)]', icon: 'text-[var(--color-text-muted)]' },
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE_STYLES;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 ring-1 ring-inset ${styles.ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
        <Icon className={`h-4 w-4 ${styles.icon}`} />
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
