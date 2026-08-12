import { Skeleton } from '@/shared/ui/skeleton';
export default function Loading() {
  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-48 w-full" />
    </main>
  );
}
