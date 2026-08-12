export interface PaymentStatus {
  label: 'Unpaid' | 'Partially Paid' | 'Paid' | '—';
  tone: 'success' | 'warning' | 'danger' | 'muted';
}

export function paymentStatus(
  reportStatus: string,
  total: number,
  paid: number,
): PaymentStatus {
  if (reportStatus !== 'approved' && reportStatus !== 'paid') {
    return { label: '—', tone: 'muted' };
  }
  // Payout math is authoritative: "Paid" only when payouts cover the total.
  // Legacy imports that set status='paid' without payout rows must be
  // backfilled via scripts/backfill-legacy-paid-payouts.mjs — do not
  // short-circuit here or partial payments look full.
  if (paid <= 0) return { label: 'Unpaid', tone: 'danger' };
  if (paid + 0.005 < total) return { label: 'Partially Paid', tone: 'warning' };
  return { label: 'Paid', tone: 'success' };
}

export interface UnifiedStatus {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

// One column that answers "where is this report?"
// Non-approved rows keep their workflow status; approved/paid rows show payment progress.
export function unifiedStatus(
  reportStatus: string,
  total: number,
  paid: number,
): UnifiedStatus {
  if (reportStatus === 'draft') return { label: 'Draft', tone: 'muted' };
  if (reportStatus === 'submitted') return { label: 'Submitted', tone: 'warning' };
  if (reportStatus === 'declined') return { label: 'Declined', tone: 'danger' };
  // approved | paid → payment progress carries the meaning. See paymentStatus().
  if (paid <= 0) return { label: 'Unpaid', tone: 'danger' };
  if (paid + 0.005 < total) {
    const pct = Math.round((paid / total) * 100);
    return { label: `Partial · ${pct}%`, tone: 'warning' };
  }
  return { label: 'Paid', tone: 'success' };
}
