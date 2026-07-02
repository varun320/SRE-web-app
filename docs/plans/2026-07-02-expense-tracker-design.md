# Expense Tracker Feature — Design (2026-07-02)

Source of truth for the ported spreadsheet: `UC_SRE_Expense_Report Templet 2026.xlsx`
(Summary, Settings, Expense Log, Payout Log, Balance & Interest).

## Domain model

An **expense report** is a single monthly submission by an employee to SRE,
identified by an `invoice_no` (e.g. `UC2026001`). One report has:

- period (`period_from`, `period_to`)
- `submission_date` (default = date created; used as clock for interest)
- `amount_cad` (base claim)
- `gst_cad` (may be zero)
- `total_cad` = amount + gst  (generated column)
- workflow status (`draft | submitted | approved | declined | paid`)
- `locked` boolean (once approved, needs admin unlock to re-edit)
- `notes`

A **payout** is money received from SRE against a specific invoice_no. Multiple
payouts can be applied to one invoice.

**Interest** accrues on the unpaid principal after a grace period
(default Net-30) at the employee's APR (default 21.99%/yr).
Interest formula (ported verbatim from the sheet, per-invoice, daily basis):

```
days_overdue = max(0, days_between(submission_date + grace_days, min(today, last_payment_date_if_cleared)))
interest     = round( unpaid_principal * (days_overdue / 365) * apr, 2 )
```

`unpaid_principal` uses cumulative payments applied to the invoice before the
day being measured. See `v_expense_balance` for the SQL implementation.

## Tables

- `expense_settings(user_id PK, apr, grace_days, currency)` — per-user, with
  system default row (`user_id = NULL`) used when no override.
- `expense_reports(id, user_id, org_id, invoice_no UNIQUE per user, period_from,
  period_to, submission_date, amount_cad, gst_cad, total_cad GENERATED, notes,
  status, locked, submitted_at, decided_at, decided_by, decline_reason,
  created_at, updated_at)`
- `expense_payouts(id, user_id, org_id, invoice_no, payout_date, amount_cad,
  reference, notes, created_by, created_at)`
- `expense_approval_log(id, expense_id, actor_id, action, comment, created_at)`

## Views

- `v_expense_balance` — one row per invoice with due_date, paid_to_date,
  outstanding, interest_owing, days_overdue, computed status.
- `v_expense_summary` — one row per user with totals matching the Summary tab.

## RPCs (all SECURITY DEFINER, RLS-safe)

- `expense_upsert_draft(payload jsonb) returns uuid`
- `expense_submit(p_expense_id uuid) returns void`
- `expense_approve(p_expense_id uuid) returns void`
- `expense_decline(p_expense_id uuid, p_reason text) returns void`
- `expense_unlock(p_expense_id uuid) returns void`
- `payout_upsert(payload jsonb) returns uuid`  (admin only)
- `payout_delete(p_payout_id uuid) returns void`  (admin only)

Service-role duals (`_admin` suffix) added for the import pipeline and MCP admin
tooling, following the pattern in `20260624000003_rpc_apply_import_service_role.sql`.

## RLS

Mirrors timesheet RLS:
- employees see and can draft-edit only their own rows;
- admins in the same org can read everything and mutate through RPCs;
- status transitions gated by the same `guard_status` trigger pattern used for
  timesheets so writes outside the RPC set fail.

## Web UI (Phase 2 & 3)

Employee:
- `/expenses` — summary tiles + expense-report list
- `/expenses/[invoice_no]` — draft editor / submit
- `/expenses/balance` — read-only balance & interest table

Admin:
- `/admin/expenses` — filterable, paginated list of all reports
- `/admin/expenses/payouts` — payout log CRUD
- `/admin/expenses/locked` — approved+locked reports with unlock

Reuses `AdminSubnav`, `Header`, toast + confetti, `UnlockDialog` variant.

## MCP server (Phase 4)

`scripts/mcp-expense/` — Node/TS, stdio transport, `@modelcontextprotocol/sdk`
+ `@supabase/supabase-js`.

Config (env):
- `SRE_SUPABASE_URL`
- `SRE_SUPABASE_ANON_KEY`
- `SRE_ACCESS_TOKEN`  (per-user; obtained via `supabase auth`)

Tools (all go through RPCs, no elevated privilege):
- `list_expenses(status?, from?, to?)`
- `get_expense(invoice_no)`
- `upsert_expense_draft({...})`
- `submit_expense(invoice_no)`
- `list_payouts(invoice_no?)`
- `get_balance_summary()`

Admin tools (loaded only if the token belongs to an admin):
- `approve_expense(invoice_no)`
- `decline_expense(invoice_no, reason)`
- `record_payout({invoice_no, amount, payout_date, reference?, notes?})`
- `unlock_expense(invoice_no)`

## Phases

1. **Phase 1** — DB layer (this session): migrations, views, RPCs, RLS, seed.
2. **Phase 2** — Employee UI.
3. **Phase 3** — Admin UI.
4. **Phase 4** — MCP server + docs.
5. **Phase 5** — Tests (SQL parity vs Excel goldens, Vitest, Playwright),
   deploy migrations to cloud Supabase, redeploy Vercel, smoke-test.
