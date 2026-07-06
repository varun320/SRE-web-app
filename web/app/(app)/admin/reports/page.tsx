import Link from 'next/link';
import { Wallet, FolderKanban, FileText, Snowflake, Download, Eye, Layers } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';

interface ReportCard {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  audience: string;
  outputs: string[];
  tone: 'blue' | 'amber' | 'emerald' | 'violet' | 'rose';
}

const REPORTS: ReportCard[] = [
  {
    href: '/admin/reports/payroll',
    icon: Wallet,
    title: 'Payroll export',
    description: 'Bi-weekly pay-period breakdown per employee — regular hours, overtime, TIL payout, vacation, current balances.',
    audience: 'For payroll & finance',
    outputs: ['On-screen preview', 'CSV download'],
    tone: 'blue',
  },
  {
    href: '/admin/reports/categories',
    icon: Layers,
    title: 'Hours by category',
    description: 'Approved hours grouped by main category (Project, Admin, Office & Sales) and sub-category. Shows where the team spent time.',
    audience: 'For managers & PMO',
    outputs: ['On-screen breakdown', 'CSV download'],
    tone: 'rose',
  },
  {
    href: '/admin/reports/projects',
    icon: FolderKanban,
    title: 'Hours by project',
    description: 'How many hours each project absorbed, expanded to per-employee breakdown. Filter to one project for deep dives.',
    audience: 'For project managers',
    outputs: ['On-screen breakdown', 'CSV download'],
    tone: 'emerald',
  },
  {
    href: '/admin/reports/period',
    icon: FileText,
    title: 'Per-employee summary',
    description: 'A clean, printable per-employee period sheet with signature lines. Save as PDF directly from the print dialog.',
    audience: 'For HR & signatures',
    outputs: ['Print', 'Save as PDF'],
    tone: 'violet',
  },
  {
    href: '/admin/reports/balances',
    icon: Snowflake,
    title: 'Balances snapshot',
    description: 'Current TIL + vacation balance per active employee, point-in-time. Sortable; low-vacation entries flagged red.',
    audience: 'For finance & HR',
    outputs: ['On-screen table', 'CSV download'],
    tone: 'amber',
  },
];

const TONE: Record<ReportCard['tone'], { bg: string; ring: string; icon: string }> = {
  blue:    { bg: 'bg-blue-500/10',    ring: 'ring-blue-500/30',    icon: 'text-blue-600 dark:text-blue-300' },
  emerald: { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', icon: 'text-emerald-600 dark:text-emerald-300' },
  amber:   { bg: 'bg-amber-500/10',   ring: 'ring-amber-500/30',   icon: 'text-amber-600 dark:text-amber-300' },
  violet:  { bg: 'bg-violet-500/10',  ring: 'ring-violet-500/30',  icon: 'text-violet-600 dark:text-violet-300' },
  rose:    { bg: 'bg-rose-500/10',    ring: 'ring-rose-500/30',    icon: 'text-rose-600 dark:text-rose-300' },
};

export default async function ReportsHome() {
  const sb = await getSupabaseServer();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: approvedCount },
    { count: weekCount },
    { count: activeUsers },
  ] = await Promise.all([
    sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'approve').gte('at', since30),
    sb.from('approval_log').select('id', { count: 'exact', head: true }).eq('action', 'approve').gte('at', since7),
    sb.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-gradient-to-br from-[var(--color-accent-tint)] via-[var(--color-surface)] to-[var(--color-surface-2)] p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-medium tracking-tight">All reports use approved weeks only.</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-2xl">
              Drafts and submitted-but-pending weeks are excluded — approve them in the queue first if you need them in a report.
              Every export is a snapshot at the moment you download it.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <Stat label="Approvals · 30d" value={approvedCount ?? 0} />
            <Stat label="Approvals · 7d"  value={weekCount ?? 0} />
            <Stat label="Active staff"    value={activeUsers ?? 0} />
          </div>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        {REPORTS.map((r) => {
          const t = TONE[r.tone];
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className={`group rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card)] transition-all space-y-3 ring-1 ring-inset ${t.ring}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${t.bg} ${t.icon}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-medium tracking-tight">{r.title}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{r.audience}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{r.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {r.outputs.map((o) => (
                  <span
                    key={o}
                    className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 ring-1 ring-inset ring-[var(--color-border)]"
                  >
                    {o.includes('CSV') || o.includes('PDF') ? <Download className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {o}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">
        {label}
      </div>
    </div>
  );
}
