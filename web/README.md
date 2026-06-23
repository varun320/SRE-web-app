# SRE Timesheet — Web

Next.js 15 + Tailwind v4 + shadcn/ui + Supabase JS. Implements the spec at
`../docs/specs/2026-06-23-sre-timesheet-design.md`.

## Run

    cp .env.local.example .env.local         # paste anon + service-role keys from `supabase status`
    npm install
    npm run dev                              # http://localhost:3000

## Test

    npm run test:unit
    npm run test:e2e                         # needs SUPABASE_SERVICE_ROLE_KEY in .env.local

## Employee routes

- `/login` — password + magic-link sign-in
- `/week/current` — redirects to `/week/<this-monday>`
- `/week/[ws]` — weekly timesheet editor
- `/week/[ws]/report` — read-only weekly report
- `/me/til` — your TIL ledger history
- `/me/vacation` — your vacation ledger history

## Admin routes (admin role required)

- `/admin` — approval queue (submitted timesheets awaiting decision)
- `/admin/employees` — employee list
- `/admin/employees/new` — create employee (server action, uses service-role)
- `/admin/employees/[id]` — employee detail + balances + recent weeks
- `/admin/employees/[id]/week/[ws]` — review any employee's week, approve/decline/unlock
- `/admin/projects` — manage project numbers
- `/admin/positions` — manage annual vacation hours per position
- `/admin/approvals` — audit log (submit / approve / decline / unlock / ledger recomputes)
