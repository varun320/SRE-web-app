import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchMyCreditCards } from '@/lib/expenses/queries';
import { CreditCardsEditor } from '@/components/expenses/CreditCardsEditor';
import { InterestRateCard } from '@/components/expenses/InterestRateCard';

export default async function ExpenseSettingsPage() {
  const sb = await getSupabaseServer();
  const { data: userRow } = await sb.auth.getUser();
  const userId = userRow.user?.id;
  if (!userId) throw new Error('unauthenticated');

  const [cards, settingsRes] = await Promise.all([
    fetchMyCreditCards(sb),
    sb.from('expense_settings').select('apr, grace_days, currency').eq('user_id', userId).maybeSingle(),
  ]);

  const apr = Number(settingsRes.data?.apr ?? 0.2199);
  const graceDays = Number(settingsRes.data?.grace_days ?? 30);

  return (
    <main className="w-full px-3 md:px-4 py-5 space-y-6">
      <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="h-4 w-4" /> Back to expenses
      </Link>

      <header>
        <h1 className="text-h1">Expense settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Register the credit cards you use for company purchases and set the interest rate that applies to any unpaid balance after Net-30.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Interest rate</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Applied to unpaid principal after {graceDays} days from submission. Ashley&apos;s admin card can differ per user.
        </p>
        <div className="mt-3">
          <InterestRateCard apr={apr} graceDays={graceDays} />
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
        <h2 className="text-sm font-medium">Credit cards</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Add each card you use for company purchases so line items can record which one paid.
        </p>
        <div className="mt-3">
          <CreditCardsEditor initial={cards} />
        </div>
      </section>
    </main>
  );
}
