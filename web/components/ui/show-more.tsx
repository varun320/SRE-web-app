'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props<T> {
  items: T[];
  initial?: number;
  step?: number;
  render: (item: T, index: number) => ReactNode;
  emptyLabel?: string;
  wrapClassName?: string;
}

// Client-side paginator: renders the first `initial` items and adds `step`
// more each click. Trivial and generic — no server round-trip.
export function ShowMore<T>({
  items,
  initial = 10,
  step = 10,
  render,
  emptyLabel = 'Nothing here yet.',
  wrapClassName = '',
}: Props<T>) {
  const [visible, setVisible] = useState(initial);
  if (items.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] py-2">{emptyLabel}</p>;
  }
  const shown = items.slice(0, visible);
  const remaining = items.length - visible;
  return (
    <div className={wrapClassName}>
      {shown.map((item, i) => render(item, i))}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + step)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ChevronDown className="h-3 w-3" />
          Show {Math.min(remaining, step)} more · {remaining} remaining
        </button>
      ) : null}
    </div>
  );
}
