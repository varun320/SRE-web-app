import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { currentMonday, DAY_KEYS } from '@/lib/dates';
import { fetchSummary } from '@/lib/expenses/queries';
import { StatusBadge } from '@/components/ui/status-badge';
import { HoursSparkline } from '@/components/home/HoursSparkline';
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

// Time-aware greeting in Calgary time (America/Edmonton — SRE HQ).
function greeting(now: Date): string {
  const hour = Number(now.toLocaleString('en-CA', { hour: 'numeric', hour12: false, timeZone: 'America/Edmonton' }));
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function firstNameFrom(full: string | null | undefined, email: string | null | undefined): string {
  if (full && full.trim()) return full.trim().split(/\s+/)[0];
  if (email) return (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').split(/\s+/)[0] || 'there';
  return 'there';
}

function relativeShort(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

interface Activity {
  key: string;
  at: string;
  title: string;
  href: string | null;
  tone: 'info' | 'success' | 'warning' | 'neutral';
}

const ACTION_TONE_MAP: Record<string, Activity['tone']> = {
  approve: 'success',
  submit: 'info',
  decline: 'warning',
  unlock: 'warning',
  payout_add: 'success',
  payout_delete: 'warning',
};

export default async function HomePage() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const weekStart = currentMonday();

  const { data: tsRow } = await sb
    .from('timesheets')
    .select('id, status, submitted_at, decline_reason')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  const tsId = (tsRow?.id as string | undefined) ?? null;
  const status = (tsRow?.status as TimesheetStatus | undefined) ?? 'draft';

  const [totalsRes, tilRes, vacRes, expenseSummary, entriesRes, userRecordRes, tsLogRes, exLogRes] = await Promise.all([
    tsId
      ? sb.from('v_timesheet_totals').select('total_hrs, overtime_earned, til_used, vacation_used').eq('timesheet_id', tsId).maybeSingle()
      : Promise.resolve({ data: null as null | { total_hrs: number; overtime_earned: number; til_used: number; vacation_used: number } }),
    sb.from('v_til_balance').select('closing_balance').maybeSingle(),
    sb.from('v_vacation_balance').select('closing_balance').maybeSingle(),
    fetchSummary(sb, userId),
    tsId
      ? sb.from('timesheet_entries').select('mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs').eq('timesheet_id', tsId)
      : Promise.resolve({ data: [] as Array<Record<(typeof DAY_KEYS)[number], number>> }),
    sb.from('users').select('full_name, email').eq('id', userId).maybeSingle(),
    sb.from('approval_log')
      .select('id, action, at, timesheet_id, timesheets!inner(user_id, week_start)')
      .eq('timesheets.user_id', userId)
      .order('at', { ascending: false })
      .limit(5),
    sb.from('expense_approval_log')
      .select('id, action, created_at, comment, expense_id, expense_reports!inner(user_id, invoice_no)')
      .eq('expense_reports.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const totalHrs = Number(totalsRes.data?.total_hrs ?? 0);
  const overtime = Number(totalsRes.data?.overtime_earned ?? 0);
  const tilRemaining = Number(tilRes.data?.closing_balance ?? 0);
  const vacRemaining = Number(vacRes.data?.closing_balance ?? 0);
  const totalOwing = Number(expenseSummary?.total_owing ?? 0);

  const perDay: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
  for (const r of entriesRes.data ?? []) {
    perDay[0] += Number(r.mon_hrs ?? 0);
    perDay[1] += Number(r.tue_hrs ?? 0);
    perDay[2] += Number(r.wed_hrs ?? 0);
    perDay[3] += Number(r.thu_hrs ?? 0);
    perDay[4] += Number(r.fri_hrs ?? 0);
    perDay[5] += Number(r.sat_hrs ?? 0);
    perDay[6] += Number(r.sun_hrs ?? 0);
  }

  const nowCalgary = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Edmonton' }));
  const jsDow = nowCalgary.getDay();
  const monSunIdx = jsDow === 0 ? 6 : jsDow - 1;
  const weekStartDate = new Date(`${weekStart}T00:00:00-06:00`);
  const daysSinceMonday = Math.floor((nowCalgary.getTime() - weekStartDate.getTime()) / 86_400_000);
  const todayIndex = daysSinceMonday >= 0 && daysSinceMonday <= 6 ? monSunIdx : -1;
  const daysLeft = todayIndex >= 0 ? 6 - todayIndex : 0;

  const first = firstNameFrom(userRecordRes.data?.full_name as string | undefined, userRecordRes.data?.email as string | undefined);
  const hello = greeting(nowCalgary);
  const weekdayName = todayIndex >= 0 ? WEEKDAY[jsDow] : '';

  const activities: Activity[] = [];
  for (const r of tsLogRes.data ?? []) {
    const ts = Array.isArray(r.timesheets) ? r.timesheets[0] : r.timesheets;
    if (!ts) continue;
    const wk = (ts.week_start as string) ?? '';
    const action = String(r.action);
    activities.push({
      key: `ts-${r.id}`,
      at: String(r.at),
      title: action === 'submit' ? `You submitted the week of ${wk}`
        : action === 'approve' ? `An admin approved your week of ${wk}`
        : action === 'decline' ? `An admin sent back your week of ${wk}`
        : action === 'unlock' ? `An admin unlocked your week of ${wk}`
        : `${action} · week of ${wk}`,
      href: r.timesheet_id ? `/week/${wk}` : null,
      tone: ACTION_TONE_MAP[action] ?? 'neutral',
    });
  }
  for (const r of exLogRes.data ?? []) {
    const ex = Array.isArray(r.expense_reports) ? r.expense_reports[0] : r.expense_reports;
    if (!ex) continue;
    const inv = (ex.invoice_no as string) ?? '';
    const action = String(r.action);
    activities.push({
      key: `ex-${r.id}`,
      at: String(r.created_at),
      title: action === 'submit' ? `You submitted expense ${inv}`
        : action === 'approve' ? `An admin approved expense ${inv}`
        : action === 'decline' ? `An admin sent back expense ${inv}`
        : action === 'payout_add' ? `A payout landed against ${inv}`
        : `${action} · ${inv}`,
      href: inv ? `/expenses/${encodeURIComponent(inv)}` : null,
      tone: ACTION_TONE_MAP[action] ?? 'neutral',
    });
  }
  activities.sort((a, b) => b.at.localeCompare(a.at));
  const recent = activities.slice(0, 6);

  return (
    <main className="w-full px-3 md:px-4 py-6 md:py-10 space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-display leading-none">
          {hello}, {first}.
        </h1>
        <p className="mt-2 text-body-lg text-[var(--color-text-muted)]">
          {weekdayName ? (
            <>
              {weekdayName}
              {daysLeft > 0 ? (
                <>. <span className="text-[var(--color-text)]">{daysLeft}</span> {daysLeft === 1 ? 'day' : 'days'} left to log this week.</>
              ) : (
                <>. This week wraps today — submit before end of day.</>
              )}
            </>
          ) : (
            <>Snapshot of your week.</>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <Link
          href={`/week/${weekStart}`}
          className="lift-hover group rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6 md:p-8 flex flex-col gap-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-caption text-[var(--color-text-muted)]">This week · {weekStart}</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono tabular text-[44px] font-medium leading-none">
                  {totalHrs.toFixed(1)}
                </span>
                <span className="text-body-lg text-[var(--color-text-muted)]">h logged</span>
              </div>
              {overtime > 0 ? (
                <div className="mt-1.5 text-body-sm text-[var(--color-status-submitted-fg)]">
                  {overtime.toFixed(2)} h overtime earned
                </div>
              ) : null}
            </div>
            <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
          </div>

          <HoursSparkline hours={perDay} todayIndex={todayIndex} />

          <div className="mt-1 inline-flex items-center gap-1.5 text-body-strong text-[var(--color-accent)] group-hover:gap-2.5 transition-all">
            Open this week
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        <div className="lift-hover rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] divide-y divide-[var(--color-border-soft)] flex flex-col">
          <BalanceRow href="/me/til" label="TIL bank" value={`${tilRemaining.toFixed(2)} h`} caption="Earned overtime, spend later" />
          <BalanceRow
            href="/me/vacation"
            label="Vacation"
            value={`${vacRemaining.toFixed(2)} h`}
            caption="Remaining this year"
            tone={vacRemaining < 0 ? 'warning' : 'neutral'}
          />
          <BalanceRow
            href="/expenses"
            label="Expenses owing"
            value={money(totalOwing)}
            caption={totalOwing > 0 ? 'Waiting on payout' : 'Nothing outstanding'}
            tone={totalOwing > 0 ? 'warning' : 'success'}
          />
        </div>
      </div>

      <section className="max-w-3xl">
        <h2 className="text-h3 mb-3">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-body-sm text-[var(--color-text-muted)]">
            Nothing yet. Once you submit a timesheet or expense, it shows up here.
          </p>
        ) : (
          <ul className="stagger-enter border-t border-[var(--color-border-soft)]">
            {recent.map((a) => (
              <li key={a.key}>
                {a.href ? (
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors -mx-2 px-2 rounded-sm"
                  >
                    <ActivityDot tone={a.tone} />
                    <span className="flex-1 text-body">{a.title}</span>
                    <span className="text-body-sm text-[var(--color-text-muted)] tabular">{relativeShort(a.at)}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" aria-hidden />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border-soft)]">
                    <ActivityDot tone={a.tone} />
                    <span className="flex-1 text-body">{a.title}</span>
                    <span className="text-body-sm text-[var(--color-text-muted)] tabular">{relativeShort(a.at)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function BalanceRow({
  href,
  label,
  value,
  caption,
  tone = 'neutral',
}: {
  href: string;
  label: string;
  value: string;
  caption: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const color =
    tone === 'success' ? 'var(--color-status-approved-fg)'
    : tone === 'warning' ? 'var(--color-status-declined-fg)'
    : 'var(--color-text)';
  return (
    <Link
      href={href}
      className="group px-5 py-4 flex items-baseline justify-between gap-3 hover:bg-[var(--color-surface-2)]/40 transition-colors first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
    >
      <div className="min-w-0">
        <div className="text-caption text-[var(--color-text-muted)]">{label}</div>
        <div className="mt-0.5 text-body-sm text-[var(--color-text-muted)]">{caption}</div>
      </div>
      <div className="text-right">
        <div className="font-mono tabular text-[22px] font-medium leading-none" style={{ color }}>{value}</div>
        <div className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-[var(--color-text-subtle)] group-hover:text-[var(--color-text-muted)] transition-colors">
          Open <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

function ActivityDot({ tone }: { tone: Activity['tone'] }) {
  const color =
    tone === 'success' ? 'var(--color-status-approved-fg)'
    : tone === 'info' ? 'var(--color-status-submitted-fg)'
    : tone === 'warning' ? 'var(--color-status-declined-fg)'
    : 'var(--color-text-muted)';
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
}
