import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]',
        className ?? '',
      ].join(' ')}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Loading…</span>}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-16 flex items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
