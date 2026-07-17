import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ExpenseEditor } from '@/components/expenses/ExpenseEditor';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchExpenseByInvoice, fetchExpenseLines, fetchMyCreditCards, fetchMyFavourites } from '@/lib/expenses/queries';
import { fetchProjects } from '@/lib/queries';
import type { ExpenseLineItem } from '@/lib/expenses/types';

function suggestNextInvoice(last: string | null | undefined): string {
  // Increment the trailing integer of the previous invoice #, keeping the
  // prefix and zero-padding intact (e.g. UC2026004 → UC2026005).
  if (!last) return '';
  const m = /^(.*?)(\d+)$/.exec(last);
  if (!m) return '';
  const prefix = m[1];
  const num = m[2];
  const next = (Number(num) + 1).toString().padStart(num.length, '0');
  return `${prefix}${next}`;
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams?: Promise<{ dup?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const dupInvoice = sp.dup;

  const sb = await getSupabaseServer();
  const [cards, projects, favourites] = await Promise.all([
    fetchMyCreditCards(sb),
    fetchProjects(sb),
    fetchMyFavourites(sb),
  ]);

  const { data: userRow } = await sb.auth.getUser();
  const uid = userRow.user?.id;
  const { data: existingInvoices } = uid
    ? await sb
        .from('expense_reports')
        .select('invoice_no')
        .eq('user_id', uid)
        .order('submission_date', { ascending: false })
    : { data: null };
  const takenInvoices = new Set((existingInvoices ?? []).map((r) => (r as { invoice_no: string }).invoice_no));
  // Seed from the most recent, then bump until the number isn't already taken.
  // Prevents the "cannot edit in status submitted" error when the latest
  // draft's next number is already a submitted report.
  let suggestedInvoice = suggestNextInvoice((existingInvoices?.[0] as { invoice_no?: string } | undefined)?.invoice_no);
  while (suggestedInvoice && takenInvoices.has(suggestedInvoice)) {
    const next = suggestNextInvoice(suggestedInvoice);
    if (!next || next === suggestedInvoice) break;
    suggestedInvoice = next;
  }

  // If ?dup=INV, clone the source report's line items into a fresh draft.
  let dupLines: ExpenseLineItem[] | undefined;
  if (dupInvoice && uid) {
    const source = await fetchExpenseByInvoice(sb, uid, dupInvoice);
    if (source) {
      const rawLines = await fetchExpenseLines(sb, source.id);
      // Reset ids + drop receipt attachments (they belong to the original).
      dupLines = rawLines.map((l) => ({
        ...l,
        id: '',
        expense_id: '',
        receipt_url: null,
      }));
    }
  }

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
          <ExpenseEditor
            initial={null}
            initialLines={dupLines}
            creditCards={cards}
            projects={projects}
            favourites={favourites}
            suggestedInvoice={suggestedInvoice}
            isNew
          />
        </div>
      </section>
    </main>
  );
}
