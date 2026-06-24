# Plan 2 — Employee Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the employee-facing Next.js web app that lets an employee sign in (email+password or magic-link), edit the current week's timesheet, submit it, see the read-only weekly report once submitted, and browse their TIL/vacation ledger history.

**Architecture:** Next.js 15 App Router + React Server Components + Tailwind v4 + shadcn/ui base + TanStack Query for client mutations + Zod for validation + `@supabase/ssr` for cookie-based auth. The app is a thin shell over the Supabase RPCs/views from Plan 1 — no business logic in client code; the DB is the source of truth. Live edits in the entry table mirror `v_timesheet_totals` math in the client purely for UX, never for validation.

**Tech Stack:** Next.js 15.5+, React 19, TypeScript 5.5+, Tailwind v4, shadcn/ui (Radix), TanStack Query v5, Zod 3, `@supabase/ssr`, `@supabase/supabase-js`, Playwright 1.49+, Vitest 2.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md`
**Plan 1 (DONE):** `docs/plans/2026-06-23-plan-1-supabase-foundation.md`

**Repo-layout deviation from spec:** the spec sketched a `apps/web/` pnpm workspace; v1 puts the Next.js app at `web/` directly to skip workspace plumbing (YAGNI — we promote to a workspace if Plan 4's importer needs shared code).

---

## File Structure

```
SRE-app/
├── supabase/  (from Plan 1)
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts            ← Tailwind v4 (mostly CSS-first; this file is minimal)
│   ├── postcss.config.mjs
│   ├── .env.local.example
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── components.json               ← shadcn config
│   ├── app/
│   │   ├── layout.tsx                ← root layout (theme, fonts, providers)
│   │   ├── globals.css               ← Tailwind directives + design tokens
│   │   ├── providers.tsx             ← QueryClient, Theme
│   │   ├── page.tsx                  ← redirects to /week/current
│   │   ├── login/
│   │   │   ├── page.tsx              ← sign-in (password + magic-link tabs)
│   │   │   └── actions.ts            ← server actions for sign-in
│   │   ├── auth/
│   │   │   ├── callback/route.ts     ← magic-link callback
│   │   │   └── signout/route.ts
│   │   ├── (app)/                    ← authed routes group
│   │   │   ├── layout.tsx            ← app shell with header + nav
│   │   │   ├── week/
│   │   │   │   ├── current/page.tsx  ← redirect to /week/<this-monday>
│   │   │   │   └── [week_start]/
│   │   │   │       ├── page.tsx      ← editor (RSC + client island)
│   │   │   │       └── report/page.tsx
│   │   │   └── me/
│   │   │       ├── til/page.tsx
│   │   │       └── vacation/page.tsx
│   │   └── middleware.ts             ← auth guard
│   ├── components/
│   │   ├── ui/                       ← shadcn-installed primitives (button, input, select, dialog, badge, table, ...)
│   │   ├── timesheet/
│   │   │   ├── EntryTable.tsx        ← client component, holds local row state
│   │   │   ├── EntryRow.tsx
│   │   │   ├── CategoryCell.tsx      ← cascading main/sub-cat select
│   │   │   ├── ProjectCell.tsx       ← project typeahead
│   │   │   ├── HourCell.tsx          ← numeric input ≥ 0 step 0.25
│   │   │   ├── KpiStrip.tsx          ← live-computed KPIs
│   │   │   ├── StatusBanner.tsx
│   │   │   └── totals.ts             ← pure functions mirroring v_timesheet_totals
│   │   ├── report/
│   │   │   ├── DailyBreakdown.tsx
│   │   │   ├── CategoryTable.tsx
│   │   │   ├── SubCategoryTable.tsx
│   │   │   └── ProjectTable.tsx
│   │   └── shell/
│   │       ├── Header.tsx
│   │       └── NavTabs.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             ← server-side supabase client
│   │   │   ├── client.ts             ← browser-side supabase client
│   │   │   └── middleware.ts         ← refresh-session helper
│   │   ├── types.ts                  ← shared TS types (TimesheetEntry, etc.)
│   │   ├── schemas.ts                ← Zod schemas
│   │   ├── dates.ts                  ← week_start helpers (Monday math)
│   │   ├── queries.ts                ← typed Supabase queries (named exports)
│   │   └── totals.ts                 ← (alias of components/timesheet/totals.ts? prefer here)
│   ├── styles/
│   │   └── tokens.css                ← OKLCH palette + spacing + typography custom properties
│   └── tests/
│       ├── unit/
│       │   ├── totals.test.ts
│       │   └── dates.test.ts
│       └── e2e/
│           ├── auth.spec.ts
│           ├── timesheet-happy.spec.ts
│           └── decline-resubmit.spec.ts
└── docs/  (existing)
```

Pure functions live in `lib/`. Components live in `components/`. Each file under `components/timesheet/` has one responsibility (~150 lines max). The pure totals function in `lib/totals.ts` is tested in isolation; the entry table uses it for live UX but the DB view is the source of truth at submit time.

---

### Task 1: Scaffold Next.js + TypeScript + Tailwind v4

**Files:**
- Create: `web/` directory (everything under it)
- Create: `web/.env.local.example`

- [ ] **Step 1: Scaffold via `create-next-app`**

Run from `D:\projects\prodigy-ai\projects\SRE-app`:
```bash
npx create-next-app@latest web --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*" --turbopack
```
Accept all defaults non-interactively. This creates `web/package.json`, `web/app/`, `web/tsconfig.json`, etc.

- [ ] **Step 2: Pin versions and confirm React 19**

Open `web/package.json`. Expected: `next ^15`, `react ^19`. If lower, run `npm install next@latest react@latest react-dom@latest` inside `web/`.

- [ ] **Step 3: Install runtime deps**

From `web/`:
```bash
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zod date-fns clsx class-variance-authority tailwind-merge lucide-react next-themes
npm install -D @types/node prettier
```

- [ ] **Step 4: Write `.env.local.example`**

Create `web/.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=__paste_from_supabase_status__
```
Copy to `.env.local` and paste the anon key from `supabase status` (do NOT commit `.env.local`).

- [ ] **Step 5: Smoke test**

From `web/`:
```bash
npm run dev
```
Open `http://localhost:3000` — should see the Next.js default page. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold next.js 15 + tailwind + supabase deps"
```

---

### Task 2: Design tokens + base layout + shadcn init

**Files:**
- Create: `web/styles/tokens.css`
- Modify: `web/app/globals.css`
- Modify: `web/app/layout.tsx`
- Create: `web/app/providers.tsx`
- Create: `web/components.json` (via `shadcn init`)

- [ ] **Step 1: Initialise shadcn**

From `web/`:
```bash
npx shadcn@latest init -y --base-color neutral
```
Accept defaults. This generates `components.json` and updates `tailwind.config.ts` + `globals.css` with shadcn base.

- [ ] **Step 2: Install the shadcn primitives we'll use**

```bash
npx shadcn@latest add button input select dialog dropdown-menu table badge tabs sonner label separator skeleton
```

- [ ] **Step 3: Write `web/styles/tokens.css`**

```css
/* Design tokens — see spec §7. */
:root {
  --color-surface: oklch(98% 0.005 90);
  --color-surface-2: oklch(96% 0.006 90);
  --color-text: oklch(20% 0.01 90);
  --color-text-muted: oklch(50% 0.01 90);
  --color-border: oklch(90% 0.005 90);

  --color-accent: oklch(58% 0.15 250);
  --color-status-draft: oklch(60% 0.01 90);
  --color-status-submitted: oklch(58% 0.15 250);
  --color-status-approved: oklch(62% 0.16 150);
  --color-status-declined: oklch(70% 0.16 60);

  --radius: 4px;
  --space-section: clamp(1.5rem, 1rem + 1.5vw, 2.5rem);

  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

.dark {
  --color-surface: oklch(16% 0.01 90);
  --color-surface-2: oklch(20% 0.01 90);
  --color-text: oklch(96% 0.005 90);
  --color-text-muted: oklch(70% 0.01 90);
  --color-border: oklch(28% 0.01 90);
}
```

- [ ] **Step 4: Update `web/app/globals.css` to import tokens and set defaults**

At the TOP of `web/app/globals.css` (before shadcn's `@tailwind` directives or `@import "tailwindcss"`), add:
```css
@import "../styles/tokens.css";
```

At the BOTTOM, add:
```css
body {
  background: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-sans);
}
:where(td, th) {
  font-variant-numeric: tabular-nums;
}
.font-mono { font-family: var(--font-mono); }
```

- [ ] **Step 5: Write `web/app/providers.tsx`**

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      <QueryClientProvider client={client}>
        {children}
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 6: Wire providers + Inter font in `web/app/layout.tsx`**

Replace `web/app/layout.tsx` content with:
```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-google', display: 'swap' });

export const metadata: Metadata = { title: 'SRE Timesheet', description: 'Weekly timesheet for SRE Inc.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Smoke test**

```bash
npm run dev
```
Open `http://localhost:3000` — page should render with Inter font and no console errors. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat(web): design tokens, shadcn init, root providers"
```

---

### Task 3: Supabase clients + types + middleware

**Files:**
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/supabase/client.ts`
- Create: `web/lib/supabase/middleware.ts`
- Create: `web/middleware.ts`
- Create: `web/lib/types.ts`
- Create: `web/lib/dates.ts`

- [ ] **Step 1: Write the server-side client**

`web/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Write the browser client**

`web/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write the middleware helper**

`web/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
                    || request.nextUrl.pathname.startsWith('/auth');
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 4: Write `web/middleware.ts`**

```ts
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 5: Write shared types**

`web/lib/types.ts`:
```ts
export type MainCategory = 'Project' | 'Admin' | 'Office & Sales';
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'declined';

export interface SubCategory {
  id: string;
  main_category: MainCategory;
  name: string;
  requires_project: boolean;
  consumes_til: boolean;
  consumes_vacation: boolean;
  is_overtime_taken: boolean;
  sort_order: number;
}

export interface Project {
  id: string;
  project_number: number;
  name: string;
  status: 'active' | 'closed';
}

export interface TimesheetEntryDraft {
  id?: string;
  main_category: MainCategory | '';
  sub_category_id: string | null;
  project_id: string | null;
  mon_hrs: number;
  tue_hrs: number;
  wed_hrs: number;
  thu_hrs: number;
  fri_hrs: number;
  sat_hrs: number;
  sun_hrs: number;
  description: string;
  position: number;
}

export interface Timesheet {
  id: string;
  user_id: string;
  week_start: string;        // YYYY-MM-DD
  status: TimesheetStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  locked: boolean;
}
```

- [ ] **Step 6: Write date helpers**

`web/lib/dates.ts`:
```ts
import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export function currentMonday(d: Date = new Date()): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function isMondayISO(iso: string): boolean {
  const d = parseISO(iso);
  return d.getDay() === 1;
}

export function weekDays(weekStartISO: string): string[] {
  const start = parseISO(weekStartISO);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

export const DAY_KEYS = ['mon_hrs','tue_hrs','wed_hrs','thu_hrs','fri_hrs','sat_hrs','sun_hrs'] as const;
export type DayKey = typeof DAY_KEYS[number];
```

- [ ] **Step 7: Smoke test (typecheck)**

From `web/`:
```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat(web): supabase clients, auth middleware, shared types, date helpers"
```

---

### Task 4: Pure totals function with unit tests

**Files:**
- Create: `web/lib/totals.ts`
- Create: `web/tests/unit/totals.test.ts`
- Create: `web/tests/unit/dates.test.ts`
- Create: `web/vitest.config.ts`
- Modify: `web/package.json` (add scripts + vitest dep)

- [ ] **Step 1: Add vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

Add to `web/package.json` `"scripts"`:
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 2: Write `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
});
```

- [ ] **Step 3: Write failing tests first (TDD)**

`web/tests/unit/totals.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/totals';
import type { TimesheetEntryDraft, SubCategory } from '@/lib/types';

const subs = {
  admin_regular:  { id: 'a1', main_category: 'Admin' as const, name: 'Administrative', requires_project: false, consumes_til: false, consumes_vacation: false, is_overtime_taken: false, sort_order: 60 },
  admin_payout:   { id: 'a2', main_category: 'Admin' as const, name: 'TIL Payout',     requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: false, sort_order: 20 },
  admin_overtaken:{ id: 'a3', main_category: 'Admin' as const, name: 'Overtime Taken', requires_project: false, consumes_til: true,  consumes_vacation: false, is_overtime_taken: true,  sort_order: 10 },
  admin_vacation: { id: 'a4', main_category: 'Admin' as const, name: 'Vacation Hours', requires_project: false, consumes_til: false, consumes_vacation: true,  is_overtime_taken: false, sort_order: 40 },
} satisfies Record<string, SubCategory>;

function row(sub: SubCategory, hrs: Partial<Record<'mon_hrs'|'tue_hrs'|'wed_hrs'|'thu_hrs'|'fri_hrs'|'sat_hrs'|'sun_hrs', number>>): TimesheetEntryDraft {
  return {
    main_category: sub.main_category, sub_category_id: sub.id, project_id: null,
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
    ...hrs, description: 'x', position: 0,
  };
}

describe('computeTotals', () => {
  it('sums total hours across all rows and days', () => {
    const rows = [
      row(subs.admin_regular, { mon_hrs: 8, tue_hrs: 8 }),
      row(subs.admin_regular, { wed_hrs: 4 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.total_hrs).toBe(20);
  });

  it('computes per-day overtime as max(0, day_total - 8) excluding TIL Payout rows', () => {
    const rows = [
      row(subs.admin_regular, { mon_hrs: 10, tue_hrs: 10, wed_hrs: 8 }),  // OT = 2 + 2 = 4
      row(subs.admin_payout,  { mon_hrs: 4 }),                            // excluded from OT base
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.overtime_earned).toBe(4);
  });

  it('counts TIL used as sum of consumes_til rows (Overtime Taken + TIL Payout)', () => {
    const rows = [
      row(subs.admin_overtaken, { mon_hrs: 8 }),
      row(subs.admin_payout,    { tue_hrs: 4 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.til_used).toBe(12);
  });

  it('counts vacation used as sum of consumes_vacation rows', () => {
    const rows = [
      row(subs.admin_vacation, { mon_hrs: 8, tue_hrs: 8 }),
    ];
    const t = computeTotals(rows, Object.values(subs));
    expect(t.vacation_used).toBe(16);
  });
});
```

`web/tests/unit/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { currentMonday, isMondayISO, weekDays } from '@/lib/dates';

describe('dates', () => {
  it('currentMonday returns a Monday', () => {
    expect(isMondayISO(currentMonday(new Date('2026-04-09')))).toBe(true);  // Thu → returns Mon Apr 6
    expect(currentMonday(new Date('2026-04-09'))).toBe('2026-04-06');
  });

  it('weekDays returns 7 dates starting from given Monday', () => {
    expect(weekDays('2026-04-06')).toEqual([
      '2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-11','2026-04-12',
    ]);
  });

  it('isMondayISO is false for non-Monday', () => {
    expect(isMondayISO('2026-04-07')).toBe(false);
  });
});
```

Run `npm run test:unit` — expect FAILs because `computeTotals` doesn't exist yet (dates already exists from Task 3, so those should pass).

- [ ] **Step 4: Write `web/lib/totals.ts`**

```ts
import type { SubCategory, TimesheetEntryDraft } from './types';
import { DAY_KEYS } from './dates';

export interface TimesheetTotals {
  total_hrs: number;
  overtime_earned: number;
  til_used: number;
  vacation_used: number;
}

export function computeTotals(
  rows: readonly TimesheetEntryDraft[],
  subCategories: readonly SubCategory[],
): TimesheetTotals {
  const subById = new Map(subCategories.map((s) => [s.id, s]));
  let total_hrs = 0;
  let til_used = 0;
  let vacation_used = 0;
  const dayBaseTotals: Record<typeof DAY_KEYS[number], number> = {
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
  };

  for (const row of rows) {
    const sub = row.sub_category_id ? subById.get(row.sub_category_id) : undefined;
    const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
    total_hrs += rowTotal;
    if (sub?.consumes_til) til_used += rowTotal;
    if (sub?.consumes_vacation) vacation_used += rowTotal;

    if (sub?.name !== 'TIL Payout') {
      for (const k of DAY_KEYS) dayBaseTotals[k] += row[k] || 0;
    }
  }

  const overtime_earned = DAY_KEYS.reduce((acc, k) => acc + Math.max(0, dayBaseTotals[k] - 8), 0);
  return { total_hrs, overtime_earned, til_used, vacation_used };
}
```

- [ ] **Step 5: Run tests, expect green**

```bash
npm run test:unit
```
Expected: 7 tests pass (4 totals + 3 dates).

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): pure totals + dates with unit tests"
```

---

### Task 5: Auth — login page + callback + signout

**Files:**
- Create: `web/app/login/page.tsx`
- Create: `web/app/login/actions.ts`
- Create: `web/app/auth/callback/route.ts`
- Create: `web/app/auth/signout/route.ts`

- [ ] **Step 1: Write server actions**

`web/app/login/actions.ts`:
```ts
'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect('/');
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Write the login page**

`web/app/login/page.tsx`:
```tsx
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInWithPassword, sendMagicLink } from './actions';
import { toast } from 'sonner';

export default function LoginPage() {
  const [pending, start] = useTransition();
  const [magicSent, setMagicSent] = useState(false);

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">SRE Timesheet</h1>
        <Tabs defaultValue="password">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form
              action={(fd) => start(async () => {
                const res = await signInWithPassword(fd);
                if (res?.error) toast.error(res.error);
              })}
              className="space-y-3 mt-4"
            >
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form
              action={(fd) => start(async () => {
                const res = await sendMagicLink(fd);
                if (res?.error) toast.error(res.error);
                else { setMagicSent(true); toast.success('Magic link sent — check your inbox'); }
              })}
              className="space-y-3 mt-4"
            >
              <Label htmlFor="magic-email">Email</Label>
              <Input id="magic-email" name="email" type="email" required autoComplete="email" />
              <Button type="submit" disabled={pending || magicSent} className="w-full">
                {magicSent ? 'Link sent' : pending ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write callback route**

`web/app/auth/callback/route.ts`:
```ts
import { getSupabaseServer } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await getSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
```

- [ ] **Step 4: Write signout route**

`web/app/auth/signout/route.ts`:
```ts
import { getSupabaseServer } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
```

- [ ] **Step 5: Smoke test**

Start `supabase start` if not running, then `cd web && npm run dev`. Visit `http://localhost:3000`. You should be redirected to `/login`. Submit invalid creds → toast shows error. (You can create a test user via Supabase Studio at `http://127.0.0.1:54323` if needed; that's covered in Task 14's E2E setup.)

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): login page with password + magic-link, auth callback, signout"
```

---

### Task 6: App shell — root redirect, layout, header, /week/current

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/app/(app)/layout.tsx`
- Create: `web/components/shell/Header.tsx`
- Create: `web/app/(app)/week/current/page.tsx`

- [ ] **Step 1: Root redirect**

Replace `web/app/page.tsx` with:
```tsx
import { redirect } from 'next/navigation';
export default function Root() { redirect('/week/current'); }
```

- [ ] **Step 2: Header component**

`web/components/shell/Header.tsx`:
```tsx
import Link from 'next/link';

export function Header({ email }: { email: string }) {
  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/week/current" className="font-semibold tracking-tight">SRE Timesheet</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/week/current">Week</Link>
          <Link href="/me/til">TIL</Link>
          <Link href="/me/vacation">Vacation</Link>
          <span className="text-[var(--color-text-muted)]">{email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: (app) group layout**

`web/app/(app)/layout.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { Header } from '@/components/shell/Header';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div className="min-h-dvh flex flex-col">
      <Header email={user.email ?? ''} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: /week/current redirect**

`web/app/(app)/week/current/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { currentMonday } from '@/lib/dates';
export default function CurrentWeek() { redirect(`/week/${currentMonday()}`); }
```

- [ ] **Step 5: Smoke test**

`npm run dev`, sign in (create user via Studio if needed), expect to land at `/week/<this-monday>` with header showing email + nav links. The page itself will 404 until Task 9 — header should still render via the (app) layout if you visit `/me/til` (will 404 too but the shell renders). Acceptable for now.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): app shell with auth-guarded layout and header"
```

---

### Task 7: Data hooks (subcategories, projects, week) + Zod schemas

**Files:**
- Create: `web/lib/schemas.ts`
- Create: `web/lib/queries.ts`
- Create: `web/lib/hooks.ts`

- [ ] **Step 1: Zod schemas**

`web/lib/schemas.ts`:
```ts
import { z } from 'zod';

export const entryDraftSchema = z.object({
  id: z.string().uuid().optional(),
  main_category: z.enum(['Project', 'Admin', 'Office & Sales']),
  sub_category_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  mon_hrs: z.number().min(0),
  tue_hrs: z.number().min(0),
  wed_hrs: z.number().min(0),
  thu_hrs: z.number().min(0),
  fri_hrs: z.number().min(0),
  sat_hrs: z.number().min(0),
  sun_hrs: z.number().min(0),
  description: z.string().trim().min(1, 'Description required'),
  position: z.number().int().min(0),
});

export type EntryDraftInput = z.input<typeof entryDraftSchema>;
```

- [ ] **Step 2: Queries**

`web/lib/queries.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, SubCategory, Timesheet, TimesheetEntryDraft, MainCategory } from './types';

export async function fetchSubCategories(sb: SupabaseClient): Promise<SubCategory[]> {
  const { data, error } = await sb
    .from('sub_categories')
    .select('id, main_category, name, requires_project, consumes_til, consumes_vacation, is_overtime_taken, sort_order')
    .eq('is_active', true)
    .order('main_category').order('sort_order');
  if (error) throw error;
  return data as SubCategory[];
}

export async function fetchProjects(sb: SupabaseClient): Promise<Project[]> {
  const { data, error } = await sb
    .from('projects')
    .select('id, project_number, name, status')
    .eq('status', 'active')
    .order('project_number');
  if (error) throw error;
  return data as Project[];
}

export async function ensureWeek(sb: SupabaseClient, weekStart: string): Promise<string> {
  const { data, error } = await sb.rpc('create_or_get_week', { p_week_start: weekStart });
  if (error) throw error;
  return data as string;
}

export async function fetchTimesheet(sb: SupabaseClient, id: string): Promise<{ timesheet: Timesheet; entries: TimesheetEntryDraft[] }> {
  const [{ data: tsRow, error: tsErr }, { data: entryRows, error: enErr }] = await Promise.all([
    sb.from('timesheets').select('id,user_id,week_start,status,submitted_at,decided_at,decline_reason,locked').eq('id', id).single(),
    sb.from('timesheet_entries').select('id,main_category,sub_category_id,project_id,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,description,position').eq('timesheet_id', id).order('position'),
  ]);
  if (tsErr) throw tsErr;
  if (enErr) throw enErr;
  return {
    timesheet: tsRow as Timesheet,
    entries: (entryRows ?? []).map((r) => ({ ...r, main_category: r.main_category as MainCategory })),
  };
}

export async function replaceEntries(sb: SupabaseClient, timesheetId: string, entries: Omit<TimesheetEntryDraft,'id'>[]): Promise<void> {
  const { error: delErr } = await sb.from('timesheet_entries').delete().eq('timesheet_id', timesheetId);
  if (delErr) throw delErr;
  if (entries.length === 0) return;
  const payload = entries.map((e, i) => ({
    timesheet_id: timesheetId,
    main_category: e.main_category,
    sub_category_id: e.sub_category_id,
    project_id: e.project_id,
    mon_hrs: e.mon_hrs, tue_hrs: e.tue_hrs, wed_hrs: e.wed_hrs, thu_hrs: e.thu_hrs,
    fri_hrs: e.fri_hrs, sat_hrs: e.sat_hrs, sun_hrs: e.sun_hrs,
    description: e.description,
    position: i,
  }));
  const { error } = await sb.from('timesheet_entries').insert(payload);
  if (error) throw error;
}

export async function submitTimesheet(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.rpc('submit_timesheet', { p_timesheet_id: id });
  if (error) throw error;
}
```

(Note: "replace entries" is the simplest correct model — delete-all then insert-all on save. The DB has FK cascade and we run inside a single network round trip. We can optimise to upsert/diff later.)

- [ ] **Step 3: Hooks**

`web/lib/hooks.ts`:
```ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from './supabase/client';
import { fetchSubCategories, fetchProjects, fetchTimesheet, replaceEntries, submitTimesheet } from './queries';
import type { TimesheetEntryDraft } from './types';

export function useSubCategories() {
  const sb = getSupabaseBrowser();
  return useQuery({ queryKey: ['sub_categories'], queryFn: () => fetchSubCategories(sb), staleTime: 5 * 60_000 });
}

export function useProjects() {
  const sb = getSupabaseBrowser();
  return useQuery({ queryKey: ['projects'], queryFn: () => fetchProjects(sb), staleTime: 60_000 });
}

export function useTimesheet(id: string | null) {
  const sb = getSupabaseBrowser();
  return useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => fetchTimesheet(sb, id as string),
    enabled: !!id,
  });
}

export function useSaveEntries(timesheetId: string) {
  const sb = getSupabaseBrowser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Omit<TimesheetEntryDraft,'id'>[]) => replaceEntries(sb, timesheetId, entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheet', timesheetId] }),
  });
}

export function useSubmit(timesheetId: string) {
  const sb = getSupabaseBrowser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitTimesheet(sb, timesheetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheet', timesheetId] }),
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add web/
git commit -m "feat(web): supabase queries, zod schemas, react-query hooks"
```

---

### Task 8: Entry table sub-components

**Files:**
- Create: `web/components/timesheet/CategoryCell.tsx`
- Create: `web/components/timesheet/ProjectCell.tsx`
- Create: `web/components/timesheet/HourCell.tsx`
- Create: `web/components/timesheet/EntryRow.tsx`

- [ ] **Step 1: HourCell**

`web/components/timesheet/HourCell.tsx`:
```tsx
'use client';
import { Input } from '@/components/ui/input';

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  ariaLabel: string;
}

export function HourCell({ value, onChange, disabled, ariaLabel }: Props) {
  return (
    <Input
      type="number"
      step="0.25"
      min="0"
      inputMode="decimal"
      disabled={disabled}
      value={value === 0 ? '' : value}
      onChange={(e) => {
        const n = e.target.value === '' ? 0 : Number(e.target.value);
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
      className="h-9 w-16 text-right font-mono tabular-nums"
      aria-label={ariaLabel}
    />
  );
}
```

- [ ] **Step 2: CategoryCell — cascading main + sub**

`web/components/timesheet/CategoryCell.tsx`:
```tsx
'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MainCategory, SubCategory } from '@/lib/types';
import { useMemo } from 'react';

interface Props {
  mainCategory: MainCategory | '';
  subCategoryId: string | null;
  subCategories: readonly SubCategory[];
  onChange: (next: { mainCategory: MainCategory | ''; subCategoryId: string | null }) => void;
  disabled?: boolean;
}

const MAIN: MainCategory[] = ['Project', 'Admin', 'Office & Sales'];

export function CategoryCell({ mainCategory, subCategoryId, subCategories, onChange, disabled }: Props) {
  const filtered = useMemo(
    () => subCategories.filter((s) => s.main_category === mainCategory),
    [subCategories, mainCategory],
  );
  return (
    <div className="flex gap-2">
      <Select
        value={mainCategory || undefined}
        onValueChange={(v) => onChange({ mainCategory: v as MainCategory, subCategoryId: null })}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Main…" /></SelectTrigger>
        <SelectContent>
          {MAIN.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select
        value={subCategoryId ?? undefined}
        onValueChange={(v) => onChange({ mainCategory, subCategoryId: v })}
        disabled={disabled || !mainCategory}
      >
        <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Sub…" /></SelectTrigger>
        <SelectContent>
          {filtered.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: ProjectCell — typeahead via shadcn Select for v1 (typeahead is upgrade later)**

`web/components/timesheet/ProjectCell.tsx`:
```tsx
'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Project } from '@/lib/types';

interface Props {
  projectId: string | null;
  required: boolean;
  projects: readonly Project[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export function ProjectCell({ projectId, required, projects, onChange, disabled }: Props) {
  if (!required) {
    return <span className="text-[var(--color-text-muted)] text-sm">—</span>;
  }
  return (
    <Select
      value={projectId ?? undefined}
      onValueChange={(v) => onChange(v)}
      disabled={disabled}
    >
      <SelectTrigger className="h-9 w-40 font-mono"><SelectValue placeholder="Project #" /></SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="font-mono">{p.project_number}</span> — {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: EntryRow**

`web/components/timesheet/EntryRow.tsx`:
```tsx
'use client';
import type { Project, SubCategory, TimesheetEntryDraft } from '@/lib/types';
import { DAY_KEYS } from '@/lib/dates';
import { CategoryCell } from './CategoryCell';
import { ProjectCell } from './ProjectCell';
import { HourCell } from './HourCell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface Props {
  row: TimesheetEntryDraft;
  index: number;
  subCategories: readonly SubCategory[];
  projects: readonly Project[];
  onChange: (next: TimesheetEntryDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function EntryRow({ row, index, subCategories, projects, onChange, onRemove, disabled }: Props) {
  const sub = subCategories.find((s) => s.id === row.sub_category_id);
  const requiresProject = sub?.requires_project ?? (row.main_category === 'Project');

  const rowTotal = DAY_KEYS.reduce((acc, k) => acc + (row[k] || 0), 0);
  const missingDescription = row.description.trim().length === 0;
  const missingProject = requiresProject && !row.project_id;

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="p-2"><CategoryCell
        mainCategory={row.main_category}
        subCategoryId={row.sub_category_id}
        subCategories={subCategories}
        onChange={({ mainCategory, subCategoryId }) => onChange({ ...row, main_category: mainCategory, sub_category_id: subCategoryId, project_id: null })}
        disabled={disabled}
      /></td>
      <td className="p-2"><ProjectCell
        projectId={row.project_id}
        required={requiresProject}
        projects={projects}
        onChange={(id) => onChange({ ...row, project_id: id })}
        disabled={disabled}
      /></td>
      {DAY_KEYS.map((k, i) => (
        <td key={k} className="p-1 text-center">
          <HourCell value={row[k]} onChange={(n) => onChange({ ...row, [k]: n })} disabled={disabled} ariaLabel={`${DAY_LABELS[i]} hours row ${index+1}`} />
        </td>
      ))}
      <td className="p-2">
        <Input
          value={row.description}
          onChange={(e) => onChange({ ...row, description: e.target.value })}
          disabled={disabled}
          placeholder={missingDescription ? 'Description required' : ''}
          className={missingDescription ? 'border-[var(--color-status-declined)]' : ''}
          aria-invalid={missingDescription}
        />
      </td>
      <td className="p-2 text-right font-mono tabular-nums">{rowTotal.toFixed(2)}</td>
      <td className="p-2">
        {missingProject && <span className="text-xs text-[var(--color-status-declined)]">project required</span>}
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled} aria-label={`Remove row ${index+1}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): entry-table sub-components (category, project, hour, row)"
```

---

### Task 9: Status banner + KPI strip + EntryTable + week page

**Files:**
- Create: `web/components/timesheet/StatusBanner.tsx`
- Create: `web/components/timesheet/KpiStrip.tsx`
- Create: `web/components/timesheet/EntryTable.tsx`
- Create: `web/app/(app)/week/[week_start]/page.tsx`

- [ ] **Step 1: StatusBanner**

`web/components/timesheet/StatusBanner.tsx`:
```tsx
import type { TimesheetStatus } from '@/lib/types';

const COPY: Record<TimesheetStatus, { text: string; color: string }> = {
  draft:     { text: '📝  Draft — your edits are not yet submitted.',           color: 'var(--color-status-draft)' },
  submitted: { text: '🔒  Submitted — awaiting admin approval.',                color: 'var(--color-status-submitted)' },
  approved:  { text: '✅  Approved — this week is locked.',                     color: 'var(--color-status-approved)' },
  declined:  { text: '⚠️  Declined — fix the issues below and re-submit.',     color: 'var(--color-status-declined)' },
};

export function StatusBanner({ status, declineReason }: { status: TimesheetStatus; declineReason: string | null }) {
  const { text, color } = COPY[status];
  return (
    <div role="status" className="w-full px-6 py-3 text-sm font-medium" style={{ background: color, color: 'oklch(98% 0 0)' }}>
      {text}{declineReason ? ` — Reason: ${declineReason}` : ''}
    </div>
  );
}
```

- [ ] **Step 2: KpiStrip**

`web/components/timesheet/KpiStrip.tsx`:
```tsx
import type { TimesheetTotals } from '@/lib/totals';

interface Props {
  totals: TimesheetTotals;
  openingTil: number;
  openingVacation: number;
}

function Kpi({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <span className={`text-2xl ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</span>
    </div>
  );
}

export function KpiStrip({ totals, openingTil, openingVacation }: Props) {
  const tilRemaining = openingTil + totals.overtime_earned - totals.til_used;
  const vacRemaining = openingVacation - totals.vacation_used;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-6 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <Kpi label="Total Hours" value={totals.total_hrs.toFixed(2)} />
      <Kpi label="Overtime Earned" value={totals.overtime_earned.toFixed(2)} />
      <Kpi label="TIL Used" value={totals.til_used.toFixed(2)} />
      <Kpi label="TIL Remaining" value={tilRemaining.toFixed(2)} />
      <Kpi label="Vacation Used" value={totals.vacation_used.toFixed(2)} />
      <Kpi label="Vacation Remaining" value={vacRemaining.toFixed(2)} />
    </div>
  );
}
```

- [ ] **Step 3: EntryTable (the big one)**

`web/components/timesheet/EntryTable.tsx`:
```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';
import { EntryRow } from './EntryRow';
import { KpiStrip } from './KpiStrip';
import { StatusBanner } from './StatusBanner';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { computeTotals } from '@/lib/totals';
import { useSaveEntries, useSubmit } from '@/lib/hooks';
import { toast } from 'sonner';

interface Props {
  timesheet: Timesheet;
  initialEntries: TimesheetEntryDraft[];
  subCategories: SubCategory[];
  projects: Project[];
  openingTil: number;
  openingVacation: number;
}

function emptyRow(position: number): TimesheetEntryDraft {
  return {
    main_category: '', sub_category_id: null, project_id: null,
    mon_hrs: 0, tue_hrs: 0, wed_hrs: 0, thu_hrs: 0, fri_hrs: 0, sat_hrs: 0, sun_hrs: 0,
    description: '', position,
  };
}

export function EntryTable({ timesheet, initialEntries, subCategories, projects, openingTil, openingVacation }: Props) {
  const [rows, setRows] = useState<TimesheetEntryDraft[]>(initialEntries.length ? initialEntries : [emptyRow(0)]);
  const [dirty, setDirty] = useState(false);
  const locked = timesheet.locked || timesheet.status === 'submitted' || timesheet.status === 'approved';

  useEffect(() => { setRows(initialEntries.length ? initialEntries : [emptyRow(0)]); setDirty(false); }, [initialEntries, timesheet.id]);

  const totals = useMemo(() => computeTotals(rows, subCategories), [rows, subCategories]);
  const save = useSaveEntries(timesheet.id);
  const submit = useSubmit(timesheet.id);

  const subById = new Map(subCategories.map((s) => [s.id, s]));
  const errors = rows.flatMap((r, i) => {
    const e: string[] = [];
    if (!r.main_category) e.push(`Row ${i+1}: main category`);
    if (!r.sub_category_id) e.push(`Row ${i+1}: sub-category`);
    if (r.sub_category_id && subById.get(r.sub_category_id)?.requires_project && !r.project_id) e.push(`Row ${i+1}: project #`);
    if (!r.description.trim()) e.push(`Row ${i+1}: description`);
    return e;
  });

  const setRow = (i: number, next: TimesheetEntryDraft) => { setRows((rs) => rs.map((r, idx) => idx === i ? next : r)); setDirty(true); };
  const addRow = () => { setRows((rs) => [...rs, emptyRow(rs.length)]); setDirty(true); };
  const removeRow = (i: number) => { setRows((rs) => rs.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx }))); setDirty(true); };

  const onSave = async () => {
    try {
      await save.mutateAsync(rows.map(({ id: _id, ...rest }) => rest));
      setDirty(false);
      toast.success('Saved');
    } catch (e) { toast.error((e as Error).message); }
  };

  const onSubmit = async () => {
    if (dirty) await onSave();
    if (errors.length) { toast.error(`Fix ${errors.length} issue(s) before submitting`); return; }
    try {
      await submit.mutateAsync();
      toast.success('Submitted for approval');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <StatusBanner status={timesheet.status} declineReason={timesheet.decline_reason} />
      <KpiStrip totals={totals} openingTil={openingTil} openingVacation={openingVacation} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
            <tr>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Project #</th>
              <th className="p-2">Mon</th><th className="p-2">Tue</th><th className="p-2">Wed</th>
              <th className="p-2">Thu</th><th className="p-2">Fri</th><th className="p-2">Sat</th><th className="p-2">Sun</th>
              <th className="text-left p-2">Description</th>
              <th className="text-right p-2">Total</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <EntryRow
                key={i}
                row={r}
                index={i}
                subCategories={subCategories}
                projects={projects}
                onChange={(next) => setRow(i, next)}
                onRemove={() => removeRow(i)}
                disabled={locked}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
        <Button type="button" variant="outline" onClick={addRow} disabled={locked}>
          <Plus className="h-4 w-4 mr-1" /> Add row
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">{errors.length} validation issue{errors.length === 1 ? '' : 's'}</span>
          <Button type="button" variant="outline" onClick={onSave} disabled={locked || save.isPending || !dirty}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={locked || submit.isPending || errors.length > 0}>
            {submit.isPending ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Week page (server component fetches, then renders EntryTable)**

`web/app/(app)/week/[week_start]/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { EntryTable } from '@/components/timesheet/EntryTable';
import { isMondayISO } from '@/lib/dates';
import { notFound } from 'next/navigation';
import type { MainCategory, Project, SubCategory, Timesheet, TimesheetEntryDraft } from '@/lib/types';

interface PageProps { params: Promise<{ week_start: string }> }

export default async function WeekPage({ params }: PageProps) {
  const { week_start } = await params;
  if (!isMondayISO(week_start)) notFound();

  const supabase = await getSupabaseServer();
  const { data: tsId, error: ensureErr } = await supabase.rpc('create_or_get_week', { p_week_start: week_start });
  if (ensureErr) throw new Error(ensureErr.message);

  const [tsRes, entriesRes, subsRes, projectsRes, tilRes, vacRes] = await Promise.all([
    supabase.from('timesheets').select('id,user_id,week_start,status,submitted_at,decided_at,decline_reason,locked').eq('id', tsId).single(),
    supabase.from('timesheet_entries').select('id,main_category,sub_category_id,project_id,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,description,position').eq('timesheet_id', tsId).order('position'),
    supabase.from('sub_categories').select('id,main_category,name,requires_project,consumes_til,consumes_vacation,is_overtime_taken,sort_order').eq('is_active', true).order('main_category').order('sort_order'),
    supabase.from('projects').select('id,project_number,name,status').eq('status', 'active').order('project_number'),
    supabase.from('v_til_balance').select('closing_balance').maybeSingle(),
    supabase.from('v_vacation_balance').select('closing_balance').maybeSingle(),
  ]);

  if (tsRes.error || entriesRes.error || subsRes.error || projectsRes.error) {
    throw new Error(tsRes.error?.message ?? entriesRes.error?.message ?? subsRes.error?.message ?? projectsRes.error!.message);
  }

  const initialEntries = (entriesRes.data ?? []).map((r): TimesheetEntryDraft => ({
    ...r, main_category: r.main_category as MainCategory,
  }));

  return (
    <main className="mx-auto max-w-6xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Week of {week_start}</h1>
      </div>
      <EntryTable
        timesheet={tsRes.data as Timesheet}
        initialEntries={initialEntries}
        subCategories={(subsRes.data ?? []) as SubCategory[]}
        projects={(projectsRes.data ?? []) as Project[]}
        openingTil={Number(tilRes.data?.closing_balance ?? 0)}
        openingVacation={Number(vacRes.data?.closing_balance ?? 0)}
      />
    </main>
  );
}
```

- [ ] **Step 5: Smoke test**

Start Supabase, start `npm run dev`. Sign in as a test user (create one via Studio if needed). Visit `/`, get redirected to `/week/<this-monday>`. The entry table should render with one empty row. Add a few rows, save, submit. Inspect Studio: `timesheets.status` should be `submitted`, entries should be present.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): weekly timesheet editor (status banner + KPIs + entry table)"
```

---

### Task 10: Weekly report page

**Files:**
- Create: `web/components/report/DailyBreakdown.tsx`
- Create: `web/components/report/CategoryTable.tsx`
- Create: `web/components/report/SubCategoryTable.tsx`
- Create: `web/components/report/ProjectTable.tsx`
- Create: `web/app/(app)/week/[week_start]/report/page.tsx`

- [ ] **Step 1: Report sub-components**

`web/components/report/DailyBreakdown.tsx`:
```tsx
import { DAY_KEYS } from '@/lib/dates';

interface Row { mon_hrs: number; tue_hrs: number; wed_hrs: number; thu_hrs: number; fri_hrs: number; sat_hrs: number; sun_hrs: number; }

export function DailyBreakdown({ rows }: { rows: Row[] }) {
  const totals = DAY_KEYS.map((k) => rows.reduce((acc, r) => acc + (r[k] || 0), 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const overtime = totals.map((t) => Math.max(0, t - 8));
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Category</th>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <th key={d} className="p-2">{d}</th>)}
        <th className="text-right p-2">Total</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        <tr className="border-t border-[var(--color-border)]"><td className="p-2 font-sans">Regular</td>
          {totals.map((t, i) => <td key={i} className="text-center p-2">{(t - overtime[i]).toFixed(2)}</td>)}
          <td className="text-right p-2">{(grand - overtime.reduce((a,b)=>a+b,0)).toFixed(2)}</td>
        </tr>
        <tr className="border-t border-[var(--color-border)]"><td className="p-2 font-sans">Overtime</td>
          {overtime.map((t, i) => <td key={i} className="text-center p-2">{t.toFixed(2)}</td>)}
          <td className="text-right p-2">{overtime.reduce((a,b)=>a+b,0).toFixed(2)}</td>
        </tr>
        <tr className="border-t border-[var(--color-border)] font-semibold"><td className="p-2 font-sans">Total</td>
          {totals.map((t, i) => <td key={i} className="text-center p-2">{t.toFixed(2)}</td>)}
          <td className="text-right p-2">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

`web/components/report/CategoryTable.tsx`:
```tsx
import type { MainCategory } from '@/lib/types';

interface Row { main_category: MainCategory; row_total: number; }

export function CategoryTable({ rows }: { rows: Row[] }) {
  const byCat = new Map<MainCategory, number>();
  for (const r of rows) byCat.set(r.main_category, (byCat.get(r.main_category) ?? 0) + Number(r.row_total));
  const grand = [...byCat.values()].reduce((a, b) => a + b, 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Main Category</th><th className="text-right p-2">Hours</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...byCat.entries()].map(([cat, hrs]) => (
          <tr key={cat} className="border-t border-[var(--color-border)]">
            <td className="p-2 font-sans">{cat}</td>
            <td className="text-right p-2">{hrs.toFixed(2)}</td>
          </tr>
        ))}
        <tr className="border-t border-[var(--color-border)] font-semibold">
          <td className="p-2 font-sans">Total</td>
          <td className="text-right p-2">{grand.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

`web/components/report/SubCategoryTable.tsx`:
```tsx
interface Row { main_category: string; sub_category: string; row_total: number; }

export function SubCategoryTable({ rows }: { rows: Row[] }) {
  const grouped = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!grouped.has(r.main_category)) grouped.set(r.main_category, new Map());
    const sub = grouped.get(r.main_category)!;
    sub.set(r.sub_category, (sub.get(r.sub_category) ?? 0) + Number(r.row_total));
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Main</th><th className="text-left p-2">Sub-category</th>
        <th className="text-right p-2">Hours</th><th className="text-right p-2">% of category</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...grouped.entries()].flatMap(([main, subs]) => {
          const catTotal = [...subs.values()].reduce((a, b) => a + b, 0);
          return [...subs.entries()].map(([sub, hrs]) => (
            <tr key={`${main}-${sub}`} className="border-t border-[var(--color-border)]">
              <td className="p-2 font-sans">{main}</td>
              <td className="p-2 font-sans">{sub}</td>
              <td className="text-right p-2">{hrs.toFixed(2)}</td>
              <td className="text-right p-2">{catTotal > 0 ? ((hrs / catTotal) * 100).toFixed(1) + '%' : '—'}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}
```

`web/components/report/ProjectTable.tsx`:
```tsx
import { DAY_KEYS } from '@/lib/dates';

interface Row { project_number: number | null; mon_hrs: number; tue_hrs: number; wed_hrs: number; thu_hrs: number; fri_hrs: number; sat_hrs: number; sun_hrs: number; }

export function ProjectTable({ rows }: { rows: Row[] }) {
  const byProj = new Map<number, Record<typeof DAY_KEYS[number], number>>();
  for (const r of rows) {
    if (r.project_number == null) continue;
    if (!byProj.has(r.project_number)) byProj.set(r.project_number, { mon_hrs:0,tue_hrs:0,wed_hrs:0,thu_hrs:0,fri_hrs:0,sat_hrs:0,sun_hrs:0 });
    const acc = byProj.get(r.project_number)!;
    for (const k of DAY_KEYS) acc[k] += Number(r[k] ?? 0);
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-[var(--color-text-muted)]"><tr>
        <th className="text-left p-2">Project #</th>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <th key={d} className="p-2">{d}</th>)}
        <th className="text-right p-2">Total</th>
      </tr></thead>
      <tbody className="font-mono tabular-nums">
        {[...byProj.entries()].map(([n, days]) => {
          const total = DAY_KEYS.reduce((acc, k) => acc + days[k], 0);
          return (
            <tr key={n} className="border-t border-[var(--color-border)]">
              <td className="p-2">{n}</td>
              {DAY_KEYS.map((k) => <td key={k} className="text-center p-2">{days[k].toFixed(2)}</td>)}
              <td className="text-right p-2">{total.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Report page (RSC reads views)**

`web/app/(app)/week/[week_start]/report/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { DailyBreakdown } from '@/components/report/DailyBreakdown';
import { CategoryTable } from '@/components/report/CategoryTable';
import { SubCategoryTable } from '@/components/report/SubCategoryTable';
import { ProjectTable } from '@/components/report/ProjectTable';
import { isMondayISO } from '@/lib/dates';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ week_start: string }> }

export default async function ReportPage({ params }: Props) {
  const { week_start } = await params;
  if (!isMondayISO(week_start)) notFound();

  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('v_weekly_report')
    .select('main_category,sub_category,project_number,description,mon_hrs,tue_hrs,wed_hrs,thu_hrs,fri_hrs,sat_hrs,sun_hrs,row_total')
    .eq('week_start', week_start);
  if (error) throw new Error(error.message);

  const r = rows ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Weekly Report — {week_start}</h1>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Daily breakdown</h2><DailyBreakdown rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by category</h2><CategoryTable rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by sub-category</h2><SubCategoryTable rows={r} /></section>
      <section><h2 className="text-sm uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Hours by project</h2><ProjectTable rows={r} /></section>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + smoke**

`npx tsc --noEmit` should be clean. `npm run dev` and visit `/week/<monday>/report` — should render the four tables.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): weekly report page"
```

---

### Task 11: TIL + Vacation ledger pages

**Files:**
- Create: `web/app/(app)/me/til/page.tsx`
- Create: `web/app/(app)/me/vacation/page.tsx`

- [ ] **Step 1: TIL page**

`web/app/(app)/me/til/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function TilPage() {
  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('til_ledger')
    .select('week_start, opening_balance, overtime_earned, til_used, closing_balance, frozen, stale')
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);
  const current = (rows ?? []).find((r) => !r.stale);
  return (
    <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
      <header className="flex items-end justify-between">
        <h1 className="text-xl font-semibold tracking-tight">TIL bank</h1>
        <div className="font-mono tabular-nums text-3xl">{Number(current?.closing_balance ?? 0).toFixed(2)} hrs</div>
      </header>
      <table className="w-full text-sm">
        <thead className="text-[var(--color-text-muted)]"><tr>
          <th className="text-left p-2">Week</th>
          <th className="text-right p-2">Opening</th>
          <th className="text-right p-2">OT earned</th>
          <th className="text-right p-2">TIL used</th>
          <th className="text-right p-2">Closing</th>
          <th className="p-2"></th>
        </tr></thead>
        <tbody className="font-mono tabular-nums">
          {(rows ?? []).map((r) => (
            <tr key={r.week_start} className={`border-t border-[var(--color-border)] ${r.stale ? 'opacity-40 line-through' : ''}`}>
              <td className="p-2 font-sans">{r.week_start}</td>
              <td className="text-right p-2">{Number(r.opening_balance).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.overtime_earned).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.til_used).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.closing_balance).toFixed(2)}</td>
              <td className="p-2 text-xs text-[var(--color-text-muted)]">{r.stale ? 'superseded' : r.frozen ? 'frozen' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Vacation page (same shape)**

`web/app/(app)/me/vacation/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function VacationPage() {
  const supabase = await getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('vacation_ledger')
    .select('week_start, opening_balance, vacation_used, closing_balance, frozen, stale')
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);
  const current = (rows ?? []).find((r) => !r.stale);
  return (
    <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
      <header className="flex items-end justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Vacation bank</h1>
        <div className="font-mono tabular-nums text-3xl">{Number(current?.closing_balance ?? 0).toFixed(2)} hrs</div>
      </header>
      <table className="w-full text-sm">
        <thead className="text-[var(--color-text-muted)]"><tr>
          <th className="text-left p-2">Week</th>
          <th className="text-right p-2">Opening</th>
          <th className="text-right p-2">Used</th>
          <th className="text-right p-2">Closing</th>
          <th className="p-2"></th>
        </tr></thead>
        <tbody className="font-mono tabular-nums">
          {(rows ?? []).map((r) => (
            <tr key={r.week_start} className={`border-t border-[var(--color-border)] ${r.stale ? 'opacity-40 line-through' : ''}`}>
              <td className="p-2 font-sans">{r.week_start}</td>
              <td className="text-right p-2">{Number(r.opening_balance).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.vacation_used).toFixed(2)}</td>
              <td className="text-right p-2">{Number(r.closing_balance).toFixed(2)}</td>
              <td className="p-2 text-xs text-[var(--color-text-muted)]">{r.stale ? 'superseded' : r.frozen ? 'frozen' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/
git commit -m "feat(web): TIL and vacation ledger pages"
```

---

### Task 12: Playwright E2E — happy path

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/setup.ts`
- Create: `web/tests/e2e/timesheet-happy.spec.ts`

- [ ] **Step 1: Install Playwright**

From `web/`:
```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Config**

`web/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true, timeout: 60_000 },
});
```

Add to `web/package.json` scripts:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Setup helper that provisions a test user via Supabase admin API**

`web/tests/e2e/setup.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_ROLE) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (from `supabase status`) before running e2e');

export async function provisionEmployee(email: string, password: string, employeeCode: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // delete if exists (best-effort)
  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === email);
  if (existingUser) await admin.auth.admin.deleteUser(existingUser.id);

  const { data: { user }, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !user) throw new Error(error?.message ?? 'createUser failed');

  // position lookup
  const { data: pos } = await admin.from('positions').select('id').eq('name', 'Senior Engineer').single();

  await admin.from('users').insert({
    id: user.id,
    org_id: '00000000-0000-0000-0000-000000000001',
    full_name: 'E2E User',
    email,
    employee_code: employeeCode,
    position_id: pos!.id,
  });
  await admin.from('user_roles').insert({ user_id: user.id, role: 'employee' });

  return user.id;
}
```

- [ ] **Step 4: Happy path spec**

`web/tests/e2e/timesheet-happy.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { provisionEmployee } from './setup';

test('employee can sign in, add entries, save, and submit', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';
  await provisionEmployee(email, password, `E${Math.floor(Math.random()*9999)}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/);

  // Add an admin/administrative row with 8 hours Monday
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Admin' }).click();
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Administrative' }).click();
  await page.getByLabel('Mon hours row 1').fill('8');
  await page.getByPlaceholder('Description required').fill('Catch-up');

  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page.getByText('Submitted for approval')).toBeVisible();
  await expect(page.getByText(/Submitted — awaiting/)).toBeVisible();
});
```

- [ ] **Step 5: Run**

You need `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`. Put it in `web/.env.local` (gitignored).

```bash
npm run test:e2e
```
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "test(web): playwright e2e — sign-in + save + submit happy path"
```

---

### Task 13: Final sweep + README

**Files:**
- Modify: `web/README.md` (create if absent)
- Modify: `README.md` (root)

- [ ] **Step 1: Web README**

Create `web/README.md`:
```markdown
# SRE Timesheet — Employee Web

Next.js 15 + Tailwind v4 + shadcn/ui + Supabase JS. Implements the employee surface defined in
`../docs/specs/2026-06-23-sre-timesheet-design.md`.

## Run

    cp .env.local.example .env.local         # paste anon key from `supabase status`
    npm install
    npm run dev                              # http://localhost:3000

## Test

    npm run test:unit
    npm run test:e2e                         # needs SUPABASE_SERVICE_ROLE_KEY in .env.local

## Routes

- `/login` — password + magic-link sign-in
- `/week/current` — redirects to `/week/<this-monday>`
- `/week/[ws]` — weekly editor
- `/week/[ws]/report` — read-only report
- `/me/til` — TIL ledger
- `/me/vacation` — vacation ledger
```

- [ ] **Step 2: Update root README**

Replace `README.md`'s "What's next" section:
```markdown
- Plan 2: Employee web app — **COMPLETE**
- Plan 3: Admin web app (approvals, user/project management)
- Plan 4: Historical importer (Excel → DB)
```

- [ ] **Step 3: Run full check**

```bash
cd web
npx tsc --noEmit
npm run test:unit
```

- [ ] **Step 4: Commit**

```bash
git add web/README.md README.md
git commit -m "docs: mark Plan 2 complete"
```

---

## Plans 3–4 (still outlined in Plan 1's file — to be expanded when started)

## Self-Review

- **Spec coverage** (§5 architecture, §6 frontend IA, §7 UI direction): every employee route from §6.1 (`/login`, `/`, `/week/current`, `/week/[week_start]`, `/week/[week_start]/report`, `/me/til`, `/me/vacation`) is implemented. Admin routes are Plan 3.
- **Auth (§5):** email+password and magic-link both wired (Task 5).
- **Design tokens (§7):** OKLCH palette + Inter/JetBrains Mono + 4px radius + tabular numerals (Task 2).
- **Live KPI computation** mirrors `v_timesheet_totals` math via the pure `computeTotals` function in `lib/totals.ts`, tested independently (Task 4). DB remains source of truth at submit.
- **ProjectCell typeahead deferred:** Task 8 uses a plain Select; a typeahead (e.g. cmdk) is a v1.1 polish. Not in scope.
- **Placeholders:** none.
- **Type consistency:** `MainCategory`, `TimesheetStatus`, `SubCategory`, `Project`, `Timesheet`, `TimesheetEntryDraft`, `DAY_KEYS`, `computeTotals`, `getSupabaseServer`, `getSupabaseBrowser`, `useTimesheet`, `useSaveEntries`, `useSubmit`, `EntryTable`, `KpiStrip`, `StatusBanner` consistent across all tasks.
