import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

// Per DESIGN.md § 3.8: no illustration, no card wrap. Single 24 px monochrome
// icon in text-subtle, then title (h3 scale), description (body muted), one
// CTA. 48 px vertical padding, centered.
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="py-12 px-4 text-center">
      <Icon className="mx-auto h-6 w-6 text-[var(--color-text-subtle)]" aria-hidden />
      <h3 className="mt-2 text-[18px] font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-snug">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
