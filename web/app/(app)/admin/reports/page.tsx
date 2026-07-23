import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { REPORT_ITEMS } from '@/components/shell/ReportsSubnav';

export default function ReportsHome() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {REPORT_ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="group flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]/40 transition-colors"
          >
            {Icon ? (
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-medium text-[var(--color-text)]">
                {it.label}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{it.hint}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
