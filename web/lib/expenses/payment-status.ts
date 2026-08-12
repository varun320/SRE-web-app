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
  if (paid <= 0) return { label: 'Unpaid', tone: 'danger' };
  if (paid + 0.005 < total) return { label: 'Partially Paid', tone: 'warning' };
  return { label: 'Paid', tone: 'success' };
}

export interface UnifiedStatus {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

// One column that answers "where is this report?"
// Non-approved rows keep their workflow status; approved rows show payment progress.
export function unifiedStatus(
  reportStatus: string,
  total: number,
  paid: number,
): UnifiedStatus {
  if (reportStatus === 'draft') return { label: 'Draft', tone: 'muted' };
  if (reportStatus === 'submitted') return { label: 'Submitted', tone: 'warning' };
  if (reportStatus === 'declined') return { label: 'Declined', tone: 'danger' };
  // approved | paid → payment progress carries the meaning
  if (paid <= 0) return { label: 'Unpaid', tone: 'danger' };
  if (paid + 0.005 < total) {
    const pct = Math.round((paid / total) * 100);
    return { label: `Partial · ${pct}%`, tone: 'warning' };
  }
  return { label: 'Paid', tone: 'success' };
}
