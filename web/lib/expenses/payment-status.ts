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
