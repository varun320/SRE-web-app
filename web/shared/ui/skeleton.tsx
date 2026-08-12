// Cheap skeleton rectangles. Uses the same token palette as tokens.css so
// dark/light adapt automatically. Wraps around a route's <loading.tsx>
// server component — pure CSS, no client JS.

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={[
        'animate-pulse rounded-md bg-[var(--color-surface-2)]',
        className,
      ].join(' ')}
    />
  );
}

// Standard route skeleton: hero card + card grid. Matches the shape most
// /projects/* pages settle into so the layout doesn't jump on load.
export function ProjectsRouteSkeleton() {
  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-64 w-full" />
    </main>
  );
}
