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
    <div className="w-full px-3 md:px-4 py-12 flex items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
