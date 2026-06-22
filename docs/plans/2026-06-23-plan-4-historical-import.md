# Plan 4 — Historical Excel Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring SRE Inc.'s existing per-employee Excel workbooks into the live system. Ship two import modes — **balances-only** (required for go-live) and **full-history** (optional). Both are idempotent, dry-run-first, and produce an auditable trail tagged `action='imported'` in the approval log.

**Architecture:** A Python CLI under `scripts/import/` (openpyxl + httpx) is the source of truth — it parses, validates, dry-runs, and writes via the Supabase REST API using the service-role key. A thin admin UI at `/admin/import` wraps the same logic: it uploads files, calls a Next.js route handler which shells out to the validator and returns a diff, then commits on confirmation. **No new business logic in the UI** — the UI just visualizes the CLI's structured output.

**Tech Stack additions:** Python 3.11+, `openpyxl`, `httpx`, `pydantic` (validation), `click` (CLI). Web: reuse existing Next.js 15.5 / Supabase JS stack; add a `multipart/form-data` route handler.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md` §9a
**Plan 1 (DONE):** `docs/plans/2026-06-23-plan-1-supabase-foundation.md`
**Plan 2 (DONE):** `docs/plans/2026-06-23-plan-2-employee-web.md`
**Plan 3 (DONE):** `docs/plans/2026-06-23-plan-3-admin-web.md`

---

## File Structure

```
SRE-app/
├── scripts/
│   └── import/
│       ├── pyproject.toml                       ← uv / pip project
│       ├── README.md                            ← run instructions
│       ├── sre_import/
│       │   ├── __init__.py
│       │   ├── cli.py                           ← `sre-import balances|history`
│       │   ├── config.py                        ← env: SUPABASE_URL, SERVICE_ROLE_KEY
│       │   ├── client.py                        ← thin Supabase REST wrapper (httpx)
│       │   ├── schema.py                        ← pydantic models matching DB
│       │   ├── parse/
│       │   │   ├── __init__.py
│       │   │   ├── balances_csv.py              ← parse opening-balances CSV
│       │   │   └── workbook.py                  ← parse one employee .xlsx → weeks
│       │   ├── plan.py                          ← build (writes, deletes, no-ops) diff
│       │   ├── apply.py                         ← execute the plan (transactional)
│       │   └── hash.py                          ← content hash for idempotency
│       └── tests/
│           ├── fixtures/
│           │   ├── balances_sample.csv
│           │   └── employee_sample.xlsx         ← copy of UC_SRE_Timesheet_Templet_2026.xlsx
│           ├── test_balances_csv.py
│           ├── test_workbook_parse.py
│           ├── test_plan_idempotent.py
│           └── test_apply_dryrun.py
├── supabase/
│   └── migrations/
│       ├── 20260624000001_approval_log_imported_action.sql
│       ├── 20260624000002_import_batches.sql
│       └── 20260624000003_rpc_apply_import.sql
└── web/
    ├── app/(app)/admin/
    │   └── import/
    │       ├── page.tsx                         ← upload + dry-run UI
    │       └── loading.tsx
    ├── app/api/admin/import/
    │   ├── dry-run/route.ts                     ← POST multipart → diff JSON
    │   └── commit/route.ts                      ← POST batch_id → apply
    ├── components/admin/
    │   ├── ImportUploader.tsx                   ← file input + mode toggle
    │   ├── ImportDiffTable.tsx                  ← shows planned writes
    │   └── ImportConfirmBar.tsx                 ← commit / cancel
    └── lib/admin/
        └── import.ts                            ← TanStack mutations
```

Conventions: Python files <300 lines, one responsibility each. The CLI is the canonical entry point; the web layer is a thin wrapper. Dry-run output is JSON so the UI can render it deterministically.

---

### Task 1 — DB migrations: `imported` action + import batch tracking

**Files:**
- Create: `supabase/migrations/20260624000001_approval_log_imported_action.sql`
- Create: `supabase/migrations/20260624000002_import_batches.sql`
- Create: `supabase/migrations/20260624000003_rpc_apply_import.sql`

- [ ] **Step 1: Add `imported` to `approval_log.action` constraint**

Check current CHECK constraint on `approval_log.action` (likely `submit|approve|decline|unlock`). Drop and re-add with `imported` included. Backfill not needed (no existing imported rows).

- [ ] **Step 2: `import_batches` table**

```sql
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  imported_by uuid not null references users(id),
  mode text not null check (mode in ('balances', 'history')),
  source_filename text not null,
  source_hash text not null,                    -- sha256 of upload
  created_at timestamptz not null default now(),
  committed_at timestamptz,                     -- null = dry-run only
  summary jsonb not null,                       -- counts, warnings
  unique (org_id, source_hash, mode)            -- idempotency: same file = same batch
);
```

RLS: admin-only read/write.

- [ ] **Step 3: `apply_import_batch` RPC**

A SECURITY DEFINER function called by the CLI/route handler with a pre-validated payload. Inserts ledger rows (balances mode) or `timesheets` + `timesheet_entries` + `til_ledger` + `vacation_ledger` + `approval_log` rows (history mode) inside one transaction. Marks the batch `committed_at = now()`. Re-running with the same `source_hash` returns the existing `import_batches` row without re-applying.

Signature: `apply_import_batch(p_batch_id uuid, p_payload jsonb) returns jsonb` (returns `{applied: n, skipped: n}`).

- [ ] **Step 4: Verify migrations**

```bash
cd supabase && supabase db reset
psql $DATABASE_URL -c "\d import_batches"
psql $DATABASE_URL -c "select pg_get_constraintdef(oid) from pg_constraint where conname like '%approval_log%action%';"
```

Expected: constraint includes `'imported'`; `import_batches` has the unique key.

---

### Task 2 — Python project scaffold + Supabase client

**Files:**
- Create: `scripts/import/pyproject.toml`
- Create: `scripts/import/sre_import/__init__.py`
- Create: `scripts/import/sre_import/config.py`
- Create: `scripts/import/sre_import/client.py`
- Create: `scripts/import/README.md`

- [ ] **Step 1: `pyproject.toml`**

Declare deps: `openpyxl>=3.1`, `httpx>=0.27`, `pydantic>=2.6`, `click>=8.1`, `python-dateutil>=2.9`. Dev: `pytest`, `pytest-mock`. Use `uv` for install.

- [ ] **Step 2: `config.py`**

Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env (fail fast if missing — never default). Expose a typed `Settings` pydantic model.

- [ ] **Step 3: `client.py`**

Thin httpx wrapper around the Supabase REST API:
- `rpc(name, payload)` — POST `/rest/v1/rpc/{name}`
- `select(table, query)` — GET `/rest/v1/{table}?{query}`
- `insert(table, rows)` — POST `/rest/v1/{table}`

Headers: `Authorization: Bearer {service_role}`, `apikey: {service_role}`, `Content-Type: application/json`, `Prefer: return=representation`.

- [ ] **Step 4: Smoke test**

`python -c "from sre_import.client import Client; print(Client().select('users', 'select=id&limit=1'))"` returns at least one row.

---

### Task 3 — Balances CSV parser + plan + apply

**Files:**
- Create: `scripts/import/sre_import/parse/balances_csv.py`
- Create: `scripts/import/sre_import/schema.py`
- Create: `scripts/import/sre_import/hash.py`
- Create: `scripts/import/sre_import/plan.py`
- Create: `scripts/import/sre_import/apply.py`
- Create: `scripts/import/tests/fixtures/balances_sample.csv`
- Create: `scripts/import/tests/test_balances_csv.py`

CSV columns (required): `employee_code, position, til_opening_hrs, vacation_opening_hrs, as_of_date` (ISO date).

- [ ] **Step 1: Pydantic models in `schema.py`**

`BalanceRow`, `WeekEntryRow`, `WeekRow`, `ImportPlan` (balances + weeks lists), `PlanDiff` (per-row action: `create|skip|update|conflict`).

- [ ] **Step 2: Parser**

`parse_balances_csv(path: Path) -> list[BalanceRow]`. Validates each row, raises `ValidationError` with row number on bad input. Rejects unknown employee codes by cross-checking against `/users?select=employee_code` after parsing (the planner does this, not the parser).

- [ ] **Step 3: Idempotency hash**

`hash.py` exposes `file_sha256(path) -> str`. Used as `source_hash` for the `import_batches` row.

- [ ] **Step 4: Planner**

`plan.py`: `build_balances_plan(rows, client) -> ImportPlan`:
- For each `BalanceRow`, look up user by `employee_code`. Missing → `conflict` with reason.
- For each user, query `til_ledger` and `vacation_ledger` for any row at or before `as_of_date - 7d`. If a matching frozen synthetic row already exists → `skip`. Else → `create`.
- Return structured `ImportPlan` with counts.

- [ ] **Step 5: Apply**

`apply.py`: `apply_plan(plan, client, batch_id)`. Calls `apply_import_batch` RPC with the JSON payload. Returns `{applied, skipped}` from the RPC.

- [ ] **Step 6: Tests**

`test_balances_csv.py`:
- Valid CSV → list of `BalanceRow` with correct types.
- Missing column → `ValidationError`.
- Negative hours → rejected.
- Non-ISO date → rejected.

---

### Task 4 — Workbook (xlsx) parser for full history

**Files:**
- Create: `scripts/import/sre_import/parse/workbook.py`
- Create: `scripts/import/tests/fixtures/employee_sample.xlsx` (copy of `UC_SRE_Timesheet_Templet_2026.xlsx`)
- Create: `scripts/import/tests/test_workbook_parse.py`

The workbook has a `Weekly Timesheet` sheet with one block per week. Identify weeks by Monday date in column A header rows. Each week has rows with: main category, sub category, project number, Mon..Sun hours, description.

- [ ] **Step 1: Locate the Weekly Timesheet sheet**

`load_workbook(path, data_only=True)` then `wb['Weekly Timesheet']`. Fail with clear error if missing.

- [ ] **Step 2: Week-block extraction**

Walk rows top-to-bottom. Recognize a new week header by a date cell in the known week-marker column. Capture all entry rows until the next header or the totals footer.

- [ ] **Step 3: Row normalization**

For each captured row:
- Map workbook category labels to `sub_categories.name` (exact match; fall back to a small alias map, e.g. trim whitespace, normalize "&" vs "and").
- Validate project number format `YYYYNNN` (7-digit int) when main_category = 'Project'.
- Drop fully-empty rows (all hours = 0 and no description).
- Reject rows that have hours but no description (matches DB CHECK).

- [ ] **Step 4: Output structure**

`parse_workbook(path, employee_code) -> list[WeekRow]` where each `WeekRow` has `week_start: date` and `entries: list[WeekEntryRow]`.

- [ ] **Step 5: Tests**

- Parse the fixture workbook → expected number of weeks.
- Specific known row's hours match.
- Unknown sub-category → `ValidationError` naming the sheet row.
- A week with all-zero rows → skipped (not produced).

---

### Task 5 — History planner + ledger replay

**Files:**
- Modify: `scripts/import/sre_import/plan.py` (add `build_history_plan`)
- Modify: `scripts/import/sre_import/apply.py` (history payload shape)
- Create: `scripts/import/tests/test_plan_idempotent.py`

- [ ] **Step 1: `build_history_plan(weeks, user_id, client) -> ImportPlan`**

Sort `weeks` chronologically. For each:
- Query `timesheets` for `(user_id, week_start)`. If exists and `status='approved'` with the same content hash → `skip`. If exists with different content → `conflict`. Else → `create`.
- Compute per-week `overtime_earned` and `til_used` / `vacation_used` from entries using the same rules as `compute_totals` in `web/lib/totals.ts` (port the logic; keep the constants in one place — `scripts/import/sre_import/rules.py` mirrors the TS file).

- [ ] **Step 2: Payload for `apply_import_batch`**

JSON shape:
```json
{
  "user_id": "...",
  "weeks": [
    {
      "week_start": "2025-11-03",
      "entries": [{ "main_category": "Project", "sub_category_id": "...", ... }],
      "til_delta": { "earned": 4, "used": 0 },
      "vacation_delta": { "used": 0 }
    }
  ]
}
```

RPC inserts rows in this order: `timesheets` (status='approved'), `timesheet_entries`, `til_ledger` row, `vacation_ledger` row, `approval_log` (action='imported'). All in one transaction per batch.

- [ ] **Step 3: Idempotency test**

`test_plan_idempotent.py`: run plan + apply twice with the same input → second run reports all `skip`, DB row count unchanged.

---

### Task 6 — CLI

**Files:**
- Create: `scripts/import/sre_import/cli.py`

- [ ] **Step 1: `sre-import balances`**

```
sre-import balances <csv-path> [--dry-run | --commit] [--actor-email <email>]
```

`--dry-run` (default): parse, plan, print diff table to stdout, write `plan.json` next to the CSV. No DB writes.
`--commit`: same as dry-run, then call `apply`. Requires `--actor-email` to attribute the import.

- [ ] **Step 2: `sre-import history`**

```
sre-import history <xlsx-path> --employee-code <code> [--dry-run | --commit] [--actor-email <email>]
```

Same flag semantics. Refuses to commit unless the corresponding balances import has run for this employee (planner returns `conflict` with hint).

- [ ] **Step 3: Output**

Dry-run prints a table: `action | week_start | entries | til_delta | vacation_delta | reason`. Commit prints the same plus the final `{applied, skipped}` counts.

- [ ] **Step 4: Smoke test**

```bash
sre-import balances tests/fixtures/balances_sample.csv --dry-run
sre-import history tests/fixtures/employee_sample.xlsx --employee-code E001 --dry-run
```

Both exit 0 and print non-empty diffs.

---

### Task 7 — Admin web UI: `/admin/import`

**Files:**
- Create: `web/app/(app)/admin/import/page.tsx`
- Create: `web/app/(app)/admin/import/loading.tsx`
- Create: `web/components/admin/ImportUploader.tsx`
- Create: `web/components/admin/ImportDiffTable.tsx`
- Create: `web/components/admin/ImportConfirmBar.tsx`
- Create: `web/lib/admin/import.ts`
- Modify: `web/components/shell/AdminSubnav.tsx` (add Import tab)

- [ ] **Step 1: Page shell**

Two tabs: **Balances** and **History**. Each shows an `<ImportUploader>` (file input + mode-specific helper text), then a `<ImportDiffTable>` after dry-run, then a `<ImportConfirmBar>` with Commit / Cancel.

- [ ] **Step 2: Uploader**

`ImportUploader.tsx`: accepts `.csv` (balances) or `.xlsx` (history). For history, also requires an employee selector (dropdown from `users` list). Submits to `/api/admin/import/dry-run` and renders the returned diff.

- [ ] **Step 3: Diff table**

`ImportDiffTable.tsx`: columns `Action | Target | Detail | Reason`. Color-codes `create` (green), `skip` (muted), `conflict` (red). Renders structured `summary` block at the top (counts, warnings).

- [ ] **Step 4: Confirm bar**

`ImportConfirmBar.tsx`: shows `{create_count} to apply, {conflict_count} conflicts must be resolved first` (Commit disabled if conflicts > 0). On Commit, POSTs to `/api/admin/import/commit` with the `batch_id` returned from dry-run.

- [ ] **Step 5: Subnav entry**

Add `{ href: '/admin/import', label: 'Import', match: (p) => p.startsWith('/admin/import') }` to `ITEMS` in `AdminSubnav.tsx`.

---

### Task 8 — API route handlers

**Files:**
- Create: `web/app/api/admin/import/dry-run/route.ts`
- Create: `web/app/api/admin/import/commit/route.ts`

Both routes:
- Verify caller is admin via `fetchIsAdmin`. 403 otherwise.
- Use the service-role Supabase client (not user client).

- [ ] **Step 1: Dry-run handler**

`POST /api/admin/import/dry-run`:
- Accepts `multipart/form-data`: `file`, `mode` (`balances|history`), `employee_code?` (history only).
- Writes upload to a tempfile, computes sha256, checks `import_batches` for existing `(source_hash, mode)` row — if found, returns its stored plan.
- Else: shells out to `sre-import {mode} <tempfile> --dry-run --json` (the CLI gains a `--json` flag in Task 6 — add it now). Inserts a new `import_batches` row with `committed_at=null` and the plan JSON in `summary`.
- Returns `{ batch_id, plan, summary }`.

- [ ] **Step 2: Commit handler**

`POST /api/admin/import/commit`:
- Body: `{ batch_id }`.
- Loads the batch, calls `apply_import_batch(batch_id, plan_payload)` RPC.
- Returns `{ applied, skipped }`.

- [ ] **Step 3: Shell-out safety**

Whitelist the CLI binary path; never interpolate user input into the shell string — pass paths as `execFile` args.

---

### Task 9 — End-to-end test

**Files:**
- Create: `web/tests/e2e/admin-import-flow.spec.ts`

- [ ] **Step 1: Test flow**

1. Seed two users (admin + employee `E001`).
2. Admin logs in → navigates `/admin/import` → uploads `balances_sample.csv` → sees diff with 1 `create` row for `E001` → clicks Commit.
3. Switch to employee `E001` → opens `/me/til` → sees opening balance matches the CSV.
4. Admin re-uploads the same CSV → sees `skip` (idempotency proof) → Commit button disabled.

---

## Quality Gate (Done = all true)

- [ ] CLI runs dry-run against the real `UC_SRE_Timesheet_Templet_2026.xlsx` without crashing.
- [ ] Balances import for a real employee produces the expected opening TIL + vacation visible at `/me/til` and `/me/vacation`.
- [ ] Re-running the same CSV is a no-op (zero new rows, batch reused).
- [ ] Full-history import for one fixture employee replays through the ledger and matches the workbook's TIL closing balance to the cent (within rounding tolerance documented in `rules.py`).
- [ ] `/admin/import` UI shows the diff before commit; conflicts block commit.
- [ ] `approval_log` shows one `action='imported'` row per imported week, attributed to the admin who ran the import.
- [ ] All Python tests pass: `cd scripts/import && pytest`.
- [ ] E2E spec passes: `cd web && pnpm playwright test admin-import-flow`.

---

## Risks & Open Questions

1. **Workbook layout drift** — older employee files may have different row offsets than the 2026 template. Mitigation: keep the parser tolerant (search for headers rather than fixed row indexes) and surface every unmatched row as a `conflict`, not a silent skip.
2. **Sub-category alias map** — the workbook may spell categories differently across years. Build the alias map empirically from the first real import; commit it to `parse/aliases.py`.
3. **Decimal rounding** — Excel stores hours as floats; Postgres `numeric(5,2)` rounds. Test that round-trip matches.
4. **Who is `decided_by` for imported rows** — the admin running the import (per spec). Confirm with maaz before commit.
5. **Project numbers not yet in `projects` table** — historical weeks may reference projects we never seeded. Two options: (a) auto-create with `status='closed'`, (b) fail with a list of missing project numbers and require admin to seed them first. **Recommend (b)** for safety; surface the list in the dry-run diff.
