# SRE Timesheet Web App — Design Spec

**Date:** 2026-06-23
**Source of truth:** `UC_SRE_Timesheet_Templet_2026.xlsx` (Sulfur Recovery Engineering Inc.)
**Owner:** maaz@sulfurrecovery.com

This document specifies a web application that replaces the Excel timesheet workbook used by SRE Inc. with a multi-user web app backed by Supabase (Postgres + Auth + RLS) and a Next.js frontend. ABAC (attribute-based access control) is enforced both server-side (RLS + RPC) and reflected in the UI.

---

## 1. Goals

1. Replace the per-employee Excel file with a single shared system.
2. Preserve **every business rule** in the workbook (categories, project number format, overtime accrual, TIL bank, vacation bank, approval FSM, audit trail).
3. Enable Admin oversight: see all employees, approve/decline weeks, manage projects, allocations, freeze approved data.
4. Auditability: append-only approval log, status history per timesheet.
5. ABAC: an employee can never see or write another employee's data; admins can; project assignments can scope visibility further if needed.

Non-goals (v1): payroll export integration, mobile native app, time-tracking timers, public API.

---

## 2. Domain Model

### 2.1 Entities

| Entity | Key fields |
|---|---|
| `organizations` | `id`, `name`, `fiscal_year_start` |
| `users` | `id` (= `auth.users.id`), `org_id`, `full_name`, `email`, `employee_code`, `department`, `position`, `is_active` |
| `user_roles` | `user_id`, `role` (`employee` \| `admin`), unique per (user, role) |
| `positions` | `id`, `org_id`, `name`, `annual_vacation_hours` |
| `projects` | `id`, `org_id`, `project_number` (int, format `YYYY` + 3-digit), `name`, `status` (`active`\|`closed`), `created_at` |
| `categories` | seeded enum-like table: `main_category` ∈ {`Project`, `Admin`, `Office & Sales`} |
| `sub_categories` | `id`, `main_category`, `name`, `requires_project` (bool), `consumes_til` (bool), `consumes_vacation` (bool), `is_overtime_taken` (bool) |
| `timesheets` | `id`, `user_id`, `week_start` (date, must be Monday), `status` (`draft`\|`submitted`\|`approved`\|`declined`), `submitted_at`, `decided_at`, `decided_by`, `decline_reason`, `locked` (bool, true when approved), unique (`user_id`, `week_start`) |
| `timesheet_entries` | `id`, `timesheet_id`, `main_category`, `sub_category_id`, `project_id` (nullable), `mon_hrs`…`sun_hrs` (numeric ≥ 0), `description` (required, non-empty), `position` (order) |
| `til_ledger` | `id`, `user_id`, `week_start`, `opening_balance`, `overtime_earned`, `til_used`, `closing_balance`, `frozen` (bool), `approved_by`, generated at approval time |
| `vacation_ledger` | same shape as `til_ledger` but vacation |
| `approval_log` | `id`, `timesheet_id`, `actor_id`, `action` (`submit`\|`approve`\|`decline`\|`unlock`), `at` (timestamptz), `comment`. Append-only. |
| `notifications` | `id`, `user_id`, `kind`, `payload`, `read_at` (optional, v1.1) |

### 2.2 Seed data (sub_categories)

| main_category | name | requires_project | consumes_til | consumes_vacation | is_overtime_taken |
|---|---|---|---|---|---|
| Project | Travel | true | false | false | false |
| Project | Site Travel | true | false | false | false |
| Project | Site Work | true | false | false | false |
| Project | Report | true | false | false | false |
| Project | Extra Integration | true | false | false | false |
| Project | Simulation | true | false | false | false |
| Project | Office Preparation | true | false | false | false |
| Project | Project Management | true | false | false | false |
| Project | Engineering Work | true | false | false | false |
| Admin | Overtime Taken | false | true | false | true |
| Admin | TIL Payout | false | true | false | false |
| Admin | Sick Time | false | false | false | false |
| Admin | Vacation Hours | false | false | true | false |
| Admin | Statutory Holiday | false | false | false | false |
| Admin | Administrative | false | false | false | false |
| Admin | Toolbox Meeting | false | false | false | false |
| Office & Sales | Customer Contact | false | false | false | false |
| Office & Sales | Project Development | false | false | false | false |
| Office & Sales | Proposals & Quotes | false | false | false | false |
| Office & Sales | Inventory | false | false | false | false |
| Office & Sales | SRU Study | false | false | false | false |
| Office & Sales | Conference | false | false | false | false |
| Office & Sales | General | false | false | false | false |

### 2.3 Seed positions (vacation hours)

| position | annual_vacation_hours |
|---|---|
| Process Engineer EIT | 120 |
| Admin | 200 |
| Senior Engineer | 200 |
| Sales & Marketing | 160 |

---

## 3. Business Rules (verbatim from workbook)

1. **Row total** = `mon_hrs + tue_hrs + … + sun_hrs`.
2. **Per-day overtime** for a timesheet = `MAX(0, day_total_excluding_TILPayout_rows − 8)`.
3. **Week overtime earned** = `Σ per-day overtime`.
4. **TIL used this week** = `Σ row_total WHERE sub_category.is_overtime_taken OR sub_category.name = 'TIL Payout'`.
5. **TIL closing** = `TIL opening + overtime_earned − til_used`.
6. **Vacation used this week** = `Σ row_total WHERE sub_category.consumes_vacation`.
7. **Vacation closing** = `vacation_opening − vacation_used`.
8. **Project number required** when `main_category = 'Project'`. Format: 4-digit year + 3-digit sequence (regex `^\d{7}$`, parsed `YYYY` ∈ [2020, current_year+1], seq ∈ [001, 999]).
9. **Description required** on every entry. Empty descriptions block submit.
10. **Dates** entered must be within the declared week (Monday → Sunday). Out-of-week entries are blocked at submit.
11. **Status FSM**
    - `draft` → `submitted` (employee)
    - `submitted` → `approved` (admin) → **locked** forever
    - `submitted` → `declined` (admin) → reverts to `draft` (editable)
12. **Opening balance carry-forward:** when admin approves week W, the TIL/vacation ledger row for W is frozen; the next week's `opening_balance` = this week's `closing_balance`. Admin enters historical opening balance once at onboarding.
13. **Audit trail:** every status transition appends an immutable row to `approval_log` with actor, timestamp, optional comment.
14. **No backdating once approved:** approved weeks cannot be edited by anyone (admin can `unlock` only via a dedicated audited action — out of v1 unless needed).

---

## 4. Access Control (ABAC)

Two roles, three attribute dimensions: `user_id`, `org_id`, `is_admin`.

### 4.1 Policy matrix

| Resource | Action | Employee | Admin |
|---|---|---|---|
| own `timesheet` (status ∈ {draft, declined}) | read/write | ✅ | ✅ |
| own `timesheet` (status ∈ {submitted, approved}) | read | ✅ | ✅ |
| own `timesheet` (status ∈ {submitted, approved}) | write | ❌ | ❌ (approved); via RPC only for submitted→approve/decline |
| other employees' timesheets | read | ❌ | ✅ (same org) |
| other employees' timesheets | write | ❌ | ❌ direct; ✅ via `approve_timesheet`/`decline_timesheet` RPC |
| `projects`, `positions`, `sub_categories` | read | ✅ | ✅ |
| `projects`, `positions` | write | ❌ | ✅ |
| `users`, `user_roles` | read self | ✅ | ✅ (all in org) |
| `users`, `user_roles` | write | ❌ | ✅ |
| `til_ledger`, `vacation_ledger` (own) | read | ✅ | ✅ |
| `til_ledger`, `vacation_ledger` (others) | read | ❌ | ✅ |
| `til_ledger`, `vacation_ledger` | write | ❌ | RPC only (during approval) |
| `approval_log` | read own | ✅ | ✅ |
| `approval_log` | read all | ❌ | ✅ |
| `approval_log` | write | ❌ | INSERT only via RPC |

### 4.2 Enforcement

All policies expressed as Supabase RLS policies on each table, using:

- `auth.uid()` for self identity
- A SQL helper `is_admin(uid uuid)` → `EXISTS(SELECT 1 FROM user_roles WHERE user_id=uid AND role='admin')`
- A SQL helper `same_org(target_user uuid)` → org match
- All state transitions (`submit`, `approve`, `decline`) implemented as Postgres `SECURITY DEFINER` functions that enforce the FSM, write the `approval_log`, and update ledgers atomically. The base tables forbid direct writes to `status`, `approval_log`, and ledger rows.

### 4.3 Frontend reflection

The UI calls a `whoami` RPC that returns `{ user, roles, position, vacation_opening, til_opening }`. UI hides/disables actions when policy would reject them, but never relies on UI for security.

---

## 5. Application Architecture

```
┌───────────────────────────────┐
│ Next.js 15 (App Router)       │
│  • React Server Components    │
│  • Tailwind v4 + shadcn/ui    │
│  • TanStack Query (mutations) │
│  • Zod validation             │
└──────────────┬────────────────┘
               │   Supabase JS (auth + PostgREST + RPC)
               ▼
┌───────────────────────────────┐
│ Supabase                      │
│  • Postgres (schema + RLS)    │
│  • Auth (email + magic link)  │
│  • Edge Functions (optional)  │
│  • Storage (signed PDFs v1.1) │
└───────────────────────────────┘
```

- **No separate Node backend.** Postgres is the backend; RLS + RPC are the API.
- **Computation** (row totals, daily OT, weekly TIL/vacation) lives as **Postgres generated columns + views**, mirrored in the client only for live editing previews. Single source of truth = DB.
- **Validation** uses Zod on the client and `CHECK`/triggers in DB.
- **Auth:** Supabase Auth — both **email + password** and **magic-link** enabled. Users are provisioned by admin (admin creates the `users` row with `employee_code`, `position`, and opening balances; user receives an invite email to set a password or use magic-link).

### 5.1 Key views (DB)

- `v_timesheet_totals` — per timesheet: total hours, OT earned, TIL used, vacation used.
- `v_weekly_report` — daily breakdown × category, ready for the report screen.
- `v_til_balance` — current TIL balance per user (latest frozen ledger + any in-flight submitted week).
- `v_vacation_balance` — same for vacation.

### 5.2 Key RPCs

- `submit_timesheet(timesheet_id uuid)` → validates rules 8–10, transitions to `submitted`, logs.
- `approve_timesheet(timesheet_id uuid, comment text)` → admin-only, transitions to `approved`, freezes ledgers, carries forward opening balance to next week.
- `decline_timesheet(timesheet_id uuid, reason text)` → admin-only, transitions to `declined`, logs.
- `create_or_get_week(week_start date)` → returns the user's timesheet for that Monday, creating if absent.
- `unlock_timesheet(timesheet_id uuid, reason text)` → admin-only. Sets status `approved` → `declined`, writes `unlock` row to `approval_log` with mandatory reason, and triggers ledger recomputation cascade (see §6.3). Used when a typo or correction is needed on an already-approved week.

---

## 6. Frontend — Information Architecture

### 6.1 Routes

| Path | Who | Purpose |
|---|---|---|
| `/login` | anon | magic-link sign-in |
| `/` | auth | redirects to `/week/current` or `/admin` based on role |
| `/week/[week_start]` | employee | the **Weekly Timesheet** editor for that week |
| `/week/[week_start]/report` | employee | read-only **Weekly Report** view |
| `/me/til` | employee | TIL ledger history |
| `/me/vacation` | employee | Vacation ledger history |
| `/admin` | admin | approval queue (default landing) |
| `/admin/users` | admin | manage users, positions, opening balances |
| `/admin/projects` | admin | manage project numbers |
| `/admin/approvals` | admin | full approval log, filterable |
| `/admin/employees/[id]/week/[ws]` | admin | view any employee's week (read-only + approve/decline actions) |

### 6.2 Key screens

**Weekly Timesheet editor** — the core screen. Mirrors the Excel layout but better:
- Header strip: employee info (read-only), week picker (Monday only), current status badge.
- KPI strip (always visible, live-computed from current edits): `Opening TIL`, `OT Earned This Week`, `TIL Remaining`, `Opening Vacation`, `Vacation Used`, `Vacation Remaining`.
- Entry table: each row = one activity, columns = Main Cat → Sub-Cat → Project No. → Mon..Sun hr inputs → Description → row total.
  - Sub-Cat dropdown is filtered by Main Cat (cascading, server-known map).
  - Project No. column auto-disables for non-Project rows; for Project rows it offers a typeahead from `projects` plus a "create new" inline (admin only — for employees it's required to pick an existing).
  - Daily cells: numeric ≥ 0, step 0.25.
  - Inline row validation badges (missing description = orange; bad project format = red).
- Footer totals row: per-day total, per-day overtime (live), week total, adjusted overtime.
- Status banner: locked banner if approved, "awaiting approval" if submitted, edit hint if draft/declined.
- Submit button: disabled until all rules pass; on click triggers `submit_timesheet`.

**Admin Approval Queue** — table of `submitted` timesheets sorted by submitted_at. Each row: employee, week, total hours, OT earned, "Review" button → opens the read-only week view with sticky `Approve` / `Decline (with reason)` actions.

### 6.3 Unlock & Ledger Cascade

When admin calls `unlock_timesheet(W)`:
1. The target week W transitions `approved` → `declined` (employee can edit again).
2. Every TIL/vacation ledger row for that user with `week_start ≥ W` is marked `stale` (kept for audit, but excluded from balance views).
3. On the eventual re-approval of W, the ledger for W is rewritten from the current entries.
4. The cascade re-runs: for each subsequent week W+1, W+2, … that is `approved`, the ledger is recomputed using the new prior-week closing balance. Entries themselves are not touched — only opening/closing balances move.
5. Every recomputed row writes an audit entry: `approval_log(action='ledger_recompute', actor=admin, comment='cascade from unlock of <date>')`.

This keeps the audit story complete (you can always see who unlocked what and why) while making real-world corrections possible.

### 6.4 Weekly Report

**Weekly Report** — same data as Excel's report tab: KPI cards, daily breakdown table, hours by main category (with bar), hours by sub-category (with % of category), hours by project number (daily + total).

---

## 7. UI Direction (taste)

Direction: **disciplined "operations dashboard"** — Swiss/International leaning. This is an internal tool for engineers; clarity and density beat decoration. Not minimal in the lazy default-Tailwind sense — intentional.

- **Palette:** neutral warm-grays with one strong semantic accent.
  - Surface `oklch(98% 0.005 90)` (light), `oklch(16% 0.01 90)` (dark)
  - Text `oklch(20% 0.01 90)` / `oklch(96% 0.005 90)`
  - Accent `oklch(58% 0.15 250)` (cool blue) — used for primary action and status "submitted"
  - Status colors: draft = gray, submitted = blue, approved = green `oklch(62% 0.16 150)`, declined = amber `oklch(70% 0.16 60)`
- **Typography:** Inter (UI) + JetBrains Mono (hours inputs, totals, project numbers). Numeric tabular figures everywhere a number lives.
- **Density:** the entry table is dense by default; row height ~36px; sticky header; sticky totals footer; alternating zebra `oklch(L 0.003 H)`.
- **Hierarchy:** big KPI strip up top with tabular numerals, then the editor table. Status banner spans full width as a colored bar (not a toast — persistent).
- **Motion:** minimal — 120ms fade on row add/remove, 200ms color transition on status badge. No scroll animations.
- **Components:** shadcn/ui base, but every component theme-tuned (custom radius `4px`, custom focus ring, custom input style — no out-of-the-box defaults).
- **Light + dark** are both first-class — dark is not a free afterthought; both colorways tested.

This direction is locked unless overridden. Mockups will be produced in the implementation phase, not in this spec.

---

## 8. Validation & Error Handling

| Rule | UI feedback | DB enforcement |
|---|---|---|
| Hours ≥ 0 | input rejects | CHECK |
| Sub-cat must match main-cat | dropdown filtered | trigger on insert/update |
| Project No. required when Project | row badge red | CHECK + trigger |
| Project No. format `YYYY` + 3-digit | inline error | regex CHECK + FK to `projects` |
| Description not empty | row badge orange | CHECK length ≥ 1 |
| Week-start must be Monday | week picker only offers Mondays | CHECK `extract(dow from week_start)=1` |
| Status FSM | UI disables wrong actions | RPC enforces |
| Approved week is locked | UI shows lock banner | RLS forbids writes |

All RPCs return `{ ok: true }` or `{ ok: false, code, message }`. The UI surfaces failures as a banner on the affected section, not as a generic toast.

---

## 9. Testing Strategy

- **DB layer:** pgTAP tests for every RLS policy and every RPC (happy path + each forbidden transition). Lives in `supabase/tests/`.
- **API contract:** Vitest + Supabase JS against a local Supabase, one test file per RPC.
- **Frontend:** Vitest + React Testing Library for the entry-table reducer; Playwright for the critical paths:
  1. Employee creates week → adds entries → submits.
  2. Admin approves → employee sees lock → opening balance carries forward.
  3. Admin declines with reason → employee edits → resubmits.
  4. Project-row without project number is blocked.
- **Visual regression:** Playwright screenshots for the editor (light + dark, empty + populated + locked) and the report.

Coverage target: 80% as per repo standards.

---

## 9a. Historical Data Import

The org has existing Excel workbooks (one per employee). At go-live we need historical balances and ideally historical weeks. A one-shot import is part of v1.

### Inputs accepted

- The current per-employee Excel files (`UC_SRE_Timesheet_Templet_2026.xlsx` shape).
- A CSV of the **opening balances snapshot** (one row per employee: `employee_code, position, til_opening_hrs, vacation_opening_hrs, as_of_date`).

### Two import modes

1. **Balances-only (minimum, required):** import opening TIL and vacation balances per employee with an `as_of_date`. This creates a synthetic ledger row dated `as_of_date − 7d` with the opening values frozen, so the first real submitted week carries forward correctly.
2. **Full history (optional):** parse each historical Excel file's `Weekly Timesheet` rows and produce one `timesheet` per week with all entries. Imported weeks land directly in `status='approved'` (since they're already real), `decided_by` = the importer admin, with an `approval_log` entry tagged `action='imported'`. Ledgers are computed by replaying weeks in chronological order.

### Implementation

- A `scripts/import/` Python (openpyxl) tool that reads the workbooks, validates against the schema, and emits SQL (or calls the Supabase REST API). Dry-run mode prints a diff; live mode writes inside a transaction.
- A small admin-only UI screen `/admin/import` that uploads CSV (balances mode) or `.xlsx` files (history mode) and shows the dry-run diff before commit.
- Idempotent: re-running with the same input is a no-op (uses `(user_id, week_start)` uniqueness + content hash).

### What we cannot recover

- The `📁 Approval Log` rows in the Excel sheet were never filled (they're a blank numbered table). Imported weeks therefore get a single synthetic `imported` log entry, not the real prior approver names.

---

## 10. Out of Scope (v1)

- Payroll export (CSV/Excel export of approved weeks is in scope; QuickBooks/SAP push is not)
- Mobile native
- Multi-org tenancy beyond the data model already supporting it
- TIL/Vacation accrual policy beyond what's in the workbook (e.g., monthly accruals)
- Mobile native app

---

## 11. Repo Layout (planned)

```
SRE-app/
├── docs/specs/                           ← this file
├── supabase/
│   ├── migrations/                       ← versioned SQL
│   ├── seed.sql                          ← categories, sub-categories, positions
│   └── tests/                            ← pgTAP
├── apps/web/                             ← Next.js
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── tests/
├── packages/
│   └── shared/                           ← Zod schemas, types shared client+server
└── package.json (pnpm workspace)
```

---

## 12. Confirmed Decisions

1. **Auth:** both email+password and magic-link enabled.
2. **Multi-org:** `org_id` column kept on every relevant table; v1 hardcodes one org row.
3. **Historical import:** in scope for v1 — balances-only required, full-history optional. See §9a.
4. **Notifications:** in-app for v1; email notifications for submit/approve/decline added in v1.1.
5. **Unlock approved week:** in scope for v1 via the `unlock_timesheet` RPC with mandatory reason + ledger cascade. See §6.3.
