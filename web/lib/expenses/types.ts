export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'declined' | 'paid';

export interface ExpenseReport {
  id: string;
  user_id: string;
  org_id: string;
  invoice_no: string;
  period_from: string;
  period_to: string;
  submission_date: string;
  amount_cad: number;
  gst_cad: number;
  total_cad: number;
  notes: string | null;
  status: ExpenseStatus;
  locked: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpensePayout {
  id: string;
  user_id: string;
  org_id: string;
  invoice_no: string;
  payout_date: string;
  amount_cad: number;
  reference: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpenseBalanceRow {
  id: string;
  user_id: string;
  org_id: string;
  invoice_no: string;
  submission_date: string;
  due_date: string;
  claimed: number;
  paid: number;
  outstanding: number;
  days_overdue: number;
  interest_owing: number;
  total_owing: number;
  report_status: ExpenseStatus;
  locked: boolean;
  balance_status: 'paid' | 'interest_owing' | 'overdue' | 'outstanding';
}

export interface ExpenseSummary {
  user_id: string;
  org_id: string;
  total_submitted: number;
  total_received: number;
  outstanding_principal: number;
  interest_accrued: number;
  total_owing: number;
}

export interface ExpenseSettings {
  user_id: string;
  apr: number;
  grace_days: number;
  currency: string;
}

export const EXPENSE_CATEGORIES = [
  'Meals',
  'Fuel',
  'Transport',
  'Hotel',
  'Office Supplies',
  'Communications',
  'Client Entertainment',
  'Other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseLineItem {
  id: string;
  expense_id: string;
  line_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: number;
  gst_cad: number;
  credit_card_id: string | null;
  receipt_url: string | null;
  position: number;
}

export interface ExpenseLineDraft {
  line_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cad: number;
  gst_cad: number;
  credit_card_id?: string | null;
}

export interface CreditCard {
  id: string;
  user_id: string;
  label: string;
  last_four: string | null;
  is_default: boolean;
  is_active: boolean;
}
