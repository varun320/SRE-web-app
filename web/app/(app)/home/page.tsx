import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, Palmtree, Receipt } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { currentMonday } from '@/lib/dates';
import { fetchBalanceForUser, fetchSummary } from '@/lib/expenses/queries';
import { StatusBadge } from '@/components/ui/status-badge';
import type { TimesheetStatus } from '@/lib/types';

function money(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function statusTone(s: TimesheetStatus): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (s === 'approved') return 'success';
  if (s === 'submitted') return 'info';
  if (s === 'declined') return 'danger';
  return 'neutral';
}

export default async function HomePage() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const weekStart = currentMonday();

  const [tsRes, tilRes, vacRes, expenseSummary, expenseRows] = await Promise.all([
    sb.from('timesheets').select('id, status, submitted_at').eq('user_id', userId).eq('week_start', weekStart).maybeSingle(),
    sb.from('v_til_balance').select('closing_balance').maybeSingle(),
    sb.from('v_vacation_balance').select('closing_balance').maybeSingle(),
    fetchSummary(sb, userId),
    fetchBalanceForUser(sb, userId),
  ]);

  const tsId = tsRes.data?.id as string | undefined;
  const status = (tsRes.data?.status as TimesheetStatus | undefined) ?? 'draft';

  const totals = tsId
    ? (await sb
        .from('v_timesheet_totals')
        .select('total_hrs, overtime_earned, til_used, vacation_used')
        .eq('timesheet_id', tsId)
        .maybeSingle()).data
    : null;

  const totalHrs = Number(totals?.total_hrs ?? 0);
  const overtime = Number(totals?.overtime_earned ?? 0);
  const tilRemaining = Number(tilRes.data?.closing_balance ?? 0);
  const vacRemaining = Number(vacRes.data?.closing_balance ?? 0);

  const openInvoices = expenseRows.filter((r) => r.balance_status !== 'paid').length;
  const outstanding = Number(expenseSummary?.outstanding_principal ?? 0);
  const interest = Number(expenseSummary?.interest_accrued ?? 0);
  const totalOwing = Number(expenseSummary?.total_owing ?? 0);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <header>
        <h1 className="text-h1">Home</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Snapshot of your week — timesheet, balances, and expenses at a glance.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          href={`/week/${weekStart}`}
          icon={CalendarDays}
          title="This week"
          subtitle={`Week of ${weekStart}`}
          badge={<StatusBadge tone={statusTone(status)}>{status}</StatusBadge>}
          primary={`${totalHrs.toFixed(2)} h`}
          secondary={`${overtime.toFixed(2)} h overtime earned`}
          cta="Open timesheet"
        />
        <Card
          href="/expenses"
          icon={Receipt}
          title="Expenses"
          subtitle={openInvoices === 0 ? 'No open invoices' : `${openInvoices} open invoice${openInvoices === 1 ? '' : 's'}`}
          badge={
            totalOwing > 0 ? (
              <StatusBadge tone="warning">owing</StatusBadge>
            ) : (
              <StatusBadge tone="success">clear</StatusBadge>
            )
          }
          primary={money(totalOwing)}
          secondary={`${money(outstanding)} principal · ${money(interest)} interest`}
          cta="Open expenses"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          href="/me/til"
          icon={Clock}
          title="TIL bank"
          subtitle="Time-in-lieu balance"
          primary={`${tilRemaining.toFixed(2)} h`}
          secondary="Overtime is banked here after admin approval."
          cta="View ledger"
        />
        <Card
          href="/me/vacation"
          icon={Palmtree}
          title="Vacation"
          subtitle="Remaining this year"
          primary={`${vacRemaining.toFixed(2)} h`}
          secondary="Drawn down when you log Vacation Hours."
          cta="View ledger"
        />
      </section>
    </main>
  );
}

interface CardProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  primary: string;
  secondary: string;
  cta: string;
}

function Card({ href, icon: Icon, title, subtitle, badge, primary, secondary, cta }: CardProps) {
  return (
    <Link
      href={href}
      className="group rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-5 flex flex-col gap-3 hover:border-[var(--color-border)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{subtitle}</div>
          </div>
        </div>
        {badge}
      </div>
      <div className="font-mono tabular-nums text-3xl font-semibold leading-none">{primary}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{secondary}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
