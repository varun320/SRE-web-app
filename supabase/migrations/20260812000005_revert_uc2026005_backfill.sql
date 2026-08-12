-- Undo the incorrect legacy-payout backfill for UC2026005.
--
-- The earlier scripts/backfill-legacy-paid-payouts.mjs assumed that a report
-- whose status='paid' but had zero payout rows was missing history and
-- inserted a synthetic payout to reconcile. For UC2026005 that was WRONG:
-- Utsav confirmed no payment has actually been received. The legacy import
-- had set status='paid' incorrectly.
--
-- This migration:
--   1. deletes the synthetic payout row (reference='legacy import backfill')
--   2. flips the report status back from 'paid' → 'approved' and unlocks it
--      so an admin can record the real payment (or leave it approved) later.
--
-- Runs inside a DO block so we can set the app.allow_status_change GUC that
-- trg_guard_expense_status requires for any status change.

do $$
begin
  perform set_config('app.allow_status_change', 'on', true);

  delete from public.expense_payouts
   where invoice_no = 'UC2026005'
     and reference = 'legacy import backfill';

  update public.expense_reports
     set status = 'approved',
         locked = false
   where invoice_no = 'UC2026005'
     and status = 'paid';
end $$;
