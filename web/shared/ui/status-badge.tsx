import * as React from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

// Pills use SRE status tokens (see tokens.css). Tinted bg + hue-matched fg,
// height 20 px, rounded-full. Per DESIGN.md § 3.3 status column.
const TONE: Record<Tone, string> = {
  neutral: 'bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-fg)]',
  info:    'bg-[var(--color-status-submitted-bg)] text-[var(--color-status-submitted-fg)]',
  success: 'bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-fg)]',
  warning: 'bg-[var(--color-status-declined-bg)] text-[var(--color-status-declined-fg)]',
  danger:  'bg-[var(--color-status-declined-bg)] text-[var(--color-status-declined-fg)]',
  muted:   'bg-transparent text-[var(--color-text-muted)] ring-1 ring-inset ring-[var(--color-border-soft)]',
};

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function StatusBadge({ tone = 'neutral', className = '', ...rest }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center h-5 rounded-full px-2 text-[11px] font-medium leading-none whitespace-nowrap',
        TONE[tone],
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
