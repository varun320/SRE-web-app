'use client';
import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'sre.quickstart.dismissed';

export function QuickStart() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) !== '1') {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — leave hidden
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      className="mx-3 md:mx-4 mt-2 mb-2 rounded-[var(--radius-lg)] px-4 py-3 flex items-start gap-3 border border-[var(--color-border-soft)]"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
    >
      <Sparkles className="h-4 w-4 mt-0.5 shrink-0 opacity-70" aria-hidden />
      <div className="flex-1 text-sm leading-snug">
        <div className="font-medium mb-1">Quick start</div>
        <ul className="text-[var(--color-text-muted)] space-y-0.5">
          <li>· Add a row for each thing you worked on — pick a category and (for Projects) a project number.</li>
          <li>· Fill in hours per day, then a short description so admins know what it was.</li>
          <li>· Click <span className="font-medium text-[var(--color-text)]">Save draft</span> as you go, and <span className="font-medium text-[var(--color-text)]">Submit for approval</span> when the week is done.</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss quick start"
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 -m-1 rounded"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
