import Link from 'next/link';
import { AlertTriangle, Bell, CheckSquare, Palmtree, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AttentionItem {
  key: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  href: string;
  tone: 'info' | 'warning' | 'danger';
}

const TONE_CLASSES: Record<AttentionItem['tone'], { border: string; fg: string; dot: string }> = {
  info:    { border: 'border-[var(--color-border-soft)]',                            fg: 'text-[var(--color-text)]',                  dot: 'bg-[var(--color-status-submitted-fg)]' },
  warning: { border: 'border-[color-mix(in_oklch,var(--color-status-submitted-fg),transparent_70%)]', fg: 'text-[var(--color-text)]',                  dot: 'bg-[var(--color-status-submitted-fg)]' },
  danger:  { border: 'border-[color-mix(in_oklch,var(--color-status-declined-fg),transparent_60%)]',  fg: 'text-[var(--color-status-declined-fg)]',   dot: 'bg-[var(--color-status-declined-fg)]' },
};

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Needs your attention" className="space-y-2">
      <div className="text-caption uppercase tracking-wide text-[var(--color-text-subtle)]">
        Needs your attention
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => {
          const t = TONE_CLASSES[it.tone];
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              href={it.href}
              className={`lift-hover group flex items-start gap-3 rounded-[var(--radius-md)] border ${t.border} bg-[var(--color-surface)] px-3.5 py-3 transition-colors hover:bg-[var(--color-surface-2)]/40`}
            >
              <span
                aria-hidden
                className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md ${t.dot}/10 shrink-0`}
              >
                <Icon className={`h-3.5 w-3.5 ${t.fg}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-body-sm font-medium ${t.fg}`}>{it.label}</div>
                <div className="mt-0.5 text-caption text-[var(--color-text-muted)] truncate">
                  {it.detail}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Icon exports for the home page to compose items without pulling lucide directly.
export const AttentionIcons = { AlertTriangle, Bell, CheckSquare, Palmtree, Send };
