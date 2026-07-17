import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ExpenseEditor } from '@/components/expenses/ExpenseEditor';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchMyCreditCards } from '@/lib/expenses/queries';
import { fetchProjects } from '@/lib/queries';

export default async function NewExpensePage() {
  const sb = await getSupabaseServer();
  const [cards, projects] = await Promise.all([fetchMyCreditCards(sb), fetchProjects(sb)]);
  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-7">
        <h1 className="text-h1">New expense report</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          One row per line item — date, category, description, card, amount. Save as draft or submit for approval.
        </p>
        {cards.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Tip: <Link href="/expenses/settings" className="underline">register your credit cards</Link> so you can pick which one paid each line.
          </p>
        ) : null}
        <div className="mt-5">
          <ExpenseEditor initial={null} creditCards={cards} projects={projects} isNew />
        </div>
      </section>
    </main>
  );
}
