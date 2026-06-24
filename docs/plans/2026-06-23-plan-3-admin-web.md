# Plan 3 — Admin Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin surface that lets an admin see all employees' submitted timesheets, approve/decline them with audit trail, manage employees + projects + positions, browse the approval log, and unlock approved weeks via the cascade flow.

**Architecture:** Same Next.js app at `web/`, no new framework. All admin routes live under `/admin` and use a server-side role check in the route group's layout. Reads use Supabase views/tables directly (RLS already gates admin-only visibility from Plan 1); writes go through the RPCs from Plan 1 (`approve_timesheet`, `decline_timesheet`, `unlock_timesheet`) or direct insert/update on admin-writable tables (`users`, `user_roles`, `projects`, `positions`).

**Tech Stack:** Same as Plan 2 — Next.js 15.5, React 19, Tailwind v4, shadcn/ui, TanStack Query, Zod, Supabase JS.

**Source spec:** `docs/specs/2026-06-23-sre-timesheet-design.md`
**Plan 1 (DONE):** `docs/plans/2026-06-23-plan-1-supabase-foundation.md`
**Plan 2 (DONE):** `docs/plans/2026-06-23-plan-2-employee-web.md`

---

## File Structure

```
web/
├── app/
│   ├── (app)/
│   │   └── admin/
│   │       ├── layout.tsx                       ← admin-only guard
│   │       ├── page.tsx                         ← approval queue (landing)
│   │       ├── employees/
│   │       │   ├── page.tsx                     ← list
│   │       │   ├── new/page.tsx                 ← create form
│   │       │   ├── [id]/page.tsx                ← detail + opening balances
│   │       │   └── [id]/week/[ws]/page.tsx      ← view any employee's week (read-only + approve/decline)
│   │       ├── projects/
│   │       │   └── page.tsx                     ← list + create + close
│   │       ├── positions/
│   │       │   └── page.tsx                     ← list + edit vacation hours
│   │       └── approvals/
│   │           └── page.tsx                     ← full approval log
│   └── ...
├── components/
│   ├── admin/
│   │   ├── ApprovalQueue.tsx
│   │   ├── DecisionBar.tsx                      ← sticky bar with Approve / Decline / Unlock actions
│   │   ├── DeclineDialog.tsx                    ← decline-with-reason modal
│   │   ├── UnlockDialog.tsx                     ← unlock-with-reason modal
│   │   ├── EmployeeForm.tsx
│   │   ├── EmployeeTable.tsx
│   │   ├── ProjectsTable.tsx
│   │   ├── ProjectForm.tsx
│   │   ├── PositionsTable.tsx
│   │   └── ApprovalLogTable.tsx
│   ├── shell/
│   │   └── Header.tsx                           ← extend with admin-aware nav
│   └── ...
├── lib/
│   ├── admin/
│   │   ├── queries.ts                           ← admin-only queries (uses service-role NOT needed — RLS allows admin reads)
│   │   ├── mutations.ts                         ← admin RPCs + table writes
│   │   └── hooks.ts                             ← TanStack hooks for admin pages
│   └── role.ts                                  ← isAdmin() helper used by layout
└── tests/
    └── e2e/
        └── admin-approve-flow.spec.ts           ← submit → admin approves → employee sees lock
```

Conventions match Plan 2: components stay focused (<200 lines), one responsibility each. Mutations go through TanStack `useMutation` with cache invalidation. Server components fetch where possible; client components handle interaction.

---

### Task 1: Admin layout + role guard + header awareness

**Files:**
- Create: `web/lib/role.ts`
- Create: `web/app/(app)/admin/layout.tsx`
- Create: `web/app/(app)/admin/page.tsx` (placeholder — replaced by Task 2)
- Modify: `web/components/shell/Header.tsx` (add admin link when role permits)
- Modify: `web/app/(app)/layout.tsx` (compute admin flag once, pass via context or prop)

- [ ] **Step 1: Role helper**

`web/lib/role.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchIsAdmin(sb: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from('user_roles').select('role').eq('user_id', user.id);
  return (data ?? []).some((r) => r.role === 'admin');
}
```

- [ ] **Step 2: Admin layout**

`web/app/(app)/admin/layout.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  const admin = await fetchIsAdmin(sb);
  if (!admin) redirect('/week/current');
  return (
    <main className="mx-auto max-w-6xl">
      <div className="px-6 pt-8 pb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <nav className="flex gap-4 text-sm text-[var(--color-text-muted)]">
          <a href="/admin">Approvals</a>
          <a href="/admin/employees">Employees</a>
          <a href="/admin/projects">Projects</a>
          <a href="/admin/positions">Positions</a>
          <a href="/admin/approvals">Audit log</a>
        </nav>
      </div>
      {children}
    </main>
  );
}
```

- [ ] **Step 3: Placeholder approvals page (replaced by Task 2)**

`web/app/(app)/admin/page.tsx`:
```tsx
export default function AdminHome() {
  return <div className="px-6 py-6 text-sm text-[var(--color-text-muted)]">Approval queue coming up.</div>;
}
```

- [ ] **Step 4: Admin-aware header**

In `web/components/shell/Header.tsx`, before the `<span className="text-[var(--color-text-muted)]">{email}</span>` line, add an "Admin" link rendered conditionally. Easiest: add an `isAdmin?: boolean` prop to `Header`, and have `(app)/layout.tsx` compute it once and pass it down.

In `web/app/(app)/layout.tsx`:
```tsx
import { fetchIsAdmin } from '@/lib/role';
// ...
const admin = await fetchIsAdmin(supabase);
return (
  // ...
  <Header email={user.email ?? ''} isAdmin={admin} />
  // ...
);
```

In `Header.tsx`, update the nav block to include:
```tsx
{isAdmin ? <Link href="/admin" className="font-medium">Admin</Link> : null}
```

- [ ] **Step 5: Build + smoke**

```
cd web && npm run build
```

Visit `/admin` while signed in as the test user (now has admin role per the dev-credentials setup) — should land on the placeholder. Visit while signed in as an employee-only user — should redirect to `/week/current`.

- [ ] **Step 6: Commit**

```
git add web/
git commit -m "feat(web): admin layout, role guard, admin-aware header"
```

---

### Task 2: Approval queue

**Files:**
- Replace: `web/app/(app)/admin/page.tsx`
- Create: `web/components/admin/ApprovalQueue.tsx`

- [ ] **Step 1: Query helper**

Add to `web/lib/admin/queries.ts` (create the file):
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface QueueRow {
  timesheet_id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_code: string;
  week_start: string;
  submitted_at: string;
  total_hrs: number;
  overtime_earned: number;
}

export async function fetchSubmittedQueue(sb: SupabaseClient): Promise<QueueRow[]> {
  const { data, error } = await sb
    .from('timesheets')
    .select(`
      id, user_id, week_start, submitted_at,
      users!inner ( full_name, email, employee_code ),
      v_timesheet_totals!inner ( total_hrs, overtime_earned )
    `)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  // Flatten nested rows
  type Row = {
    id: string; user_id: string; week_start: string; submitted_at: string;
    users: { full_name: string; email: string; employee_code: string };
    v_timesheet_totals: { total_hrs: number; overtime_earned: number };
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    timesheet_id: r.id,
    user_id: r.user_id,
    full_name: r.users.full_name,
    email: r.users.email,
    employee_code: r.users.employee_code,
    week_start: r.week_start,
    submitted_at: r.submitted_at,
    total_hrs: Number(r.v_timesheet_totals.total_hrs ?? 0),
    overtime_earned: Number(r.v_timesheet_totals.overtime_earned ?? 0),
  }));
}
```

If the inner-join with `v_timesheet_totals` doesn't work in PostgREST (views need to be registered as relations), fall back to two queries: fetch timesheets+users, then fetch totals by `in('timesheet_id', ids)`, then merge.

- [ ] **Step 2: ApprovalQueue component (client)**

`web/components/admin/ApprovalQueue.tsx`:
```tsx
'use client';
import Link from 'next/link';
import type { QueueRow } from '@/lib/admin/queries';
import { formatDistanceToNow } from 'date-fns';

export function ApprovalQueue({ rows }: { rows: QueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mx-6 my-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] p-8 text-center">
        <p className="text-[var(--color-text-muted)]">No timesheets waiting for approval. 🎉</p>
      </div>
    );
  }
  return (
    <div className="mx-6 my-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="text-left px-4 py-3 font-normal">Employee</th>
            <th className="text-left px-4 py-3 font-normal">Week</th>
            <th className="text-right px-4 py-3 font-normal">Hours</th>
            <th className="text-right px-4 py-3 font-normal">Overtime</th>
            <th className="text-left px-4 py-3 font-normal">Submitted</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.timesheet_id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40 transition-colors">
              <td className="px-4 py-3"><div className="font-medium">{r.full_name}</div><div className="text-xs text-[var(--color-text-muted)] font-mono">{r.employee_code}</div></td>
              <td className="px-4 py-3 font-mono">{r.week_start}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{r.total_hrs.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{r.overtime_earned.toFixed(2)}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}</td>
              <td className="px-4 py-3 text-right">
                <Link className="text-[var(--color-accent)] hover:underline" href={`/admin/employees/${r.user_id}/week/${r.week_start}`}>Review →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Replace placeholder page**

`web/app/(app)/admin/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchSubmittedQueue } from '@/lib/admin/queries';
import { ApprovalQueue } from '@/components/admin/ApprovalQueue';

export default async function AdminHome() {
  const sb = await getSupabaseServer();
  const rows = await fetchSubmittedQueue(sb);
  return <ApprovalQueue rows={rows} />;
}
```

- [ ] **Step 4: Build + smoke**

```
cd web && npm run build
```

Visit `/admin` — should show queue (empty initially). To test with data: in another tab, sign in as a different test employee, fill out a week, submit; refresh `/admin` — should appear.

- [ ] **Step 5: Commit**

```
git add web/
git commit -m "feat(web): admin approval queue"
```

---

### Task 3: Review screen — read-only week + decision bar

**Files:**
- Create: `web/app/(app)/admin/employees/[id]/week/[ws]/page.tsx`
- Create: `web/components/admin/DecisionBar.tsx`
- Create: `web/components/admin/DeclineDialog.tsx`
- Create: `web/components/admin/UnlockDialog.tsx`
- Create: `web/lib/admin/mutations.ts`

- [ ] **Step 1: Mutations**

`web/lib/admin/mutations.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function approveTimesheet(sb: SupabaseClient, id: string, comment: string | null): Promise<void> {
  const { error } = await sb.rpc('approve_timesheet', { p_timesheet_id: id, p_comment: comment });
  if (error) throw error;
}

export async function declineTimesheet(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('decline_timesheet', { p_timesheet_id: id, p_reason: reason });
  if (error) throw error;
}

export async function unlockTimesheet(sb: SupabaseClient, id: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('unlock_timesheet', { p_timesheet_id: id, p_reason: reason });
  if (error) throw error;
}
```

- [ ] **Step 2: DeclineDialog**

`web/components/admin/DeclineDialog.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { declineTimesheet } from '@/lib/admin/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function DeclineDialog({ timesheetId, disabled }: { timesheetId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => declineTimesheet(getSupabaseBrowser(), timesheetId, reason.trim()),
    onSuccess: () => {
      toast.success('Declined');
      setOpen(false);
      setReason('');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>Decline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Decline this timesheet</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (the employee will see this)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. project number on row 3 is wrong" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length === 0}>
            {m.isPending ? 'Declining…' : 'Decline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: UnlockDialog (mirrors DeclineDialog)**

`web/components/admin/UnlockDialog.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { unlockTimesheet } from '@/lib/admin/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function UnlockDialog({ timesheetId }: { timesheetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => unlockTimesheet(getSupabaseBrowser(), timesheetId, reason.trim()),
    onSuccess: () => {
      toast.success('Unlocked. Employee can now edit and resubmit. Subsequent weeks will recompute on re-approval.');
      setOpen(false);
      setReason('');
      qc.invalidateQueries();
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Unlock</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Unlock this approved week</DialogTitle></DialogHeader>
        <p className="text-sm text-[var(--color-text-muted)]">
          The week reverts to declined so the employee can edit it. When they resubmit and you re-approve,
          every later week's TIL/vacation balance is automatically recomputed.
        </p>
        <div className="space-y-2">
          <Label htmlFor="unlock-reason">Reason</Label>
          <Input id="unlock-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. payroll noticed wrong project on row 2" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || reason.trim().length === 0}>
            {m.isPending ? 'Unlocking…' : 'Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: DecisionBar**

`web/components/admin/DecisionBar.tsx`:
```tsx
'use client';
import type { TimesheetStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { approveTimesheet } from '@/lib/admin/mutations';
import { DeclineDialog } from './DeclineDialog';
import { UnlockDialog } from './UnlockDialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Props { timesheetId: string; status: TimesheetStatus; }

export function DecisionBar({ timesheetId, status }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const approve = useMutation({
    mutationFn: () => approveTimesheet(getSupabaseBrowser(), timesheetId, null),
    onSuccess: () => { toast.success('Approved'); qc.invalidateQueries(); router.refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="sticky bottom-0 mx-6 mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-muted)]">Status: <strong>{status}</strong></span>
      <div className="flex gap-2">
        {status === 'submitted' && (
          <>
            <DeclineDialog timesheetId={timesheetId} />
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </>
        )}
        {status === 'approved' && <UnlockDialog timesheetId={timesheetId} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Review page (read-only week + decision bar)**

`web/app/(app)/admin/employees/[id]/week/[ws]/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { DecisionBar } from '@/components/admin/DecisionBar';
import { DailyBreakdown } from '@/components/report/DailyBreakdown';
import { CategoryTable } from '@/components/report/CategoryTable';
import { SubCategoryTable } from '@/components/report/SubCategoryTable';
import { ProjectTable } from '@/components/report/ProjectTable';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ id: string; ws: string }> }

export default async function AdminWeekReview({ params }: Props) {
  const { id, ws } = await params;
  const sb = await getSupabaseServer();

  const { data: ts } = await sb.from('timesheets').select('id, status, submitted_at, decided_at, decline_reason, locked').eq('user_id', id).eq('week_start', ws).maybeSingle();
  if (!ts) notFound();

  const { data: user } = await sb.from('users').select('full_name, employee_code, email').eq('id', id).single();
  const { data: rows } = await sb.from('v_weekly_report').select('main_category, sub_category, project_number, description, mon_hrs, tue_hrs, wed_hrs, thu_hrs, fri_hrs, sat_hrs, sun_hrs, row_total').eq('timesheet_id', ts.id);

  const r = rows ?? [];
  return (
    <div className="space-y-6">
      <div className="mx-6 mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-2)] px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{user?.employee_code}</div>
        <div className="text-lg font-semibold">{user?.full_name}</div>
        <div className="text-sm text-[var(--color-text-muted)]">Week of {ws} · status <strong>{ts.status}</strong>{ts.decline_reason ? ` · last reason: ${ts.decline_reason}` : ''}</div>
      </div>

      <section className="px-6"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Daily breakdown</h2><DailyBreakdown rows={r} /></section>
      <section className="px-6"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by category</h2><CategoryTable rows={r} /></section>
      <section className="px-6"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by sub-category</h2><SubCategoryTable rows={r} /></section>
      <section className="px-6"><h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Hours by project</h2><ProjectTable rows={r} /></section>

      <DecisionBar timesheetId={ts.id} status={ts.status} />
    </div>
  );
}
```

- [ ] **Step 6: Build + smoke**

```
cd web && npm run build
```

End-to-end: an employee submits a week → reload `/admin` → click "Review" → admin sees breakdown + sticky decision bar → click Approve → toast → status updates to approved → bar shows "Unlock". Or click Decline → modal → reason → submits → employee sees declined with reason.

- [ ] **Step 7: Commit**

```
git add web/
git commit -m "feat(web): admin review screen with approve/decline/unlock decision bar"
```

---

### Task 4: Employees admin (list + create + opening balances)

**Files:**
- Create: `web/app/(app)/admin/employees/page.tsx` (list)
- Create: `web/app/(app)/admin/employees/new/page.tsx` (create form)
- Create: `web/app/(app)/admin/employees/new/actions.ts` (server action — requires service role; see step note)
- Create: `web/app/(app)/admin/employees/[id]/page.tsx` (detail + opening balances form)
- Create: `web/components/admin/EmployeeTable.tsx`
- Create: `web/components/admin/EmployeeForm.tsx`

> **Service-role caveat:** `auth.admin.createUser` requires the service-role key. The browser must NEVER see this key. The plan uses a Next.js **server action** that lives at `app/(app)/admin/employees/new/actions.ts`. The action reads `SUPABASE_SERVICE_ROLE_KEY` from server-only env (do NOT prefix with `NEXT_PUBLIC_`), uses a server-only `createClient(URL, SERVICE_ROLE)`, performs the user creation + position assignment + role insert + opening-balance seed in a single function. The action is protected by the admin layout guard, which Next runs before the action is dispatched.

- [ ] **Step 1: Employee list (server component)**

`web/app/(app)/admin/employees/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmployeeTable } from '@/components/admin/EmployeeTable';

export default async function EmployeesPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('users').select('id, full_name, email, employee_code, department, is_active, position_id').order('full_name');
  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Employees</h2>
        <Link href="/admin/employees/new"><Button>Add employee</Button></Link>
      </div>
      <EmployeeTable rows={data ?? []} />
    </div>
  );
}
```

`web/components/admin/EmployeeTable.tsx`:
```tsx
import Link from 'next/link';

interface Row { id: string; full_name: string; email: string; employee_code: string; department: string | null; is_active: boolean; }

export function EmployeeTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"><tr>
          <th className="text-left px-4 py-3 font-normal">Code</th>
          <th className="text-left px-4 py-3 font-normal">Name</th>
          <th className="text-left px-4 py-3 font-normal">Email</th>
          <th className="text-left px-4 py-3 font-normal">Department</th>
          <th className="text-left px-4 py-3 font-normal">Status</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--color-border-soft)] hover:bg-[var(--color-surface-2)]/40">
              <td className="px-4 py-3 font-mono">{r.employee_code}</td>
              <td className="px-4 py-3"><Link className="text-[var(--color-accent)] hover:underline" href={`/admin/employees/${r.id}`}>{r.full_name}</Link></td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.email}</td>
              <td className="px-4 py-3">{r.department ?? '—'}</td>
              <td className="px-4 py-3">{r.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create form + server action**

`web/app/(app)/admin/employees/new/actions.ts`:
```ts
'use server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { redirect } from 'next/navigation';

export async function createEmployee(formData: FormData) {
  // Re-verify admin server-side (defence in depth).
  const sbServer = await getSupabaseServer();
  if (!(await fetchIsAdmin(sbServer))) return { error: 'admin only' };

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_ROLE) return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured on the server' };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const email = String(formData.get('email') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const employeeCode = String(formData.get('employee_code') ?? '').trim();
  const department = String(formData.get('department') ?? '').trim() || null;
  const positionId = String(formData.get('position_id') ?? '');
  const role = (formData.get('role') as string) || 'employee';
  const password = String(formData.get('password') ?? '').trim();
  const openingTil = Number(formData.get('opening_til') ?? 0);
  const openingVacation = Number(formData.get('opening_vacation') ?? 0);

  if (!email || !fullName || !employeeCode || !positionId) return { error: 'missing required fields' };

  const { data: { user }, error: createErr } = await admin.auth.admin.createUser({
    email, password: password || undefined, email_confirm: true,
  });
  if (createErr || !user) return { error: createErr?.message ?? 'createUser failed' };

  const { error: insertErr } = await admin.from('users').insert({
    id: user.id,
    org_id: '00000000-0000-0000-0000-000000000001',
    full_name: fullName, email, employee_code: employeeCode, department, position_id: positionId,
  });
  if (insertErr) return { error: insertErr.message };

  await admin.from('user_roles').insert({ user_id: user.id, role });
  if (role === 'admin') {
    // Optional: also grant employee so admin can file their own timesheet. Comment out if not desired.
    await admin.from('user_roles').insert({ user_id: user.id, role: 'employee' }).then(() => {});
  }

  // Seed opening balances dated one week before today's Monday so prior_*_balance lookups succeed
  const today = new Date();
  const dow = today.getDay();
  const daysToMon = (dow + 6) % 7;
  const monday = new Date(today); monday.setDate(today.getDate() - daysToMon);
  const priorMonday = new Date(monday); priorMonday.setDate(monday.getDate() - 7);
  const iso = priorMonday.toISOString().slice(0, 10);

  await admin.from('til_ledger').insert({ user_id: user.id, week_start: iso, opening_balance: openingTil, overtime_earned: 0, til_used: 0, frozen: true, stale: false });
  await admin.from('vacation_ledger').insert({ user_id: user.id, week_start: iso, opening_balance: openingVacation, vacation_used: 0, frozen: true, stale: false });

  redirect('/admin/employees');
}
```

`web/components/admin/EmployeeForm.tsx`:
```tsx
'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEmployee } from '@/app/(app)/admin/employees/new/actions';
import { toast } from 'sonner';

interface Position { id: string; name: string; annual_vacation_hours: number; }

export function EmployeeForm({ positions }: { positions: Position[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        const res = await createEmployee(fd);
        if (res?.error) toast.error(res.error);
      })}
      className="grid gap-3 max-w-xl"
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="employee_code">Employee code</Label><Input id="employee_code" name="employee_code" required /></div>
        <div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
      </div>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
      <div><Label htmlFor="password">Initial password (optional)</Label><Input id="password" name="password" type="text" placeholder="leave blank to require magic-link sign-in" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="position_id">Position</Label>
          <Select name="position_id">
            <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
            <SelectContent>
              {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.annual_vacation_hours}h vacation)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="department">Department</Label><Input id="department" name="department" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="opening_til">Opening TIL (h)</Label><Input id="opening_til" name="opening_til" type="number" step="0.25" defaultValue="0" /></div>
        <div><Label htmlFor="opening_vacation">Opening vacation (h)</Label><Input id="opening_vacation" name="opening_vacation" type="number" step="0.25" defaultValue="0" /></div>
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue="employee">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create employee'}</Button>
    </form>
  );
}
```

`web/app/(app)/admin/employees/new/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { EmployeeForm } from '@/components/admin/EmployeeForm';

export default async function NewEmployeePage() {
  const sb = await getSupabaseServer();
  const { data: positions } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold">Add employee</h2>
      <EmployeeForm positions={positions ?? []} />
    </div>
  );
}
```

- [ ] **Step 3: Employee detail page**

`web/app/(app)/admin/employees/[id]/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ id: string }> }

export default async function EmployeeDetail({ params }: Props) {
  const { id } = await params;
  const sb = await getSupabaseServer();
  const { data: u } = await sb.from('users').select('id, full_name, email, employee_code, department, is_active, position_id').eq('id', id).maybeSingle();
  if (!u) notFound();
  const { data: pos } = await sb.from('positions').select('name, annual_vacation_hours').eq('id', u.position_id).maybeSingle();
  const { data: weeks } = await sb.from('timesheets').select('id, week_start, status').eq('user_id', id).order('week_start', { ascending: false }).limit(20);
  const { data: til } = await sb.from('v_til_balance').select('closing_balance').eq('user_id', id).maybeSingle();
  const { data: vac } = await sb.from('v_vacation_balance').select('closing_balance').eq('user_id', id).maybeSingle();

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{u.employee_code}</div>
        <h2 className="text-xl font-semibold">{u.full_name}</h2>
        <div className="text-sm text-[var(--color-text-muted)]">{u.email} · {pos?.name ?? 'no position'} · {u.department ?? 'no dept'}</div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">TIL balance</div>
          <div className="text-2xl font-mono">{Number(til?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Vacation balance</div>
          <div className="text-2xl font-mono">{Number(vac?.closing_balance ?? 0).toFixed(2)} h</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Recent weeks</h3>
        <ul className="space-y-1 text-sm">
          {(weeks ?? []).map((w) => (
            <li key={w.id}><Link className="text-[var(--color-accent)] hover:underline" href={`/admin/employees/${id}/week/${w.week_start}`}>{w.week_start}</Link> — <span className="text-[var(--color-text-muted)]">{w.status}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Server env requires SUPABASE_SERVICE_ROLE_KEY**

Add to `web/.env.local.example`:
```
SUPABASE_SERVICE_ROLE_KEY=__paste_from_supabase_status__
```

And update `web/README.md` accordingly.

- [ ] **Step 5: Build + smoke**

```
cd web && npm run build
```

Visit `/admin/employees` → list. Click Add → fill the form → submit → returns to list with new row.

- [ ] **Step 6: Commit**

```
git add web/
git commit -m "feat(web): admin employee list, create form (server action), and detail page"
```

---

### Task 5: Projects + positions admin

**Files:**
- Create: `web/app/(app)/admin/projects/page.tsx`
- Create: `web/app/(app)/admin/projects/actions.ts`
- Create: `web/components/admin/ProjectsTable.tsx`
- Create: `web/components/admin/ProjectForm.tsx`
- Create: `web/app/(app)/admin/positions/page.tsx`
- Create: `web/app/(app)/admin/positions/actions.ts`
- Create: `web/components/admin/PositionsTable.tsx`

- [ ] **Step 1: Projects actions**

`web/app/(app)/admin/projects/actions.ts`:
```ts
'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';

export async function createProject(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const number = Number(formData.get('project_number'));
  const name = String(formData.get('name') ?? '').trim();
  if (!Number.isInteger(number) || number < 2020000 || number > 2099999 || number % 1000 < 1 || number % 1000 > 999) {
    return { error: 'project_number must be YYYY + 3-digit sequence (e.g. 2026101)' };
  }
  if (!name) return { error: 'name required' };
  const { error } = await sb.from('projects').insert({
    org_id: '00000000-0000-0000-0000-000000000001',
    project_number: number, name,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/projects');
}

export async function setProjectStatus(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  if (status !== 'active' && status !== 'closed') return { error: 'bad status' };
  const { error } = await sb.from('projects').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/projects');
}
```

- [ ] **Step 2: Projects page + components**

`web/components/admin/ProjectForm.tsx`:
```tsx
'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProject } from '@/app/(app)/admin/projects/actions';
import { toast } from 'sonner';

export function ProjectForm() {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        const res = await createProject(fd);
        if (res?.error) toast.error(res.error);
        else toast.success('Project added');
      })}
      className="flex items-end gap-2"
    >
      <div className="flex-1 max-w-xs"><Label htmlFor="project_number">Project #</Label><Input id="project_number" name="project_number" type="number" placeholder="2026101" required /></div>
      <div className="flex-1"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add project'}</Button>
    </form>
  );
}
```

`web/components/admin/ProjectsTable.tsx`:
```tsx
'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setProjectStatus } from '@/app/(app)/admin/projects/actions';

interface Row { id: string; project_number: number; name: string; status: 'active' | 'closed'; }

export function ProjectsTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"><tr>
          <th className="text-left px-4 py-3 font-normal">Number</th>
          <th className="text-left px-4 py-3 font-normal">Name</th>
          <th className="text-left px-4 py-3 font-normal">Status</th>
          <th className="px-4 py-3"></th>
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-3 font-mono">{p.project_number}</td>
              <td className="px-4 py-3">{p.name}</td>
              <td className="px-4 py-3">{p.status}</td>
              <td className="px-4 py-3 text-right">
                <form action={(fd) => start(async () => { await setProjectStatus(fd); })}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={p.status === 'active' ? 'closed' : 'active'} />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>
                    {p.status === 'active' ? 'Close' : 'Re-open'}
                  </Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`web/app/(app)/admin/projects/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import { ProjectForm } from '@/components/admin/ProjectForm';

export default async function ProjectsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('projects').select('id, project_number, name, status').order('project_number', { ascending: false });
  return (
    <div className="px-6 py-6 space-y-6">
      <h2 className="text-lg font-semibold">Projects</h2>
      <ProjectForm />
      <ProjectsTable rows={(data ?? []) as ({ id: string; project_number: number; name: string; status: 'active' | 'closed' })[]} />
    </div>
  );
}
```

- [ ] **Step 3: Positions page**

`web/app/(app)/admin/positions/actions.ts`:
```ts
'use server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchIsAdmin } from '@/lib/role';
import { revalidatePath } from 'next/cache';

export async function updatePositionVacation(formData: FormData) {
  const sb = await getSupabaseServer();
  if (!(await fetchIsAdmin(sb))) return { error: 'admin only' };
  const id = String(formData.get('id'));
  const hrs = Number(formData.get('annual_vacation_hours'));
  if (!Number.isFinite(hrs) || hrs < 0) return { error: 'hours must be ≥ 0' };
  const { error } = await sb.from('positions').update({ annual_vacation_hours: hrs }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/positions');
}
```

`web/components/admin/PositionsTable.tsx`:
```tsx
'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePositionVacation } from '@/app/(app)/admin/positions/actions';

interface Row { id: string; name: string; annual_vacation_hours: number; }

export function PositionsTable({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"><tr>
          <th className="text-left px-4 py-3 font-normal">Position</th>
          <th className="text-left px-4 py-3 font-normal">Annual vacation hrs</th>
          <th className="px-4 py-3"></th>
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-3">{p.name}</td>
              <td className="px-4 py-3">
                <form action={(fd) => start(async () => { await updatePositionVacation(fd); })} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="annual_vacation_hours" type="number" step="0.25" defaultValue={p.annual_vacation_hours} className="w-32" />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>Save</Button>
                </form>
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`web/app/(app)/admin/positions/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { PositionsTable } from '@/components/admin/PositionsTable';

export default async function PositionsPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb.from('positions').select('id, name, annual_vacation_hours').order('name');
  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold">Positions</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        Changes here affect the spec's documented vacation allocations. New employees inherit the value at the time of creation via the opening-balance field — editing here does NOT retroactively change anyone's current balance.
      </p>
      <PositionsTable rows={data ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Build + commit**

```
cd web && npm run build
git add web/
git commit -m "feat(web): admin projects and positions management"
```

---

### Task 6: Approval log browser

**Files:**
- Create: `web/app/(app)/admin/approvals/page.tsx`
- Create: `web/components/admin/ApprovalLogTable.tsx`

- [ ] **Step 1: Page**

`web/app/(app)/admin/approvals/page.tsx`:
```tsx
import { getSupabaseServer } from '@/lib/supabase/server';
import { ApprovalLogTable } from '@/components/admin/ApprovalLogTable';

export default async function ApprovalLogPage() {
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from('approval_log')
    .select(`
      id, action, at, comment,
      timesheet:timesheets ( id, week_start, user_id, users ( full_name, employee_code ) ),
      actor:users!actor_id ( full_name )
    `)
    .order('at', { ascending: false })
    .limit(200);

  // Flatten
  type Raw = {
    id: number; action: string; at: string; comment: string | null;
    timesheet: { id: string; week_start: string; user_id: string; users: { full_name: string; employee_code: string } | null } | null;
    actor: { full_name: string } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    action: r.action,
    at: r.at,
    comment: r.comment,
    employee: r.timesheet?.users?.full_name ?? '—',
    employee_code: r.timesheet?.users?.employee_code ?? '',
    week_start: r.timesheet?.week_start ?? '',
    actor: r.actor?.full_name ?? '—',
    timesheet_id: r.timesheet?.id ?? '',
    user_id: r.timesheet?.user_id ?? '',
  }));

  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold">Approval log</h2>
      <ApprovalLogTable rows={rows} />
    </div>
  );
}
```

If PostgREST embedding chokes on the `actor:users!actor_id ( … )` syntax (some versions need explicit `!actor_id_fkey`), substitute the FK constraint name.

- [ ] **Step 2: Component**

`web/components/admin/ApprovalLogTable.tsx`:
```tsx
import Link from 'next/link';

interface Row { id: number; action: string; at: string; comment: string | null; employee: string; employee_code: string; week_start: string; actor: string; user_id: string; }

const ACTION_TONE: Record<string, string> = {
  submit: 'var(--color-status-submitted-fg)',
  approve: 'var(--color-status-approved-fg)',
  decline: 'var(--color-status-declined-fg)',
  unlock: 'var(--color-status-declined-fg)',
  imported: 'var(--color-text-muted)',
  ledger_recompute: 'var(--color-text-muted)',
};

export function ApprovalLogTable({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]"><tr>
          <th className="text-left px-4 py-3 font-normal">When</th>
          <th className="text-left px-4 py-3 font-normal">Action</th>
          <th className="text-left px-4 py-3 font-normal">Employee</th>
          <th className="text-left px-4 py-3 font-normal">Week</th>
          <th className="text-left px-4 py-3 font-normal">Actor</th>
          <th className="text-left px-4 py-3 font-normal">Comment</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-3 font-mono text-xs">{new Date(r.at).toISOString().replace('T', ' ').slice(0, 16)}</td>
              <td className="px-4 py-3" style={{ color: ACTION_TONE[r.action] ?? 'inherit' }}>{r.action}</td>
              <td className="px-4 py-3"><Link href={`/admin/employees/${r.user_id}/week/${r.week_start}`} className="hover:underline">{r.employee} <span className="text-xs text-[var(--color-text-muted)] font-mono">({r.employee_code})</span></Link></td>
              <td className="px-4 py-3 font-mono">{r.week_start}</td>
              <td className="px-4 py-3">{r.actor}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.comment ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add web/
git commit -m "feat(web): admin approval log browser"
```

---

### Task 7: End-to-end Playwright — submit → approve → unlock cascade

**Files:**
- Create: `web/tests/e2e/admin-approve-flow.spec.ts`

(Requires the existing `web/tests/e2e/setup.ts` from earlier Playwright work.)

- [ ] **Step 1: Spec**

`web/tests/e2e/admin-approve-flow.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { provisionEmployee } from './setup';
import { createClient } from '@supabase/supabase-js';

test('employee submits, admin approves, employee sees lock', async ({ browser }) => {
  const empEmail = `e2e-emp-${Date.now()}@example.com`;
  const admEmail = `e2e-admin-${Date.now()}@example.com`;
  const password = 'CorrectHorse9!';
  const empCode = `E${Math.floor(Math.random()*9999)}`;
  const admCode = `A${Math.floor(Math.random()*9999)}`;

  const empId = await provisionEmployee(empEmail, password, empCode);
  const admId = await provisionEmployee(admEmail, password, admCode);

  // Promote admin (service-role bypass of RLS via raw client)
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.from('user_roles').insert({ user_id: admId, role: 'admin' });

  // Employee signs in and submits
  const empCtx = await browser.newContext();
  const empPage = await empCtx.newPage();
  await empPage.goto('/login');
  await empPage.getByLabel('Email').fill(empEmail);
  await empPage.getByLabel('Password').fill(password);
  await empPage.getByRole('button', { name: 'Sign in' }).click();
  await expect(empPage).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}/);

  // Add a row
  await empPage.getByRole('combobox').first().click();
  await empPage.getByRole('option', { name: 'Admin' }).click();
  await empPage.getByRole('combobox').nth(1).click();
  await empPage.getByRole('option', { name: 'Administrative' }).click();
  await empPage.getByLabel('Mon hours row 1').fill('8');
  await empPage.getByPlaceholder('Description required').fill('e2e wk');
  await empPage.getByRole('button', { name: 'Save draft' }).click();
  await empPage.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(empPage.getByText('Submitted for approval')).toBeVisible();

  // Admin signs in and approves
  const admCtx = await browser.newContext();
  const admPage = await admCtx.newPage();
  await admPage.goto('/login');
  await admPage.getByLabel('Email').fill(admEmail);
  await admPage.getByLabel('Password').fill(password);
  await admPage.getByRole('button', { name: 'Sign in' }).click();
  await admPage.goto('/admin');
  await admPage.getByRole('link', { name: /Review/ }).first().click();
  await admPage.getByRole('button', { name: 'Approve' }).click();
  await expect(admPage.getByText('Approved')).toBeVisible();

  // Employee reloads → sees locked banner
  await empPage.reload();
  await expect(empPage.getByText(/Approved — this week is locked/)).toBeVisible();
});
```

- [ ] **Step 2: Run**

```
cd web && npm run test:e2e
```

- [ ] **Step 3: Commit**

```
git add web/tests
git commit -m "test(web): e2e — submit→approve→lock end-to-end"
```

---

### Task 8: Final sweep + README

**Files:**
- Modify: `web/README.md`
- Modify: root `README.md`

- [ ] **Step 1: Update `web/README.md`** to list `/admin/...` routes.

- [ ] **Step 2: Update root `README.md`** — mark Plan 3 complete:
```markdown
- Plan 2: Employee web app — COMPLETE
- Plan 3: Admin web app — **COMPLETE**
- Plan 4: Historical importer (Excel → DB)
```

- [ ] **Step 3: Final check**

```
cd web && npx tsc --noEmit && npm run build && npm run test:unit
```

- [ ] **Step 4: Commit**

```
git add web/README.md README.md
git commit -m "docs: mark Plan 3 complete"
```

---

## Self-Review

- **Spec coverage** (§6.1 admin routes): `/admin`, `/admin/users` (→ `/admin/employees`), `/admin/projects`, `/admin/approvals`, `/admin/employees/[id]/week/[ws]` — all implemented across Tasks 1-6. `positions` page added beyond the spec route list (spec mentions position vacation hrs in §2.3). All admin RPCs from Plan 1 are surfaced.
- **ABAC enforcement (§4):** every server action calls `fetchIsAdmin` defence-in-depth before mutating; the admin layout redirects non-admins; RLS continues to gate row visibility at the DB level.
- **Unlock cascade (§6.3):** UnlockDialog calls `unlock_timesheet` RPC; cascade happens server-side on subsequent re-approve. Toast copy explains the cascade behaviour.
- **Service-role key** is referenced only inside server actions (`new/actions.ts`). Server actions run on the server; the key never reaches the client. `.env.local.example` documents the variable.
- **Placeholders:** none.
- **Type consistency:** `QueueRow`, `approveTimesheet`/`declineTimesheet`/`unlockTimesheet`, `DecisionBar`, `EmployeeForm`, `ApprovalQueue`, `ApprovalLogTable` consistent across tasks.

---

## Out of scope for Plan 3 (deferred)

- **Edit employee** (change name/position/role after creation). v1 supports create + view; full edit is v1.1.
- **Email notifications** on approve/decline/unlock. v1.1.
- **Bulk approve** of multiple weeks at once. v1.1.
- **CSV export** of approved weeks. v1.1.
