# SRE Timesheet

Web app replacing the SRE Inc. weekly timesheet Excel workbook.

See `docs/specs/2026-06-23-sre-timesheet-design.md` for the design and
`docs/plans/` for implementation plans.

## Plan 1: Supabase Foundation — COMPLETE

The backend is feature-complete: 19 migrations, 23 seeded sub-categories,
4 positions, RLS on every table, 5 RPCs (`create_or_get_week`,
`submit_timesheet`, `approve_timesheet`, `decline_timesheet`,
`unlock_timesheet`) with ledger freeze + recompute cascade, and 30
pgTAP assertions covering RLS isolation, FSM transitions, OT math, and
the unlock cascade.

Run locally:

    supabase start
    supabase db reset    # applies migrations + seed
    supabase test db     # runs pgTAP tests

## What's next

- Plan 2: Employee web app (Next.js + Supabase Auth)
- Plan 3: Admin web app (approvals, user/project management)
- Plan 4: Historical importer (Excel → DB)
