# Plan 5 — Reporting & Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved-timesheet store into something an SRE admin can hand to payroll, an accountant, or a project manager without ever opening the database. Three audiences, three reports:

1. **Payroll export** (CSV) — one row per (employee × pay period) with regular hours, OT, TIL movement, vacation movement.
2. **Hours-by-project report** (CSV + on-screen) — for any date range, how many hours each project absorbed, broken down by employee.
3. **Per-employee period report** (PDF or print-styled HTML) — clean, signable, per-employee summary for a chosen period.

Plus a small **balances snapshot** download — current TIL + vacation balance per active employee, point-in-time.

**Architecture:** Server-side only. Reports are pure read queries built on top of existing views (`v_timesheet_totals`, `v_weekly_report`) plus a new `v_period_summary` view. Downloads are streamed from Next.js route handlers (`/api/admin/reports/...`) using a service-role client so the admin can pull cross-employee data. On-screen reports are server components at `/admin/reports/...`.

**Tech Stack additions:**
- `csv-stringify` (zero-dep, already common in Node ecosystems) for CSV streaming.
- `@react-pdf/renderer` for the per-employee period PDF — server-side render, no client bundle weight.
- New SQL view `v_period_summary`.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md` §10 (out-of-scope excludes payroll push but explicitly includes CSV/Excel export)
**Plans 1–4 (DONE):** see `docs/plans/`

---

## File Structure

```
SRE-app/
├── supabase/migrations/
│   └── 20260624000010_v_period_summary.sql
└── web/
    ├── app/
    │   ├── (app)/admin/reports/
    │   │   ├── layout.tsx                       ← sub-nav: Payroll, Projects, Period, Balances
    │   │   ├── page.tsx                         ← landing: links + last-7d snapshot
    │   │   ├── payroll/page.tsx                 ← date-range form + preview + download
    │   │   ├── projects/page.tsx                ← date-range + project filter + table
    │   │   ├── period/page.tsx                  ← per-employee period preview + PDF link
    │   │   └── balances/page.tsx                ← current TIL/vacation per employee
    │   └── api/admin/reports/
    │       ├── payroll/route.ts                 ← GET ?from&to → text/csv
    │       ├── projects/route.ts                ← GET ?from&to&project_id? → text/csv
    │       ├── period/route.ts                  ← GET ?user_id&from&to → application/pdf
    │       └── balances/route.ts                ← GET → text/csv
    ├── components/admin/reports/
    │   ├── DateRangePicker.tsx                  ← shared filter
    │   ├── PayrollPreview.tsx                   ← table of rows that will be exported
    │   ├── ProjectsBreakdown.tsx                ← grouped table
    │   ├── PeriodSummary.tsx                    ← print-styled HTML version
    │   └── BalancesTable.tsx
    ├── lib/admin/reports/
    │   ├── period.ts                            ← shared query: rows for a (user, range)
    │   ├── payroll.ts                           ← aggregator: hours/OT/TIL/vac per emp×period
    │   ├── projects.ts                          ← aggregator: hours per project (× emp)
    │   ├── balances.ts                          ← latest closing per user
    │   ├── csv.ts                               ← thin csv-stringify wrapper, streaming response
    │   └── pdf.ts                               ← react-pdf document builders
    └── tests/
        ├── unit/lib/admin/reports/
        │   ├── payroll.test.ts                  ← aggregator math (TDD)
        │   └── projects.test.ts
        └── e2e/
            └── admin-reports.spec.ts            ← admin downloads payroll CSV, validates header + 1 row
```

Conventions match Plans 2–4. Components stay under 200 lines. Aggregators are pure functions over query rows — easy to unit-test without hitting the DB.

---

### Task 1 — `v_period_summary` view + indexes

**Files:**
- Create: `supabase/migrations/20260624000010_v_period_summary.sql`

Adds one SQL view that any report can read from, plus a covering index on `timesheets(week_start, status)` if not already present.

- [ ] **Step 1: View definition**

```sql
create or replace view public.v_period_summary as
select
  t.id              as timesheet_id,
  t.user_id,
  u.employee_code,
  u.full_name,
  u.department,
  t.week_start,
  t.status,
  vtt.total_hrs,
  vtt.overtime_earned,
  vtt.til_used,
  vtt.vacation_used,
  -- regular hours = total minus OT minus TIL Payout (paid out, not worked)
  greatest(coalesce(vtt.total_hrs, 0) - coalesce(vtt.overtime_earned, 0) - coalesce(payout.hrs, 0), 0) as regular_hrs,
  coalesce(payout.hrs, 0) as til_payout_hrs
from public.timesheets t
join public.users u on u.id = t.user_id
left join public.v_timesheet_totals vtt on vtt.timesheet_id = t.id
left join lateral (
  select sum(e.mon_hrs + e.tue_hrs + e.wed_hrs + e.thu_hrs + e.fri_hrs + e.sat_hrs + e.sun_hrs) as hrs
  from public.timesheet_entries e
  join public.sub_categories sc on sc.id = e.sub_category_id
  where e.timesheet_id = t.id and sc.name = 'TIL Payout'
) payout on true
where t.status = 'approved';
```

- [ ] **Step 2: Grants**

```sql
grant select on public.v_period_summary to authenticated;
-- RLS inherits from base tables — admins see all, employees see own.
```

- [ ] **Step 3: Verify**

```sql
select count(*), min(week_start), max(week_start) from public.v_period_summary;
```

---

### Task 2 — CSV streaming helper + payroll aggregator (TDD)

**Files:**
- Create: `web/lib/admin/reports/csv.ts`
- Create: `web/lib/admin/reports/period.ts`
- Create: `web/lib/admin/reports/payroll.ts`
- Create: `web/tests/unit/lib/admin/reports/payroll.test.ts`

**Payroll spec:** group `v_period_summary` rows by `(user_id, pay_period)` where `pay_period` = bi-weekly buckets aligned to a configurable epoch Monday (default: 2026-01-05). Output columns:

```
employee_code, full_name, period_start, period_end,
regular_hrs, overtime_hrs, til_payout_hrs,
til_earned_delta, til_used_delta, til_closing,
vacation_used_delta, vacation_closing
```

- [ ] **Step 1: TDD test for `aggregatePayroll`**

Fixture: 3 weeks for one employee, 2 of them in the same pay period. Test that:
- Rows are grouped correctly (2 weeks merged, 1 separate)
- `regular_hrs`, `overtime_hrs`, `til_payout_hrs` sum across weeks in the period
- Closing balances come from the latest week in the period (not the earliest)
- Employees with no weeks in the range produce no rows

- [ ] **Step 2: Implementation**

`aggregatePayroll(rows: PeriodSummaryRow[], opts: { epoch: Date }): PayrollRow[]`. Pure function, no DB calls. Period bucketing: `Math.floor((weekStart - epoch) / 14 days) → period_start = epoch + bucket*14, period_end = period_start + 13`.

- [ ] **Step 3: CSV helper**

```ts
export function csvResponse(filename: string, rows: Record<string, unknown>[]): Response {
  const stream = stringify(rows, { header: true });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: `period.ts` shared query**

```ts
export async function fetchPeriodSummary(
  sb: SupabaseClient,
  args: { from: string; to: string; userId?: string }
): Promise<PeriodSummaryRow[]>
```

Single query against `v_period_summary` filtered by `week_start.gte` and `week_start.lte`. Reused by every report.

---

### Task 3 — Payroll report (UI + route handler)

**Files:**
- Create: `web/components/admin/reports/DateRangePicker.tsx`
- Create: `web/components/admin/reports/PayrollPreview.tsx`
- Create: `web/app/(app)/admin/reports/payroll/page.tsx`
- Create: `web/app/api/admin/reports/payroll/route.ts`

- [ ] **Step 1: Date range picker**

Two `<input type="date">` controls + quick presets ("This pay period", "Last pay period", "Month-to-date", "Last 4 weeks"). Updates query params; no client state library needed.

- [ ] **Step 2: Page**

Server component reads `searchParams.from / to`, calls `fetchPeriodSummary`, runs `aggregatePayroll`, renders `<PayrollPreview rows={...}>` with a sticky **Download CSV** button that hits `/api/admin/reports/payroll?from=...&to=...`.

- [ ] **Step 3: Route handler**

Admin guard via `fetchIsAdmin`. Same `fetchPeriodSummary + aggregatePayroll` pipeline → `csvResponse('payroll-YYYYMMDD-YYYYMMDD.csv', rows)`.

- [ ] **Step 4: Smoke test**

Curl the route with valid range as logged-in admin → downloaded CSV opens cleanly in Excel, headers match spec, totals match what the on-screen preview showed.

---

### Task 4 — Hours-by-project report

**Files:**
- Create: `web/lib/admin/reports/projects.ts`
- Create: `web/tests/unit/lib/admin/reports/projects.test.ts`
- Create: `web/components/admin/reports/ProjectsBreakdown.tsx`
- Create: `web/app/(app)/admin/reports/projects/page.tsx`
- Create: `web/app/api/admin/reports/projects/route.ts`

- [ ] **Step 1: TDD for `aggregateByProject`**

Input: rows from a new query joining `timesheet_entries → projects` filtered by date range. Output: `{ project_number, project_name, total_hrs, by_employee: [{employee_code, full_name, hrs}] }[]` sorted by `total_hrs desc`.

- [ ] **Step 2: Query in `projects.ts`**

```ts
export async function fetchProjectHours(
  sb: SupabaseClient,
  args: { from: string; to: string; projectId?: string }
): Promise<ProjectHoursRow[]>
```

Direct query joining entries + projects + users + timesheets (filtered to `status='approved'`). One query, no aggregation in the DB — done in JS for testability.

- [ ] **Step 3: UI**

`ProjectsBreakdown` renders a top-level project list with an expandable "by employee" sub-row. CSV download mirrors the flat shape (`project_number, project_name, employee_code, full_name, hrs`).

- [ ] **Step 4: Optional project filter**

Dropdown of active projects narrows the report to one project — useful for project managers asking "how much time has gone into 2026125 this quarter?".

---

### Task 5 — Per-employee period PDF

**Files:**
- Add dep: `@react-pdf/renderer`
- Create: `web/lib/admin/reports/pdf.ts`
- Create: `web/components/admin/reports/PeriodSummary.tsx` (HTML version for on-screen preview)
- Create: `web/app/(app)/admin/reports/period/page.tsx`
- Create: `web/app/api/admin/reports/period/route.ts`

A clean, print-friendly per-employee summary. Same content rendered two ways: `PeriodSummary` for the screen, `<PeriodDocument>` for the PDF download.

- [ ] **Step 1: HTML preview**

`PeriodSummary` server component renders: header (employee, range, generated date), week-by-week table (date, total, OT, TIL used, vac used), aggregate totals, signature block. Use `@media print` styles to make Cmd-P-able.

- [ ] **Step 2: PDF document**

Same shape via `@react-pdf/renderer`. Single A4 page when ≤ 12 weeks; paginates beyond.

- [ ] **Step 3: Route handler**

```ts
GET /api/admin/reports/period?user_id=...&from=...&to=...
→ application/pdf; attachment; filename="period-{code}-{from}-{to}.pdf"
```

Stream the buffer from `renderToStream`.

- [ ] **Step 4: Employee selector**

Page-level form: employee dropdown + date range + "Generate". Server query runs on submit (search params change → re-render preview).

---

### Task 6 — Balances snapshot

**Files:**
- Create: `web/lib/admin/reports/balances.ts`
- Create: `web/components/admin/reports/BalancesTable.tsx`
- Create: `web/app/(app)/admin/reports/balances/page.tsx`
- Create: `web/app/api/admin/reports/balances/route.ts`

- [ ] **Step 1: Query**

For each active user, return the latest `closing_balance` from `til_ledger` and `vacation_ledger` (`order by week_start desc limit 1`). Single query using `distinct on (user_id)`.

- [ ] **Step 2: UI**

`BalancesTable`: employee, code, position, TIL closing, vacation closing, as-of week. Sortable client-side. Download CSV button.

- [ ] **Step 3: Route**

`/api/admin/reports/balances` → `balances-snapshot-{date}.csv`.

---

### Task 7 — Reports landing + sub-nav

**Files:**
- Create: `web/app/(app)/admin/reports/layout.tsx`
- Create: `web/app/(app)/admin/reports/page.tsx`
- Modify: `web/components/shell/AdminSubnav.tsx` (add Reports tab)

- [ ] **Step 1: Sub-nav inside reports/**

Tabs: Payroll · Projects · Period · Balances. Same scrollable pattern as `AdminSubnav`.

- [ ] **Step 2: Landing**

Card grid: each report with a one-line description, last-generated indicator if we track it, and "Open" link.

- [ ] **Step 3: Top-level admin subnav**

Add `{ href: '/admin/reports', label: 'Reports', match: (p) => p.startsWith('/admin/reports') }` to `AdminSubnav.tsx`.

---

### Task 8 — E2E for one full report flow

**Files:**
- Create: `web/tests/e2e/admin-reports-payroll.spec.ts`

- [ ] **Step 1: Flow**

1. Provision an admin and one employee with one approved week.
2. Admin signs in → `/admin/reports/payroll` with `?from=2026-01-05&to=2026-01-18` (the relevant pay period).
3. Assert preview renders one row for that employee.
4. Click **Download CSV** → assert the download has the right filename and the row count matches the preview.
5. Validate header columns match the documented schema.

---

## Quality Gate (Done = all true)

- [ ] `v_period_summary` view materializes and matches `v_timesheet_totals` row counts for `status='approved'` weeks.
- [ ] Payroll CSV downloads and opens cleanly in Excel; numeric columns sum correctly per period.
- [ ] Hours-by-project report matches a manually-spot-checked week (pick a week, sum hours per project by hand, compare to UI).
- [ ] Period PDF renders with one employee's name, week table, totals, and signature line; opens in Acrobat/Preview without warnings.
- [ ] Balances snapshot CSV matches `/me/til` and `/me/vacation` for at least 3 spot-checked employees.
- [ ] All unit tests pass (`aggregatePayroll`, `aggregateByProject`).
- [ ] E2E payroll spec passes.
- [ ] No report leaks data: a non-admin hitting any `/api/admin/reports/*` route gets a 403.

---

## Risks & Open Questions

1. **Pay period epoch** — the spec doesn't fix the pay-period start date. Default to 2026-01-05 (a Monday) but expose it as `payroll_epoch` in `organizations` so it's editable without code changes.
2. **TIL payout treatment** — currently `TIL Payout` rows reduce the TIL bank but pay out as cash. The payroll export needs to surface this clearly so payroll knows the hours are "paid" not "worked". Confirm with maaz that `til_payout_hrs` as a separate column is the right shape.
3. **PDF dependency weight** — `@react-pdf/renderer` is ~500kb of server-side deps. Acceptable for an admin-only feature, but if we ever add a per-employee self-serve PDF download, revisit.
4. **Concurrency** — date-range queries hitting `v_period_summary` could be slow over the full table once we have years of data. Add an explicit index on `timesheets(week_start)` filtered to `status='approved'` if EXPLAIN shows seq scans.
5. **Excel "smart" date parsing** — using ISO dates (`2026-01-05`) and leading single-quote on employee codes (`'M001`) to avoid Excel auto-converting strings to numbers/dates. Decide if we tolerate the quote or accept the autoformatting trade-off.
