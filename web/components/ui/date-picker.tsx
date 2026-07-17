'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value?: string;              // ISO YYYY-MM-DD
  onChange: (iso: string) => void;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
}

function toISO(d: Date | undefined): string {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fromISO(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function DatePicker({
  value,
  onChange,
  disabled,
  required,
  ariaLabel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={ariaLabel ?? 'Pick a date'}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-left outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 hover:bg-[var(--color-surface-2)]/50',
          !value && 'text-[var(--color-text-muted)]',
          className,
        )}
      >
        <span className="tabular-nums">{value || 'Pick a date'}</span>
        <CalendarIcon className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="start">
          <Popover.Popup
            className="z-50 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-2"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              weekStartsOn={1}
              showOutsideDays
              onSelect={(d) => {
                if (d) {
                  onChange(toISO(d));
                  setOpen(false);
                }
              }}
              classNames={{
                today: 'text-[var(--color-accent)] font-semibold',
                selected: 'bg-[var(--color-accent)] text-white rounded',
                chevron: 'fill-[var(--color-text-muted)]',
                caption_label: 'text-sm font-medium',
                month_caption: 'flex items-center justify-center py-1.5',
                weekday: 'text-[10px] uppercase text-[var(--color-text-muted)] font-normal w-8',
                day: 'text-sm p-0',
                day_button: 'h-8 w-8 rounded hover:bg-[var(--color-surface-2)]',
                nav: 'flex items-center justify-between px-1',
                button_previous: 'h-6 w-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]',
                button_next: 'h-6 w-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-2)]',
              }}
            />
            {required || !value ? null : (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="mt-1 w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-1"
              >
                Clear
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
