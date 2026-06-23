# SRE Timesheet

Web app replacing the SRE Inc. weekly timesheet Excel workbook.

See `docs/specs/2026-06-23-sre-timesheet-design.md` for the full design.

## Plan 1: Supabase Foundation

Run locally:

    supabase start
    supabase db reset    # applies migrations + seed
    supabase test db     # runs pgTAP tests
