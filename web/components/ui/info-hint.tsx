'use client';
import { Popover } from '@base-ui/react/popover';
import { HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoHintProps {
  label: string;
  children: ReactNode;
}

/**
 * Click-to-open info hint. Renders a small (?) icon button.
 * Uses base-ui Popover so it works on touch devices.
 */
export function InfoHint({ label, children }: InfoHintProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/30 transition-opacity"
        aria-label={`What is ${label}?`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup
            className="max-w-[240px] rounded-[var(--radius)] px-3 py-2 text-xs leading-snug shadow-[var(--shadow-card)] ring-1 ring-[var(--color-border)]"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
