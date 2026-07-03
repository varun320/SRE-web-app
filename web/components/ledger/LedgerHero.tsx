// Reusable Linear-style hero for the ledger pages (/me/til, /me/vacation, and
// eventually /expenses/balance). Same visual language as the WeekHero card:
// dark canvas with warm+cool aurora blobs, dot-grid fade, thin conic border,
// big tabular numeric with animated ticker, trend chart across the last N
// buckets, and a stat rail.

import Link from 'next/link';
import { ArrowUpRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { DotPattern } from '@/components/ui/dot-pattern';
import { NumberTicker } from '@/components/ui/number-ticker';
import { TrendChart } from '@/components/ui/trend-chart';

export type LedgerHeroTone = 'cyan' | 'amber' | 'emerald' | 'rose';

export interface LedgerStat {
  label: string;
  value: number;
  unit?: string;
  decimals?: number;
  href?: string;
  hint?: string;
}

interface LedgerHeroProps {
  eyebrow: string;
  title: string;
  balance: number;
  unit?: string;
  decimals?: number;
  balanceLabel?: string;
  balanceSuffix?: string;
  tone?: LedgerHeroTone;
  bars: number[];
  line?: number[];
  labels: string[];
  emphasize?: number;
  delta?: {
    value: number;
    unit?: string;
    label: string;
  };
  stats: LedgerStat[];
  ribbon?: {
    tone: 'warn' | 'ok' | 'info';
    text: string;
  };
}

const TONE_MAP: Record<LedgerHeroTone, { accent: string; warm: string; gradient: string; glow: string }> = {
  cyan: {
    accent: '#7cd4ff',
    warm: '#ff9a6b',
    gradient: 'rgba(124,212,255,0.45)',
    glow: 'rgba(124,212,255,0.12)',
  },
  amber: {
    accent: '#ffbe6b',
    warm: '#ff7a5e',
    gradient: 'rgba(255,190,107,0.45)',
    glow: 'rgba(255,190,107,0.12)',
  },
  emerald: {
    accent: '#7fe6b0',
    warm: '#a3ff9a',
    gradient: 'rgba(127,230,176,0.45)',
    glow: 'rgba(127,230,176,0.12)',
  },
  rose: {
    accent: '#ff8fa3',
    warm: '#ffb27a',
    gradient: 'rgba(255,143,163,0.45)',
    glow: 'rgba(255,143,163,0.12)',
  },
};

function friendlyDelta(delta: number, decimals: number) {
  if (Math.abs(delta) < 0.05) return { icon: Minus, sign: '±', abs: '0' };
  const icon = delta > 0 ? TrendingUp : TrendingDown;
  const sign = delta > 0 ? '+' : '−';
  return { icon, sign, abs: Math.abs(delta).toFixed(decimals) };
}

export function LedgerHero({
  eyebrow,
  title,
  balance,
  unit = 'h',
  decimals = 2,
  balanceLabel,
  balanceSuffix,
  tone = 'cyan',
  bars,
  line,
  labels,
  emphasize,
  delta,
  stats,
  ribbon,
}: LedgerHeroProps) {
  const toneVars = TONE_MAP[tone];

  return (
    <section
      className="ledger-hero-wrap"
      style={
        {
          '--hero-accent': toneVars.accent,
          '--hero-warm': toneVars.warm,
          '--hero-gradient': toneVars.gradient,
          '--hero-glow': toneVars.glow,
        } as React.CSSProperties
      }
    >
      <div className="lh-card">
        <DotPattern
          className="lh-grid text-white/[0.08]"
          size={22}
          radius={1}
        />
        <div className="lh-blob lh-blob--warm" aria-hidden />
        <div className="lh-blob lh-blob--cool" aria-hidden />

        <header className="lh-eyebrow">{eyebrow}</header>

        <div className="lh-headline">
          <div>
            <div className="lh-title">{title}</div>
            <h1 className="lh-number" aria-label={`${balance.toFixed(decimals)} ${unit}`}>
              <NumberTicker value={balance} decimals={decimals} />
              <span className="lh-unit">{unit}</span>
              {balanceSuffix ? <span className="lh-suffix">{balanceSuffix}</span> : null}
            </h1>
            {balanceLabel ? <div className="lh-caption">{balanceLabel}</div> : null}
          </div>
          {delta ? <DeltaChip delta={delta} /> : null}
        </div>

        <div className="lh-chart">
          <div className="lh-chart__labels">
            {labels.map((l, i) => (
              <span
                key={`${l}-${i}`}
                className={`lh-chart__label ${emphasize === i ? 'lh-chart__label--now' : ''}`}
              >
                {l}
              </span>
            ))}
          </div>
          <TrendChart
            bars={bars}
            line={line}
            labels={labels}
            height={110}
            width={720}
            className="lh-chart__svg"
          />
        </div>

        <div className="lh-divider" aria-hidden />

        <div className="lh-rail" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map((s) => (
            <StatCell key={s.label} stat={s} />
          ))}
        </div>

        {ribbon ? (
          <div className={`lh-ribbon lh-ribbon--${ribbon.tone}`}>
            <span className="lh-ribbon__dot" />
            {ribbon.text}
          </div>
        ) : null}
      </div>

      <LedgerHeroStyles />
    </section>
  );
}

function DeltaChip({
  delta,
}: {
  delta: { value: number; unit?: string; label: string };
}) {
  const d = friendlyDelta(delta.value, delta.unit ? 1 : 0);
  const Icon = d.icon;
  const tone =
    Math.abs(delta.value) < 0.05
      ? 'lh-delta--neutral'
      : delta.value > 0
      ? 'lh-delta--up'
      : 'lh-delta--down';
  return (
    <div className={`lh-delta ${tone}`}>
      <Icon className="h-4 w-4" aria-hidden />
      <span className="lh-delta__value">
        {d.sign}
        {d.abs}
        {delta.unit ?? ''}
      </span>
      <span className="lh-delta__label">{delta.label}</span>
    </div>
  );
}

function StatCell({ stat }: { stat: LedgerStat }) {
  const body = (
    <div className="lh-stat">
      <div className="lh-stat__label">
        <span>{stat.label}</span>
        {stat.href ? <ArrowUpRight className="lh-stat__arrow" aria-hidden /> : null}
      </div>
      <div className="lh-stat__value">
        <NumberTicker value={stat.value} decimals={stat.decimals ?? 1} />
        {stat.unit ? <span className="lh-stat__unit">{stat.unit}</span> : null}
      </div>
      {stat.hint ? <div className="lh-stat__hint">{stat.hint}</div> : null}
    </div>
  );
  return stat.href ? (
    <Link href={stat.href} className="lh-stat__link">
      {body}
    </Link>
  ) : (
    body
  );
}

function LedgerHeroStyles() {
  return (
    <style>{`
      .ledger-hero-wrap {
        position: relative;
        margin: 0 0 20px;
      }
      .lh-card {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        padding: 26px 30px 22px;
        background:
          radial-gradient(1000px 380px at 8% -20%, color-mix(in oklch, var(--hero-warm) 24%, transparent), transparent 60%),
          radial-gradient(900px 460px at 100% 120%, color-mix(in oklch, var(--hero-gradient) 32%, transparent), transparent 55%),
          linear-gradient(180deg, #0f1218 0%, #0a0c12 100%);
        color: #ecedf1;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.04) inset,
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 30px 80px -30px rgba(0,0,0,0.7);
      }
      .lh-card::before {
        content: '';
        position: absolute; inset: 0; border-radius: inherit; padding: 1px;
        background: conic-gradient(
          from 210deg at 50% 50%,
          color-mix(in oklch, var(--hero-accent) 35%, transparent),
          color-mix(in oklch, var(--hero-warm) 18%, transparent) 20%,
          transparent 30%, transparent 70%,
          color-mix(in oklch, var(--hero-accent) 28%, transparent) 90%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        pointer-events: none; opacity: 0.55;
      }

      :where(html:not(.dark)) .lh-card { color: #ecedf1; }

      .lh-grid {
        position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
      }
      .lh-blob {
        position: absolute; filter: blur(60px); opacity: 0.55;
        pointer-events: none; border-radius: 999px;
      }
      .lh-blob--warm {
        width: 300px; height: 300px; left: -80px; top: -140px;
        background: radial-gradient(circle, color-mix(in oklch, var(--hero-warm) 55%, transparent) 0%, transparent 70%);
        animation: lhDrift 20s ease-in-out infinite alternate;
      }
      .lh-blob--cool {
        width: 380px; height: 380px; right: -120px; bottom: -180px;
        background: radial-gradient(circle, var(--hero-gradient) 0%, transparent 70%);
        animation: lhDrift 24s ease-in-out -6s infinite alternate;
      }
      @keyframes lhDrift {
        0%   { transform: translate(0, 0) scale(1); }
        100% { transform: translate(24px, -18px) scale(1.06); }
      }
      @media (prefers-reduced-motion: reduce) { .lh-blob { animation: none; } }

      .lh-eyebrow {
        position: relative;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 11px;
        letter-spacing: 0.16em;
        color: rgba(236,237,241,0.55);
        text-transform: uppercase;
        margin-bottom: 18px;
      }

      .lh-headline {
        position: relative;
        display: flex; justify-content: space-between;
        align-items: flex-end; gap: 24px; flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .lh-title {
        font-size: 13px; color: rgba(236,237,241,0.65);
        margin-bottom: 4px; letter-spacing: -0.005em;
      }
      .lh-number {
        margin: 0;
        font-size: clamp(48px, 8vw, 84px);
        line-height: 0.95;
        letter-spacing: -0.035em;
        font-weight: 600;
        color: #f4f5f8;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        text-shadow: 0 0 40px var(--hero-glow);
      }
      .lh-unit {
        font-size: clamp(18px, 2vw, 28px);
        color: rgba(236,237,241,0.4);
        font-weight: 500;
        letter-spacing: -0.02em;
      }
      .lh-suffix {
        font-size: clamp(14px, 1.4vw, 20px);
        color: rgba(236,237,241,0.4);
        font-weight: 400;
        margin-left: 4px;
      }
      .lh-caption {
        font-size: 11px; color: rgba(236,237,241,0.4);
        margin-top: 6px;
      }

      .lh-delta {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 12px;
        border-radius: 999px;
        font-size: 12px;
        background: rgba(255,255,255,0.04);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
      }
      .lh-delta--up { color: rgb(110 231 183); }
      .lh-delta--down { color: rgb(251 146 146); }
      .lh-delta--neutral { color: rgba(236,237,241,0.55); }
      .lh-delta__value { font-variant-numeric: tabular-nums; font-weight: 600; }
      .lh-delta__label { color: rgba(236,237,241,0.45); }

      .lh-chart { margin-bottom: 16px; }
      .lh-chart__labels {
        display: grid;
        grid-auto-columns: 1fr;
        grid-auto-flow: column;
        margin-bottom: 6px;
      }
      .lh-chart__label {
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 9.5px;
        letter-spacing: 0.1em;
        color: rgba(236,237,241,0.32);
        text-transform: uppercase;
        text-align: center;
      }
      .lh-chart__label--now {
        color: var(--hero-accent);
        text-shadow: 0 0 12px var(--hero-glow);
      }
      .lh-chart__svg { width: 100%; height: 96px; display: block; }

      .lh-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent);
        margin: 4px -6px 16px;
      }

      .lh-rail { display: grid; gap: 8px; }
      @media (max-width: 640px) { .lh-rail { grid-template-columns: 1fr !important; } }

      .lh-stat { padding: 10px 14px 12px; border-radius: 12px; transition: background 200ms ease; position: relative; }
      .lh-stat__link { display: block; }
      .lh-stat__link:hover .lh-stat { background: rgba(255,255,255,0.03); }
      .lh-stat__link:hover .lh-stat__arrow { opacity: 1; transform: translate(0,0); }
      .lh-stat__label {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: rgba(236,237,241,0.45); margin-bottom: 4px;
      }
      .lh-stat__arrow {
        width: 12px; height: 12px; opacity: 0;
        transform: translate(-2px, 2px);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .lh-stat__value {
        display: inline-flex; align-items: baseline; gap: 4px;
        font-size: 26px; font-weight: 500; color: #f4f5f8;
        font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
      }
      .lh-stat__unit { font-size: 13px; color: rgba(236,237,241,0.4); font-weight: 400; }
      .lh-stat__hint { font-size: 11px; color: rgba(236,237,241,0.4); margin-top: 3px; }

      .lh-ribbon {
        position: relative;
        margin: 14px -6px -2px;
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .lh-ribbon--warn {
        background: rgba(251, 191, 36, 0.06);
        box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.15);
        color: rgba(253, 224, 168, 0.9);
      }
      .lh-ribbon--warn .lh-ribbon__dot { background: rgb(251 191 36); box-shadow: 0 0 10px rgb(251 191 36); }
      .lh-ribbon--info {
        background: rgba(56, 189, 248, 0.06);
        box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.15);
        color: rgba(186, 230, 253, 0.9);
      }
      .lh-ribbon--info .lh-ribbon__dot { background: rgb(56 189 248); box-shadow: 0 0 10px rgb(56 189 248); }
      .lh-ribbon--ok {
        background: rgba(16, 185, 129, 0.06);
        box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.15);
        color: rgba(167, 243, 208, 0.9);
      }
      .lh-ribbon--ok .lh-ribbon__dot { background: rgb(16 185 129); box-shadow: 0 0 10px rgb(16 185 129); }
      .lh-ribbon__dot { width: 5px; height: 5px; border-radius: 999px; }
    `}</style>
  );
}
