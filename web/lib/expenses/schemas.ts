import { z } from 'zod';
import { EXPENSE_CATEGORIES } from './types';

export const expenseDraftSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_no: z.string().trim().min(3, 'Invoice # required').max(32),
  period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  submission_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
  amount_cad: z.number().nonnegative(),
  gst_cad: z.number().nonnegative().default(0),
  notes: z.string().max(2000).optional().nullable(),
});

export const expenseLineSchema = z.object({
  line_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1, 'Description required').max(500),
  amount_cad: z.number().nonnegative(),
  gst_cad: z.number().nonnegative().default(0),
  credit_card_id: z.string().uuid().nullable().optional(),
});

export const creditCardSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  last_four: z.string().regex(/^\d{4}$/, 'Last four must be 4 digits').nullable().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type CreditCardInput = z.infer<typeof creditCardSchema>;

export const expenseLinesReplaceSchema = z.object({
  expense_id: z.string().uuid(),
  lines: z.array(expenseLineSchema),
});

export type ExpenseLineInput = z.infer<typeof expenseLineSchema>;

export type ExpenseDraftInput = z.infer<typeof expenseDraftSchema>;

export const payoutSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  invoice_no: z.string().trim().min(3),
  payout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_cad: z.number().positive(),
  reference: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type PayoutInput = z.infer<typeof payoutSchema>;
