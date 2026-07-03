// Money-focused Linear-style hero for /expenses/balance.
//
// Shape:
//   - Big total-owing headline ($X,XXX.XX) — rose when owing, emerald when
//     settled. Tabular-nums, animated ticker.
//   - Horizontal stack of each outstanding invoice as a mini-bar (outstanding
//     bottom, interest stacked on top). Hover shows the invoice number.
//   - Stat rail: total submitted, received, outstanding, interest.
//   - Ribbon warns when there is interest accruing.

import Link from 'next/link';
import { ArrowUpRight, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { DotPattern } from '@/components/ui/dot-pattern';
import { NumberTicker } from '@/components/ui/number-ticker';

export interface BalanceInvoice {
  invoice_no: string;
  outstanding: number;
  interest_owing: number;
  status: string;
  days_overdue: number;
}

interface BalanceHeroProps {
  totalOwing: number;
  totalSubmitted: number;
  totalReceived: number;
  totalOutstanding: number;
  totalInterest: number;
  invoices: BalanceInvoice[];
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  });
}

export function BalanceHero({
  totalOwing,
  totalSubmitted,
  totalReceived,
  totalOutstanding,
  totalInterest,
  invoices,
}: BalanceHeroProps) {
  const settled = totalOwing < 0.01;
  const tone = settled ? 'emerald' : totalInterest > 0.01 ? 'rose' : 'amber';

  const outstandingInvoices = invoices
    .filter((i) => i.outstanding + i.interest_owing > 0.01)
    .sort((a, b) => b.outstanding + b.interest_owing - (a.outstanding + a.interest_owing))
    .slice(0, 8);

  const maxOwing = Math.max(
    0.01,
    ...outstandingInvoices.map((i) => i.outstanding + i.interest_owing),
  );

  return (
    <section className={`bh-wrap bh-wrap--${tone}`}>
      <div className="bh-card">
        <DotPattern className="bh-grid text-white/[0.08]" size={22} radius={1} />
        <div className="bh-blob bh-blob--warm" aria-hidden />
        <div className="bh-blob bh-blob--cool" aria-hidden />

        <header className="bh-eyebrow">
          BALANCE · EXPENSES · CAD · UPDATED LIVE
        </header>

        <div className="bh-headline">
          <div>
            <div className="bh-title">
              {settled ? 'All settled — nothing owed to you' : 'Total owing to you'}
            </div>
            <h1 className="bh-number">
              <span className="bh-prefix">$</span>
              <NumberTicker value={totalOwing} decimals={2} />
              <span className="bh-currency">CAD</span>
            </h1>
            {!settled && totalInterest > 0.01 ? (
              <div className="bh-caption">
                Of which{' '}
                <span className="bh-caption__num">{fmtMoney(totalInterest)}</span>{' '}
                is interest accruing at Net-30.
              </div>
            ) : null}
          </div>

          {!settled ? (
            <div className="bh-hint">
              <Info className="h-4 w-4" aria-hidden />
              <div>
                <div className="bh-hint__title">Net-30 terms</div>
                <div className="bh-hint__body">
                  Interest = unpaid × (days overdue / 365) × APR. Any payment
                  stops the clock.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {outstandingInvoices.length > 0 ? (
          <div className="bh-strip">
            <div className="bh-strip__label">
              <span>Outstanding by invoice</span>
              <span className="bh-strip__count">
                {outstandingInvoices.length} invoice
                {outstandingInvoices.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="bh-strip__bars">
              {outstandingInvoices.map((inv) => {
                const total = inv.outstanding + inv.interest_owing;
                const totalPct = (total / maxOwing) * 100;
                const interestPct = total > 0 ? (inv.interest_owing / total) * 100 : 0;
                return (
                  <Link
                    key={inv.invoice_no}
                    href={`/expenses/${encodeURIComponent(inv.invoice_no)}`}
                    className="bh-bar"
                    title={`${inv.invoice_no} — ${fmtMoney(total)} total owing (${
                      inv.days_overdue > 0 ? `${inv.days_overdue}d overdue` : 'not overdue'
                    })`}
                  >
                    <div className="bh-bar__stack" style={{ height: `${totalPct}%` }}>
                      <div
                        className="bh-bar__interest"
                        style={{ height: `${interestPct}%` }}
                      />
                      <div
                        className="bh-bar__outstanding"
                        style={{ height: `${100 - interestPct}%` }}
                      />
                    </div>
                    <div className="bh-bar__label">
                      {inv.invoice_no.replace(/^UC/, '').slice(-6)}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="bh-legend">
              <span className="bh-legend__item">
                <span className="bh-legend__swatch bh-legend__swatch--out" />
                Outstanding
              </span>
              <span className="bh-legend__item">
                <span className="bh-legend__swatch bh-legend__swatch--int" />
                Interest
              </span>
            </div>
          </div>
        ) : null}

        <div className="bh-divider" aria-hidden />

        <div className="bh-rail">
          <BhStat
            label="Submitted"
            icon={TrendingUp}
            value={totalSubmitted}
          />
          <BhStat
            label="Received"
            icon={TrendingDown}
            value={totalReceived}
            tone="ok"
          />
          <BhStat label="Outstanding" value={totalOutstanding} />
          <BhStat
            label="Interest"
            value={totalInterest}
            tone={totalInterest > 0.01 ? 'warn' : undefined}
          />
        </div>

        {!settled && totalInterest > 0.01 ? (
          <div className="bh-ribbon">
            <span className="bh-ribbon__dot" />
            Interest is accruing on one or more of your invoices. Ping your admin.
          </div>
        ) : settled ? (
          <div className="bh-ribbon bh-ribbon--ok">
            <span className="bh-ribbon__dot" />
            You're all paid up. Nice.
          </div>
        ) : null}
      </div>

      <BalanceHeroStyles />
    </section>
  );
}

interface BhStatProps {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'ok' | 'warn';
  hint?: string;
}

function BhStat({ label, value, tone, hint }: BhStatProps) {
  return (
    <div className={`bh-stat ${tone ? `bh-stat--${tone}` : ''}`}>
      <div className="bh-stat__label">{label}</div>
      <div className="bh-stat__value">
        <span className="bh-stat__prefix">$</span>
        <NumberTicker value={value} decimals={2} />
      </div>
      {hint ? <div className="bh-stat__hint">{hint}</div> : null}
    </div>
  );
}

function BalanceHeroStyles() {
  return (
    <style>{`
      .bh-wrap {
        --bh-accent: #ff8fa3;
        --bh-warm: #ff9a6b;
        --bh-gradient: rgba(255,143,163,0.45);
        --bh-glow: rgba(255,143,163,0.12);
        position: relative;
        margin: 0 0 20px;
      }
      .bh-wrap--emerald {
        --bh-accent: #7fe6b0;
        --bh-warm: #a3ff9a;
        --bh-gradient: rgba(127,230,176,0.45);
        --bh-glow: rgba(127,230,176,0.12);
      }
      .bh-wrap--amber {
        --bh-accent: #ffbe6b;
        --bh-warm: #ff9a6b;
        --bh-gradient: rgba(255,190,107,0.45);
        --bh-glow: rgba(255,190,107,0.12);
      }

      .bh-card {
        position: relative; overflow: hidden; border-radius: 22px;
        padding: 26px 30px 22px;
        background:
          radial-gradient(1000px 380px at 8% -20%, color-mix(in oklch, var(--bh-warm) 24%, transparent), transparent 60%),
          radial-gradient(900px 460px at 100% 120%, color-mix(in oklch, var(--bh-gradient) 32%, transparent), transparent 55%),
          linear-gradient(180deg, #0f1218 0%, #0a0c12 100%);
        color: #ecedf1;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.04) inset,
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 30px 80px -30px rgba(0,0,0,0.7);
      }
      .bh-card::before {
        content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
        background: conic-gradient(from 210deg at 50% 50%,
          color-mix(in oklch, var(--bh-accent) 35%, transparent),
          color-mix(in oklch, var(--bh-warm) 18%, transparent) 20%,
          transparent 30%, transparent 70%,
          color-mix(in oklch, var(--bh-accent) 28%, transparent) 90%);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        pointer-events: none; opacity: 0.55;
      }
      :where(html:not(.dark)) .bh-card { color: #ecedf1; }

      .bh-grid { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
      .bh-blob {
        position: absolute; filter: blur(60px); opacity: 0.55;
        pointer-events: none; border-radius: 999px;
      }
      .bh-blob--warm {
        width: 300px; height: 300px; left: -80px; top: -140px;
        background: radial-gradient(circle, color-mix(in oklch, var(--bh-warm) 55%, transparent) 0%, transparent 70%);
        animation: bhDrift 22s ease-in-out infinite alternate;
      }
      .bh-blob--cool {
        width: 380px; height: 380px; right: -120px; bottom: -180px;
        background: radial-gradient(circle, var(--bh-gradient) 0%, transparent 70%);
        animation: bhDrift 26s ease-in-out -6s infinite alternate;
      }
      @keyframes bhDrift { 0% { transform: translate(0,0) scale(1);} 100% { transform: translate(24px,-18px) scale(1.06);} }
      @media (prefers-reduced-motion: reduce) { .bh-blob { animation: none; } }

      .bh-eyebrow {
        position: relative;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 11px; letter-spacing: 0.16em;
        color: rgba(236,237,241,0.55); text-transform: uppercase;
        margin-bottom: 18px;
      }

      .bh-headline {
        position: relative;
        display: flex; justify-content: space-between;
        align-items: flex-start; gap: 24px; flex-wrap: wrap;
        margin-bottom: 24px;
      }
      .bh-title { font-size: 13px; color: rgba(236,237,241,0.65); margin-bottom: 4px; }
      .bh-number {
        margin: 0;
        font-size: clamp(44px, 8vw, 76px);
        line-height: 0.95;
        letter-spacing: -0.035em;
        font-weight: 600;
        color: #f4f5f8;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        text-shadow: 0 0 40px var(--bh-glow);
      }
      .bh-prefix { color: rgba(236,237,241,0.45); font-weight: 400; }
      .bh-currency {
        font-size: clamp(14px, 1.4vw, 20px);
        color: rgba(236,237,241,0.4);
        font-weight: 500;
        letter-spacing: 0.02em;
        margin-left: 6px;
      }
      .bh-caption { font-size: 12px; color: rgba(236,237,241,0.55); margin-top: 8px; }
      .bh-caption__num { color: #f4f5f8; font-weight: 500; font-variant-numeric: tabular-nums; }

      .bh-hint {
        display: inline-flex; align-items: flex-start; gap: 10px;
        max-width: 260px;
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(255,255,255,0.03);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
        color: rgba(236,237,241,0.7);
      }
      .bh-hint__title { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: #f4f5f8; margin-bottom: 2px; }
      .bh-hint__body { font-size: 11px; line-height: 1.5; color: rgba(236,237,241,0.55); }

      .bh-strip { position: relative; margin-bottom: 16px; }
      .bh-strip__label {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 8px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: rgba(236,237,241,0.45);
      }
      .bh-strip__count { font-family: var(--font-sans, Inter); font-size: 11px; color: rgba(236,237,241,0.35); letter-spacing: 0; text-transform: none; }
      .bh-strip__bars {
        display: grid; grid-auto-columns: 1fr; grid-auto-flow: column;
        gap: 8px; align-items: end;
        height: 120px;
        padding: 0 4px;
      }
      .bh-bar {
        position: relative;
        display: flex; flex-direction: column; align-items: center;
        height: 100%; justify-content: flex-end;
        text-decoration: none;
        transition: transform 200ms ease;
      }
      .bh-bar:hover { transform: translateY(-2px); }
      .bh-bar__stack {
        width: 100%; max-width: 42px;
        display: flex; flex-direction: column;
        border-radius: 6px 6px 2px 2px;
        overflow: hidden;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset;
      }
      .bh-bar__interest {
        background: linear-gradient(180deg,
          color-mix(in oklch, var(--bh-warm) 90%, white),
          color-mix(in oklch, var(--bh-warm) 55%, transparent));
        min-height: 2px;
      }
      .bh-bar__outstanding {
        background: linear-gradient(180deg,
          color-mix(in oklch, var(--bh-accent) 80%, white),
          color-mix(in oklch, var(--bh-accent) 30%, transparent));
        flex: 1;
      }
      .bh-bar__label {
        margin-top: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase;
        color: rgba(236,237,241,0.4);
      }
      .bh-legend {
        display: flex; gap: 16px; margin-top: 10px;
        font-size: 10.5px; color: rgba(236,237,241,0.5);
      }
      .bh-legend__item { display: inline-flex; align-items: center; gap: 6px; }
      .bh-legend__swatch {
        width: 8px; height: 8px; border-radius: 2px;
        display: inline-block;
      }
      .bh-legend__swatch--out {
        background: linear-gradient(180deg,
          color-mix(in oklch, var(--bh-accent) 80%, white),
          color-mix(in oklch, var(--bh-accent) 30%, transparent));
      }
      .bh-legend__swatch--int {
        background: linear-gradient(180deg,
          color-mix(in oklch, var(--bh-warm) 90%, white),
          color-mix(in oklch, var(--bh-warm) 55%, transparent));
      }

      .bh-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent);
        margin: 4px -6px 16px;
      }

      .bh-rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      @media (max-width: 640px) { .bh-rail { grid-template-columns: repeat(2, 1fr); } }

      .bh-stat { padding: 10px 14px 12px; border-radius: 12px; }
      .bh-stat__label {
        font-family: var(--font-mono, 'JetBrains Mono', ui-monospace, monospace);
        font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: rgba(236,237,241,0.45); margin-bottom: 4px;
      }
      .bh-stat__value {
        display: inline-flex; align-items: baseline; gap: 2px;
        font-size: 20px; font-weight: 500; color: #f4f5f8;
        font-variant-numeric: tabular-nums; letter-spacing: -0.005em;
      }
      .bh-stat__prefix { color: rgba(236,237,241,0.35); font-weight: 400; margin-right: 1px; }
      .bh-stat--warn .bh-stat__value { color: rgb(253 186 116); }
      .bh-stat--ok .bh-stat__value { color: rgb(167 243 208); }
      .bh-stat__hint { font-size: 11px; color: rgba(236,237,241,0.4); margin-top: 3px; }

      .bh-ribbon {
        position: relative;
        margin: 14px -6px -2px;
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(251, 146, 146, 0.06);
        box-shadow: inset 0 0 0 1px rgba(251, 146, 146, 0.15);
        color: rgba(254, 202, 202, 0.9);
      }
      .bh-ribbon__dot { width: 5px; height: 5px; border-radius: 999px; background: rgb(251 146 146); box-shadow: 0 0 10px rgb(251 146 146); }
      .bh-ribbon--ok {
        background: rgba(16, 185, 129, 0.06);
        box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.15);
        color: rgba(167, 243, 208, 0.9);
      }
      .bh-ribbon--ok .bh-ribbon__dot { background: rgb(16 185 129); box-shadow: 0 0 10px rgb(16 185 129); }
    `}</style>
  );
}
