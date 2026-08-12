# Repository refactor plan

**Goal:** make the repo more maintainable, readable, and easy to navigate as the codebase keeps growing (CRM Part B will add another feature-worth of files).

**Constraints:**
- No route URL changes.
- No behaviour changes.
- Minimum-error refactor: verify locally before each push.
- One feature at a time, one PR at a time.

---

## Target structure

```
web/
├── app/                            # Next.js routing only. Thin.
│   ├── (app)/
│   │   ├── projects/
│   │   │   ├── page.tsx            # imports from features/projects
│   │   │   ├── [number]/page.tsx
│   │   │   ├── board/page.tsx
│   │   │   └── actions.ts          # re-exports server actions
│   │   └── … other routes
│   ├── api/
│   ├── login/
│   └── globals.css
│
├── features/                       # Domain-specific slices
│   ├── projects/
│   │   ├── queries.ts
│   │   ├── types.ts
│   │   ├── actions/                # split when > 2 concerns
│   │   │   ├── tasks.ts
│   │   │   ├── projects.ts
│   │   │   └── templates.ts
│   │   └── components/
│   │       ├── Dashboard.tsx
│   │       ├── JobDetail.tsx
│   │       ├── TaskDrawer.tsx
│   │       └── …
│   ├── expenses/                   # queries, mutations, schemas, mcp, components, types, payment-status, receipts
│   ├── timesheet/
│   ├── clients/                    # + Directory bits
│   ├── notifications/              # incl. NotificationsBell + desktop.ts
│   └── crm/                        # future — Part B lands here fresh
│
├── shared/
│   ├── ui/                         # Button, Dialog, Skeleton, ShowMore, StatusBadge, …
│   ├── supabase/                   # client, server, middleware, admin
│   ├── hooks/                      # useIdle, useLinkStatus, …
│   └── lib/                        # dates, errors, role, utils, flags, totals, categoryDescriptions
│
├── middleware.ts                   # stays at root — Next requires it
├── scripts/
├── styles/
├── tests/
└── public/
```

`@/*` already maps to `./*` in `tsconfig.json`, so `@/features/*` and `@/shared/*` resolve automatically once the folders exist. No tsconfig change needed.

---

## Rules

1. **`app/` stays thin.** Only routing + tiny re-exports. If a `page.tsx` grows past ~50 lines of business logic, pull the guts into `features/*/components/`.
2. **Direct imports, no barrel files.** Prefer `import { fetchMyTasks } from '@/features/projects/queries'` over `from '@/features/projects'`. Barrels hurt tree-shaking and add ceremony.
3. **One-directional dependency.** A feature can import from `shared/*` and from other `features/*`, but only one way. Circular deps become an explicit code smell.
4. **Each feature owns its full slice.** Queries, actions, components, types, MCP (if any) — colocated. Nothing feature-specific lives in `shared/`.
5. **`shared/lib/` is utilities only.** Domain-specific helpers (`payment-status.ts`, `receipts.ts`, `notifications/format.ts`) belong to their feature.

---

## Migration order (safest first)

| # | Feature | Why this order | Risk |
|---|---|---|---|
| 1 | **projects** | Newest, self-contained, all mine | Low — pilot |
| 2 | **clients** | Small surface; feeds into projects | Low |
| 3 | **notifications** | Isolated | Low |
| 4 | **timesheet** | Deep MCP + admin coupling | Medium |
| 5 | **expenses** | Biggest — 20+ components spread across `admin/` + `expenses/` | High |
| 6 | **shared/** | Everything else lands after features move | Low — mostly renames |

**Per-step protocol:**
1. Create the target folder.
2. `git mv` files (preserves history).
3. Rewrite imports.
4. Run `npx tsc --noEmit` + `npx next build` locally — both must pass clean.
5. Manual smoke test of the affected routes locally.
6. Commit atomically (one feature per commit; per-file commits also OK if the diff is large).
7. Push only after local verification.

---

## Deliberately NOT in scope

- No monorepo / package split. One web app, one build.
- No barrel `index.ts` files.
- No route URL changes. `/projects`, `/expenses`, `/clients` stay identical.
- No architectural rewrite. Server actions stay server actions; RSC stays RSC.
- No test colocation. `tests/unit/` and `tests/e2e/` stay put; conflating two concerns in one PR bloats the diff.
- No renames of public identifiers (function names, component names, DB columns). Only file locations move.

---

## Known risks

- **Hidden feature coupling.** `components/admin/AdminExpensesTableBody.tsx` imports from `@/lib/expenses/payment-status`. Fine. But some `admin/` components silently pull from three features — I'll surface each as I move.
- **Import path churn.** Big diffs. Unavoidable, but atomic per-feature commits keep `git blame` readable.
- **Server-action file naming.** Next's `'use server'` files must actually be server-only. When splitting `app/(app)/projects/actions.ts`, each new file in `features/projects/actions/` must keep the `'use server'` directive at the top.

---

## Rollback

Each feature is one commit. If something breaks after push:
- `git revert <sha>` restores prior state cleanly.
- No DB migrations in this refactor → zero data risk.
