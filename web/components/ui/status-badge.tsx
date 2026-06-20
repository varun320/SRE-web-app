import * as React from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const TONE: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-text)] ring-[var(--color-border)]',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  danger:  'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30',
  info:    'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/30',
  muted:   'bg-transparent text-[var(--color-text-muted)] ring-[var(--color-border-soft)]',
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function StatusBadge({ tone = 'neutral', className = '', ...rest }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap',
        TONE[tone],
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
