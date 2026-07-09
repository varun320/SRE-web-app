interface Props {
  /** Seven values, Mon..Sun. */
  hours: [number, number, number, number, number, number, number];
  /** 0..6 index of "today" in Mon..Sun ordering; -1 to disable highlight. */
  todayIndex: number;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

// Compact 7-day hours bar chart. Bar heights scale to the row's max (or 8 h,
// whichever is higher, so a normal-8h day still reads as a full-ish bar).
// Weekend bars use a lighter tone. Today gets an accent underline.
export function HoursSparkline({ hours, todayIndex }: Props) {
  const max = Math.max(8, ...hours);

  return (
    <div className="flex items-end gap-1.5" aria-label="Hours logged per day this week" role="img">
      {hours.map((h, i) => {
        const heightPct = max > 0 ? (h / max) * 100 : 0;
        const isWeekend = i >= 5;
        const isToday = i === todayIndex;
        const hasHours = h > 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <div className="w-full h-14 flex items-end">
              <div
                className={[
                  'w-full rounded-t-[3px] transition-all',
                  hasHours
                    ? isWeekend
                      ? 'bg-[var(--color-accent)]/40'
                      : 'bg-[var(--color-accent)]'
                    : 'bg-[var(--color-border-soft)]',
                ].join(' ')}
                style={{ height: hasHours ? `${Math.max(heightPct, 4)}%` : '4%' }}
                title={`${h.toFixed(2)} h`}
              />
            </div>
            <div
              className={[
                'text-[10px] font-medium tabular w-full text-center',
                isToday
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)]',
              ].join(' ')}
            >
              {DAY_LABELS[i]}
              {isToday ? (
                <span
                  aria-hidden
                  className="block mt-0.5 h-[2px] rounded-full mx-auto"
                  style={{ width: '60%', background: 'var(--color-accent)' }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
