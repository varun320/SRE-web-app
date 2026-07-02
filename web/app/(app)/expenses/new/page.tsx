import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ExpenseEditor } from '@/components/expenses/ExpenseEditor';

export default function NewExpensePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <h1 className="text-2xl font-semibold tracking-tight">New expense report</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Fill in the yellow cells — total auto-calculates. Save as draft or submit for approval.
        </p>
        <div className="mt-5">
          <ExpenseEditor initial={null} isNew />
        </div>
      </section>
    </main>
  );
}
