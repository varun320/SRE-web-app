import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-8 text-center">
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-[var(--color-text)]">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
