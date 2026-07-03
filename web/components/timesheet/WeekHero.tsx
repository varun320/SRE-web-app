// Linear-inspired hero card for the weekly timesheet page.
//
// Sits above the entry table and orients the user at a glance: what week,
// how many hours logged so far, how that compares to last week, TIL and
// vacation balance snapshots, and current submission status.
//
// Visual language:
//   - dark card with a warm gradient inner glow + cool blue accent
//   - subtle animated dot-grid background that fades toward the edges
//   - thin gradient border ring
//   - big tabular-nums numeric display, hand-rolled ticker on load
//   - sparkline draws itself left-to-right on mount
//   - status chip pulses gently when the week is still a draft
//   - respects prefers-reduced-motion for all of the above

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DotPattern } from '@/components/ui/dot-pattern';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Sparkline } from '@/components/ui/sparkline';
import type { Timesheet } from '@/lib/types';

interface WeekHeroProps {
  timesheet: Timesheet;
  dailyHours: number[]; // Mon..Sun
  totalHours: number;
  lastWeekHours: number | null;
  openingTil: number;
  openingVacation: number;
  tilDelta: number | null;
  vacationDelta: number | null;
  validationIssues: number;
}

const STATUS_META: Record<
  Timesheet['status'],
  { label: string; dot: string; text: string; ring: string; pulse: boolean }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-amber-400',
    text: 'text-amber-200',
    ring: 'ring-amber-400/25',
    pulse: true,
  },
  submitted: {
    label: 'Submitted',
    dot: 'bg-sky-400',
    text: 'text-sky-200',
    ring: 'ring-sky-400/25',
    pulse: false,
  },
  approved: {
    label: 'Approved',
    dot: 'bg-emerald-400',
    text: 'text-emerald-200',
    ring: 'ring-emerald-400/25',
    pulse: false,
  },
  declined: {
    label: 'Declined',
    dot: 'bg-rose-400',
    text: 'text-rose-200',
    ring: 'ring-rose-400/25',
    pulse: false,
  },
};

function friendlyDelta(delta: number | null, decimals = 1) {
  if (delta === null) return { icon: Minus, sign: '', abs: '—' };
  if (Math.abs(delta) < 0.05) return { icon: Minus, sign: '±', abs: '0' };
  const icon = delta > 0 ? TrendingUp : TrendingDown;
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta).toFixed(decimals);
  return { icon, sign, abs };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekHero({
  timesheet,
  dailyHours,
  totalHours,
  lastWeekHours,
  openingTil,
  openingVacation,
  tilDelta,
  vacationDelta,
  validationIssues,
}: WeekHeroProps) {
  const monday = parseISO(timesheet.week_start);
  const sunday = addDays(monday, 6);
  const weekNumber = format(monday, 'w');
  const monthLabel = format(monday, 'MMMM yyyy').toUpperCase();
  const rangeLabel = `${format(monday, 'MMM d')} — ${format(sunday, 'MMM d')}`;

  const today = new Date();
  const daysIn = Math.max(
    0,
    Math.min(6, differenceInCalendarDays(today, monday)),
  );
  const inCurrentWeek =
    today >= monday && today <= addDays(monday, 6);
  const daysLeft = inCurrentWeek ? Math.max(0, 6 - daysIn) : null;

  const wowDelta =
    lastWeekHours !== null ? totalHours - lastWeekHours : null;
  const wow = friendlyDelta(wowDelta);
  const WowIcon = wow.icon;

  const status = STATUS_META[timesheet.status];
  const isDraft = timesheet.status === 'draft';

  return (
    <section
      className="hero-wrap group/hero"
      aria-labelledby="week-hero-heading"
    >
      <div className="hero-card">
        {/* Dot-grid background with radial fade */}
        <DotPattern
          className="hero-grid text-white/[0.06] dark:text-white/[0.09]"
          size={22}
          radius={1}
        />

        {/* Aurora glow blobs */}
        <div className="hero-glow hero-glow--warm" aria-hidden />
        <div className="hero-glow hero-glow--cool" aria-hidden />

        {/* Top meta strip */}
        <header className="hero-meta">
          <div className="hero-meta__left">
            <span className="hero-eyebrow">
              <span className="hero-eyebrow__num">W{weekNumber}</span>
              <span className="hero-eyebrow__sep" aria-hidden>
                ·
              </span>
              <span>{monthLabel}</span>
              <span className="hero-eyebrow__sep" aria-hidden>
                ·
              </span>
              <span>{rangeLabel}</span>
            </span>
          </div>
          <div className="hero-meta__right">
            <span className={`status-pill ${status.text} ${status.ring} ${status.pulse ? 'status-pill--pulse' : ''}`}>
              <span className={`status-pill__dot ${status.dot}`} />
              {status.label}
            </span>
            <Link
              href={`/week/${timesheet.week_start}/report`}
              className="hero-report-link"
            >
              View report
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </header>

        {/* Big number + week comparison */}
        <div className="hero-headline">
          <h1
            id="week-hero-heading"
            className="hero-headline__number"
            aria-label={`${totalHours.toFixed(1)} hours logged this week`}
          >
            <NumberTicker value={totalHours} decimals={1} />
            <span className="hero-headline__unit">h</span>
          </h1>

          <div className="hero-headline__side">
            <div className="hero-delta">
              <WowIcon
                className={`h-3.5 w-3.5 ${
                  wowDelta === null || Math.abs(wowDelta) < 0.05
                    ? 'text-white/40'
                    : wowDelta > 0
                    ? 'text-emerald-300'
                    : 'text-rose-300'
                }`}
                aria-hidden
              />
              <span className="hero-delta__value">
                {wow.sign}
                {wow.abs}h
              </span>
              <span className="hero-delta__label">vs last week</span>
            </div>
            {daysLeft !== null ? (
              <div className="hero-caption">
                {daysLeft === 0
                  ? 'Last day of the week'
                  : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in the week`}
              </div>
            ) : (
              <div className="hero-caption">
                {differenceInCalendarDays(today, monday) < 0
                  ? 'Upcoming week'
                  : 'Past week'}
              </div>
            )}
          </div>
        </div>

        {/* Sparkline of daily hours */}
        <div className="hero-spark">
          <div className="hero-spark__labels">
            {DAY_LABELS.map((d, i) => (
              <span
                key={d}
                className={`hero-spark__label ${inCurrentWeek && i === daysIn ? 'hero-spark__label--today' : ''}`}
              >
                {d}
                <span className="hero-spark__label-num">
                  {dailyHours[i]?.toFixed(1) ?? '0.0'}
                </span>
              </span>
            ))}
          </div>
          <Sparkline
            values={dailyHours}
            height={72}
            width={720}
            labels={DAY_LABELS}
            todayIndex={inCurrentWeek ? daysIn : undefined}
            className="hero-spark__svg"
          />
        </div>

        <div className="hero-divider" aria-hidden />

        {/* Stat rail */}
        <div className="hero-rail">
          <StatCell
            label="TIL bank"
            value={openingTil}
            delta={tilDelta}
            unit="h"
            href="/me/til"
          />
          <StatCell
            label="Vacation"
            value={openingVacation}
            delta={vacationDelta}
            unit="h"
            href="/me/vacation"
          />
          <StatCell
            label="Validation"
            value={validationIssues}
            unit={validationIssues === 1 ? ' issue' : ' issues'}
            decimals={0}
            tone={validationIssues === 0 ? 'ok' : 'warn'}
          />
        </div>

        {/* Draft ribbon — a soft prompt when the week is still editable */}
        {isDraft ? (
          <div className="hero-ribbon">
            <span className="hero-ribbon__dot" />
            You're editing a draft — nothing here is visible to admins yet.
          </div>
        ) : null}
      </div>

      <HeroStyles />
    </section>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  delta?: number | null;
  unit?: string;
  decimals?: number;
  tone?: 'ok' | 'warn';
  href?: string;
}

function StatCell({
  label,
  value,
  delta = null,
  unit = '',
  decimals = 1,
  tone,
  href,
}: StatCellProps) {
  const d = friendlyDelta(delta, decimals);
  const DIcon = d.icon;
  const dTone =
    delta === null || Math.abs(delta) < 0.05
      ? 'text-white/40'
      : delta > 0
      ? 'text-emerald-300'
      : 'text-rose-300';

  const body = (
    <div className="stat-cell">
      <div className="stat-cell__label">
        <span>{label}</span>
        {href ? <ArrowUpRight className="stat-cell__arrow" aria-hidden /> : null}
      </div>
      <div className="stat-cell__value">
        <NumberTicker value={value} decimals={decimals} />
        <span className="stat-cell__unit">{unit}</span>
        {tone === 'ok' ? (
          <span className="stat-cell__badge stat-cell__badge--ok">clean</span>
        ) : tone === 'warn' ? (
          <span className="stat-cell__badge stat-cell__badge--warn">fix these</span>
        ) : null}
      </div>
      {delta !== null && !Number.isNaN(delta) ? (
        <div className={`stat-cell__delta ${dTone}`}>
          <DIcon className="h-3 w-3" aria-hidden />
          <span>
            {d.sign}
            {d.abs}
            {unit}
          </span>
          <span className="stat-cell__delta-label">this week</span>
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="stat-cell__link">
        {body}
      </Link>
    );
  }
  return body;
}

function HeroStyles() {
  return (
    <style>{`
      .hero-wrap {
        --hero-accent: #7cd4ff;
        --hero-warm: #ff9a6b;
        position: relative;
        margin: 24px 0 20px;
        padding: 0 4px;
      }

      .hero-card {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        padding: 28px 30px 24px;
        background:
          radial-gradient(1200px 400px at 10% -20%, rgba(255,154,107,0.15), transparent 60%),
          radial-gradient(900px 500px at 100% 120%, rgba(124,212,255,0.14), transparent 55%),
          linear-gradient(180deg, #0f1218 0%, #0a0c12 100%);
        color: #ecedf1;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.04) inset,
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 30px 80px -30px rgba(0,0,0,0.7);
      }
      .hero-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        background: conic-gradient(
          from 210deg at 50% 50%,
          rgba(124,212,255,0.35),
          rgba(255,154,107,0.18) 20%,
          transparent 30%,
          transparent 70%,
          rgba(124,212,255,0.28) 90%
        );
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
                mask-composite: exclude;
        pointer-events: none;
        opacity: 0.55;
      }

      /* Force dark surface even in light theme — the hero owns its palette. */
      :where(html:not(.dark)) .hero-card { color: #ecedf1; }

      .hero-grid {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .hero-glow {
        position: absolute;
        filter: blur(60px);
        opacity: 0.55;
        pointer-events: none;
        border-radius: 999px;
      }
      .hero-glow--warm {
        width: 320px; height: 320px;
        left: -80px; top: -140px;
        background: radial-gradient(circle, rgba(255,154,107,0.55) 0%, transparent 70%);
        animation: heroDrift 18s ease-in-out infinite alternate;
      }
      .hero-glow--cool {
        width: 380px; height: 380px;
        right: -120px; bottom: -180px;
        background: radial-gradient(circle, rgba(124,212,255,0.45) 0%, transparent 70%);
        animation: heroDrift 22s ease-in-out -6s infinite alternate;
      }
      @keyframes heroDrift {
        0%   { transform: translate(0, 0) scale(1); }
        100% { transform: translate(30px, -20px) scale(1.08); }
      }
      @media (prefers-reduced-motion: reduce) {
        .hero-glow { animation: none; }
      }

      .hero-meta {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .hero-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 11px;
        letter-spacing: 0.14em;
        color: rgba(236,237,241,0.55);
        text-transform: uppercase;
      }
      .hero-eyebrow__num {
        color: rgba(236,237,241,0.85);
        font-weight: 600;
      }
      .hero-eyebrow__sep {
        opacity: 0.4;
      }
      .hero-meta__right {
        display: inline-flex;
        align-items: center;
        gap: 14px;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 12px 5px 10px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.01em;
        border-radius: 999px;
        background: rgba(255,255,255,0.04);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
        --pulse-color: currentColor;
      }
      .status-pill.ring-amber-400\\/25 { --pulse-color: rgb(251 191 36); }
      .status-pill.ring-sky-400\\/25 { --pulse-color: rgb(56 189 248); }
      .status-pill.ring-emerald-400\\/25 { --pulse-color: rgb(52 211 153); }
      .status-pill.ring-rose-400\\/25 { --pulse-color: rgb(251 113 133); }
      .status-pill__dot {
        width: 6px; height: 6px; border-radius: 999px;
        box-shadow: 0 0 8px currentColor;
      }
      .status-pill--pulse .status-pill__dot {
        animation: heroPulse 1.9s ease-in-out infinite;
      }
      @keyframes heroPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.4); }
      }
      @media (prefers-reduced-motion: reduce) {
        .status-pill--pulse .status-pill__dot { animation: none; }
      }

      .hero-report-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: rgba(236,237,241,0.65);
        transition: color 180ms ease;
      }
      .hero-report-link:hover { color: rgba(236,237,241,1); }

      .hero-headline {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .hero-headline__number {
        font-family: var(--font-sans, Inter, system-ui, sans-serif);
        font-size: clamp(56px, 9vw, 96px);
        line-height: 0.95;
        letter-spacing: -0.035em;
        font-weight: 600;
        color: #f4f5f8;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        margin: 0;
        text-shadow: 0 0 40px rgba(124,212,255,0.12);
      }
      .hero-headline__unit {
        font-size: clamp(20px, 2.6vw, 34px);
        color: rgba(236,237,241,0.4);
        font-weight: 500;
        letter-spacing: -0.02em;
      }
      .hero-headline__side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        padding-bottom: 8px;
      }
      .hero-delta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: rgba(236,237,241,0.7);
      }
      .hero-delta__value { font-variant-numeric: tabular-nums; color: #ecedf1; font-weight: 500; }
      .hero-delta__label { color: rgba(236,237,241,0.4); }
      .hero-caption {
        font-size: 11px;
        color: rgba(236,237,241,0.4);
        letter-spacing: 0.01em;
      }

      .hero-spark {
        margin: 6px 0 20px;
      }
      .hero-spark__labels {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        margin-bottom: 6px;
      }
      .hero-spark__label {
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10px;
        letter-spacing: 0.1em;
        color: rgba(236,237,241,0.35);
        text-transform: uppercase;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .hero-spark__label--today {
        color: var(--hero-accent);
        text-shadow: 0 0 12px rgba(124,212,255,0.4);
      }
      .hero-spark__label-num {
        font-size: 10.5px;
        color: rgba(236,237,241,0.55);
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
      }
      .hero-spark__label--today .hero-spark__label-num {
        color: rgba(236,237,241,0.9);
      }
      .hero-spark__svg {
        width: 100%;
        height: 60px;
        color: rgba(236,237,241,0.35);
        display: block;
      }

      .hero-divider {
        height: 1px;
        background: linear-gradient(90deg,
          transparent 0%,
          rgba(255,255,255,0.08) 20%,
          rgba(255,255,255,0.08) 80%,
          transparent 100%);
        margin: 4px -6px 18px;
      }

      .hero-rail {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      @media (max-width: 640px) {
        .hero-rail { grid-template-columns: 1fr; }
      }

      .stat-cell {
        padding: 10px 14px 12px;
        border-radius: 12px;
        transition: background 200ms ease, transform 200ms ease;
        position: relative;
      }
      .stat-cell__link { display: block; }
      .stat-cell__link:hover .stat-cell {
        background: rgba(255,255,255,0.03);
      }
      .stat-cell__link:hover .stat-cell__arrow { opacity: 1; transform: translate(0, 0); }
      .stat-cell__label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(236,237,241,0.45);
        margin-bottom: 4px;
      }
      .stat-cell__arrow {
        width: 12px; height: 12px;
        opacity: 0;
        transform: translate(-2px, 2px);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .stat-cell__value {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        font-family: var(--font-sans, Inter, system-ui, sans-serif);
        font-size: 26px;
        font-weight: 500;
        color: #f4f5f8;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.01em;
      }
      .stat-cell__unit {
        font-size: 13px;
        color: rgba(236,237,241,0.4);
        font-weight: 400;
      }
      .stat-cell__badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        margin-left: 8px;
        letter-spacing: 0.03em;
      }
      .stat-cell__badge--ok {
        color: rgb(110 231 183);
        background: rgba(16, 185, 129, 0.1);
        box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.15);
      }
      .stat-cell__badge--warn {
        color: rgb(253 186 116);
        background: rgba(249, 115, 22, 0.1);
        box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.18);
      }
      .stat-cell__delta {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        margin-top: 4px;
        font-variant-numeric: tabular-nums;
      }
      .stat-cell__delta-label {
        color: rgba(236,237,241,0.35);
        margin-left: 2px;
      }

      .hero-ribbon {
        position: relative;
        margin: 16px -6px -4px;
        padding: 8px 14px;
        border-radius: 10px;
        background: rgba(251, 191, 36, 0.06);
        box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.15);
        color: rgba(253, 224, 168, 0.9);
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .hero-ribbon__dot {
        width: 5px; height: 5px; border-radius: 999px;
        background: rgb(251 191 36);
        box-shadow: 0 0 10px rgb(251 191 36);
      }
    `}</style>
  );
}
