'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';

interface Props {
  weekStart: string;
  currentMonday: string;
}

function shiftMonday(iso: string, weeks: number): string {
  return format(addDays(parseISO(iso), weeks * 7), 'yyyy-MM-dd');
}

function mondayFromDate(iso: string): string {
  const d = parseISO(iso);
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function formatRange(iso: string): string {
  const start = parseISO(iso);
  const end = addDays(start, 6);
  const startFmt = format(start, 'MMM d');
  const endFmt = format(end, 'MMM d, yyyy');
  return `${startFmt} – ${endFmt}`;
}

// Lets employees jump to any Monday — critical for logging past weeks after
// travel (Utsav's 2026-07-06 comment: "we are submitting 2 to 3 weeks of
// timesheet together, week by week").
export function WeekPicker({ weekStart, currentMonday }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (nextMonday: string) => {
    start(() => router.push(`/week/${nextMonday}`));
  };

  const isCurrent = weekStart === currentMonday;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => go(shiftMonday(weekStart, -1))}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      <label className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-sm">
        <CalendarDays className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        <span className="text-[var(--color-text-muted)] hidden sm:inline">Jump to</span>
        <input
          type="date"
          defaultValue={weekStart}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (!v) return;
            go(mondayFromDate(v));
          }}
          className="bg-transparent text-sm outline-none"
          aria-label="Pick any date in the week"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => go(shiftMonday(weekStart, 1))}
        aria-label="Next week"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
      {isCurrent ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => go(currentMonday)}
        >
          Today
        </Button>
      )}
      <span className="text-xs text-[var(--color-text-muted)] ml-1">{formatRange(weekStart)}</span>
    </div>
  );
}
