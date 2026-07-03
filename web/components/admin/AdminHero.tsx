// Linear-style admin home hero.
//
// Foregrounds "how much is waiting for me" with a big pending-review count,
// deltas from the last 7 days, and a live-updating feel via number tickers.
// The approval queue and all-weeks table stay below unchanged.

import { CheckCircle2, Clock4, FileDown, XCircle } from 'lucide-react';
import { DotPattern } from '@/components/ui/dot-pattern';
import { NumberTicker } from '@/components/ui/number-ticker';

interface AdminHeroProps {
  pending: number;
  approved7d: number;
  declined7d: number;
  imported7d: number;
  oldestSubmittedISO?: string | null;
}

function timeSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'less than a minute ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function AdminHero({
  pending,
  approved7d,
  declined7d,
  imported7d,
  oldestSubmittedISO,
}: AdminHeroProps) {
  const oldestLabel = timeSince(oldestSubmittedISO);
  const nothingToReview = pending === 0;
  const tone = nothingToReview ? 'emerald' : pending > 5 ? 'amber' : 'cyan';

  return (
    <section className={`ah-wrap ah-wrap--${tone}`}>
      <div className="ah-card">
        <DotPattern className="ah-grid text-white/[0.08]" size={22} radius={1} />
        <div className="ah-blob ah-blob--warm" aria-hidden />
        <div className="ah-blob ah-blob--cool" aria-hidden />

        <header className="ah-eyebrow">ADMIN · APPROVAL QUEUE · UPDATED LIVE</header>

        <div className="ah-headline">
          <div>
            <div className="ah-title">
              {nothingToReview ? 'Queue is empty' : pending === 1 ? 'One week waiting for review' : 'Weeks waiting for review'}
            </div>
            <h1 className="ah-number">
              <NumberTicker value={pending} decimals={0} />
              <span className="ah-unit">{pending === 1 ? 'week' : 'weeks'}</span>
            </h1>
            {oldestLabel ? (
              <div className="ah-caption">Oldest submitted {oldestLabel}</div>
            ) : nothingToReview ? (
              <div className="ah-caption">Nothing pending — everyone's up to date.</div>
            ) : null}
          </div>

          <div className="ah-chips">
            <ChipStat icon={CheckCircle2} label="Approved" value={approved7d} tone="ok" />
            <ChipStat icon={XCircle} label="Declined" value={declined7d} tone="warn" />
            <ChipStat icon={FileDown} label="Imported" value={imported7d} tone="muted" />
            <div className="ah-chips__label">last 7 days</div>
          </div>
        </div>

        <div className="ah-divider" aria-hidden />

        <div className="ah-rail">
          <RailStat
            icon={Clock4}
            label="Pending review"
            value={pending}
            tone={pending > 0 ? 'warn' : 'ok'}
          />
          <RailStat
            icon={CheckCircle2}
            label="Approved (7d)"
            value={approved7d}
            tone="ok"
          />
          <RailStat
            icon={XCircle}
            label="Declined (7d)"
            value={declined7d}
            tone={declined7d > 0 ? 'warn' : 'muted'}
          />
          <RailStat
            icon={FileDown}
            label="Imported (7d)"
            value={imported7d}
            tone="muted"
          />
        </div>
      </div>

      <AdminHeroStyles />
    </section>
  );
}

interface ChipStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'muted';
}

function ChipStat({ icon: Icon, label, value, tone }: ChipStatProps) {
  return (
    <div className={`ah-chip ah-chip--${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <NumberTicker value={value} decimals={0} className="ah-chip__value" />
      <span className="ah-chip__label">{label}</span>
    </div>
  );
}

interface RailStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'muted';
}

function RailStat({ icon: Icon, label, value, tone }: RailStatProps) {
  return (
    <div className={`ah-rail__cell ah-rail__cell--${tone}`}>
      <div className="ah-rail__label">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="ah-rail__value">
        <NumberTicker value={value} decimals={0} />
      </div>
    </div>
  );
}

function AdminHeroStyles() {
  return (
    <style>{`
      .ah-wrap {
        --ah-accent: #7cd4ff;
        --ah-warm: #ff9a6b;
        --ah-gradient: rgba(124,212,255,0.45);
        --ah-glow: rgba(124,212,255,0.12);
        position: relative;
        margin: 0 0 20px;
      }
      .ah-wrap--emerald {
        --ah-accent: #7fe6b0;
        --ah-warm: #a3ff9a;
        --ah-gradient: rgba(127,230,176,0.45);
        --ah-glow: rgba(127,230,176,0.12);
      }
      .ah-wrap--amber {
        --ah-accent: #ffbe6b;
        --ah-warm: #ff7a5e;
        --ah-gradient: rgba(255,190,107,0.45);
        --ah-glow: rgba(255,190,107,0.12);
      }

      .ah-card {
        position: relative; overflow: hidden; border-radius: 22px;
        padding: 26px 30px 22px;
        background:
          radial-gradient(1000px 380px at 8% -20%, color-mix(in oklch, var(--ah-warm) 24%, transparent), transparent 60%),
          radial-gradient(900px 460px at 100% 120%, color-mix(in oklch, var(--ah-gradient) 32%, transparent), transparent 55%),
          linear-gradient(180deg, #0f1218 0%, #0a0c12 100%);
        color: #ecedf1;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.04) inset,
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 30px 80px -30px rgba(0,0,0,0.7);
      }
      .ah-card::before {
        content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
        background: conic-gradient(from 210deg at 50% 50%,
          color-mix(in oklch, var(--ah-accent) 35%, transparent),
          color-mix(in oklch, var(--ah-warm) 18%, transparent) 20%,
          transparent 30%, transparent 70%,
          color-mix(in oklch, var(--ah-accent) 28%, transparent) 90%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        pointer-events: none; opacity: 0.55;
      }
      :where(html:not(.dark)) .ah-card { color: #ecedf1; }

      .ah-grid { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
      .ah-blob { position: absolute; filter: blur(60px); opacity: 0.55; pointer-events: none; border-radius: 999px; }
      .ah-blob--warm {
        width: 300px; height: 300px; left: -80px; top: -140px;
        background: radial-gradient(circle, color-mix(in oklch, var(--ah-warm) 55%, transparent) 0%, transparent 70%);
        animation: ahDrift 22s ease-in-out infinite alternate;
      }
      .ah-blob--cool {
        width: 380px; height: 380px; right: -120px; bottom: -180px;
        background: radial-gradient(circle, var(--ah-gradient) 0%, transparent 70%);
        animation: ahDrift 26s ease-in-out -6s infinite alternate;
      }
      @keyframes ahDrift { 0% { transform: translate(0,0) scale(1);} 100% { transform: translate(24px,-18px) scale(1.06);} }
      @media (prefers-reduced-motion: reduce) { .ah-blob { animation: none; } }

      .ah-eyebrow {
        position: relative;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 11px; letter-spacing: 0.16em;
        color: rgba(236,237,241,0.55); text-transform: uppercase;
        margin-bottom: 18px;
      }

      .ah-headline {
        position: relative;
        display: flex; justify-content: space-between;
        align-items: flex-end; gap: 24px; flex-wrap: wrap;
        margin-bottom: 24px;
      }
      .ah-title { font-size: 13px; color: rgba(236,237,241,0.65); margin-bottom: 4px; }
      .ah-number {
        margin: 0;
        font-size: clamp(52px, 9vw, 96px);
        line-height: 0.95;
        letter-spacing: -0.035em;
        font-weight: 600;
        color: #f4f5f8;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        text-shadow: 0 0 40px var(--ah-glow);
      }
      .ah-unit {
        font-size: clamp(18px, 2vw, 28px);
        color: rgba(236,237,241,0.4);
        font-weight: 500;
        letter-spacing: -0.02em;
      }
      .ah-caption { font-size: 12px; color: rgba(236,237,241,0.5); margin-top: 6px; }

      .ah-chips {
        display: flex; flex-direction: column;
        align-items: flex-end; gap: 6px;
        padding-bottom: 4px;
      }
      .ah-chips__label {
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10px; letter-spacing: 0.14em;
        color: rgba(236,237,241,0.35);
        text-transform: uppercase;
      }
      .ah-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 10px 5px 8px;
        border-radius: 999px;
        font-size: 12px;
        background: rgba(255,255,255,0.04);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
      }
      .ah-chip__value { font-variant-numeric: tabular-nums; font-weight: 600; }
      .ah-chip__label { color: rgba(236,237,241,0.55); }
      .ah-chip--ok { color: rgb(110 231 183); }
      .ah-chip--warn { color: rgb(251 146 146); }
      .ah-chip--muted { color: rgba(236,237,241,0.55); }

      .ah-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent);
        margin: 4px -6px 16px;
      }

      .ah-rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      @media (max-width: 640px) { .ah-rail { grid-template-columns: repeat(2, 1fr); } }

      .ah-rail__cell { padding: 10px 14px 12px; border-radius: 12px; }
      .ah-rail__label {
        display: inline-flex; align-items: center; gap: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: rgba(236,237,241,0.45); margin-bottom: 4px;
      }
      .ah-rail__value {
        font-size: 26px; font-weight: 500;
        color: #f4f5f8; font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
      }
      .ah-rail__cell--ok .ah-rail__label { color: rgb(110 231 183); }
      .ah-rail__cell--warn .ah-rail__label { color: rgb(251 191 36); }
      .ah-rail__cell--muted .ah-rail__label { color: rgba(236,237,241,0.45); }
    `}</style>
  );
}
