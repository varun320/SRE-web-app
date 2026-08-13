'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DirectoryCard } from '@/features/clients/components/DirectoryCard';
import type { DirectoryCard as CardData } from '@/features/clients/queries';

interface Props {
  cards: CardData[];
  initial?: number;
  step?: number;
}

export function DirectoryList({ cards, initial = 8, step = 12 }: Props) {
  const [visible, setVisible] = useState(initial);
  if (cards.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] py-2">No clients yet.</p>;
  }
  const shown = cards.slice(0, visible);
  const remaining = cards.length - visible;
  return (
    <div className="space-y-4">
      {shown.map((c) => <DirectoryCard key={c.id} card={c} />)}
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
