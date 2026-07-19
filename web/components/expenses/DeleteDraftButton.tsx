'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { deleteExpenseDraft } from '@/lib/expenses/mutations';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  expenseId: string;
  invoiceNo: string;
}

export function DeleteDraftButton({ expenseId, invoiceNo }: Props) {
  const router = useRouter();
  return (
    <ConfirmDialog
      triggerLabel={
        <>
          <Trash2 className="h-3.5 w-3.5" />
          Delete draft
        </>
      }
      triggerVariant="destructive"
      title={`Delete draft ${invoiceNo}?`}
      description={
        <>
          <p>Line items and any attached receipts are removed.</p>
          <p className="mt-1"><strong>This can&apos;t be undone.</strong></p>
        </>
      }
      confirmLabel="Delete draft"
      destructive
      successMessage={`Draft ${invoiceNo} deleted`}
      onConfirm={async () => {
        await deleteExpenseDraft(getSupabaseBrowser(), expenseId);
        router.push('/expenses');
      }}
    />
  );
}
