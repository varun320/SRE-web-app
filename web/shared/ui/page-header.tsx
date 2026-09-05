import type { ReactNode } from 'react';
import { InfoHint } from '@/shared/ui/info-hint';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  tip?: ReactNode;
  action?: ReactNode;
}

/**
 * Standard page title bar. Optional `tip` renders a (?) popover next to the
 * title for inline how-does-this-work hints. Optional `action` sits to the right.
 * When `tip` is provided the title should be a plain string so it can be used
 * as the InfoHint's aria-label; complex title nodes without a tip are fine.
 */
export function PageHeader({ title, description, tip, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {tip ? <InfoHint label={typeof title === 'string' ? title : 'Section'}>{tip}</InfoHint> : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-2xl">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
