'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print or Save as PDF
    </button>
  );
}
