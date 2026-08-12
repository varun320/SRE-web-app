'use client';
import { Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { copyLastWeek } from '@/app/(app)/week/[week_start]/actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  weekStart: string;
  hasEntries: boolean;
}

export function CopyLastWeekButton({ weekStart, hasEntries }: Props) {
  const router = useRouter();
  return (
    <ConfirmDialog
      triggerLabel={
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy last week
        </>
      }
      triggerVariant="outline"
      triggerSize="sm"
      title="Copy last week's rows?"
      description={
        hasEntries ? (
          <>
            <p>Existing rows in this week will be <strong>replaced</strong> with last week&apos;s.</p>
            <p className="mt-1">Hours copy as-is — tweak the day columns before saving.</p>
          </>
        ) : (
          <p>Last week&apos;s rows will be added here. Hours copy as-is — tweak before saving.</p>
        )
      }
      confirmLabel="Copy"
      destructive={hasEntries}
      onConfirm={async () => {
        const res = await copyLastWeek(weekStart);
        if (res.error) throw new Error(res.error);
        router.refresh();
      }}
      successMessage="Copied — review and save"
    />
  );
}
