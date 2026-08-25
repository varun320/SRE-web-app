# SRE App — Sales Dashboard Prototype Spec

Hand-off doc for the agent working in the **SRE web app** repo (separate dir). The GHL pipeline, seed, cron and summary aggregator already exist in `SRE-GHL-automations/`. This doc says what to build **inside the SRE app** so the two halves plug together.

---

## 1. What the SRE app owns

Three surfaces under `web/app/(app)/admin/sales/`:

| Route | Purpose |
|---|---|
| `/admin/sales` | Kanban mirror of GHL "SRE Sales" pipeline. Read-mostly. Click-to-change-stage. |
| `/admin/sales/summary` | Exec summary (pipeline value, win rate, top customers, aging, by country). |
| Notification bell (global nav) | In-app inbox for sales events. |

GHL is the system of record. The SRE app is a **read/write client + SRE-specific summary + notification inbox**. Do not rebuild Kanban primitives.

Access: admin-only route group. Reuse existing admin auth guard.

---

## 2. Data source

The SRE app talks to GHL through the automations service, **not directly to GHL**. All GHL secrets stay server-side in the automations repo. Endpoints the SRE app consumes (all served by `SRE-GHL-automations`, HMAC-signed with `SRE_APP_SHARED_SECRET`):

```
GET  /api/opportunities            → Opportunity[]      (mirror of listOpportunities)
GET  /api/opportunities/:id        → Opportunity + notes + tasks
PATCH /api/opportunities/:id/stage → { stage: OpportunityStage }
POST /api/opportunities/:id/notes  → { body: string }
GET  /api/summary                  → Summary            (shape below)
GET  /api/stages                   → { name, id }[]
```

If these endpoints don't exist yet in the automations service, stub them in the SRE app with a typed fetch layer against the shapes below — the automations side will match.

---

## 3. Types (copy verbatim, keep in sync)

```ts
export const OPPORTUNITY_STAGES = [
  "Inquiry",
  "Technical Proposal",
  "Commercial Proposal",
  "Proposal Sent",
  "Follow-up",
  "Approved",
  "Won",
  "Lost",
] as const;
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export interface Opportunity {
  id: string;
  name: string;                     // "Customer — SRE-2026-XXXX"
  status: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  pipelineStageId: string;
  contactId?: string;
  customFields?: {
    sre_proposal_number?: string;
    sre_proposal_sharepoint_url?: string;
    sre_customer_country?: string;
    sre_assigned_engineer?: string;      // display name
    sre_engineer_user_id?: string;       // stable SRE-app UUID (routing key)
    sre_last_followup_at?: string;
    sre_next_action?: string;
    sre_scope_type?: "Study" | "EPC" | "RFQ" | "NDA" | "Other";
  };
  updatedAt: string;
}

export interface Summary {
  generatedAt: string;
  totalOpportunities: number;
  byStage: { stage: string; count: number; value: number }[];
  winRate90d: { won: number; lost: number; ratePct: number };
  topCustomers: { customer: string; value: number; count: number }[];
  agingDeals: { id: string; name: string; stage: string; daysInStage: number }[];
  byCountry: { country: string; count: number; value: number }[];
}
```

---

## 4. `/admin/sales` — Kanban mirror

**Layout:**
- Header strip (KPIs, single row):
  `Inquiries: N | Proposals sent: M | Approved: K | Won this month: J`
- Filter tabs (reuse existing `SectionTabs`): `All | My deals | By country | By stage`
- Kanban body: 8 columns in stage order. Each column shows count + total $ in header.
- Card content: customer name, proposal number, monetary value, assigned engineer avatar/initials, days in stage badge (red if ≥30d), SharePoint link icon.

**Interactions:**
- v1 = **click card → drawer**. Drawer shows: SharePoint link, custom fields, latest 5 notes, tasks, stage dropdown (PATCH on change), inline note composer (POST).
- Drag-drop is out of scope for v1. `ponytail: click-to-change-stage, add drag-drop only if Mohammad asks`.

**"My deals" filter:** current user's `SRE app user UUID` matched against `customFields.sre_engineer_user_id`. Not against display name.

**Empty & loading:** skeleton columns (not spinners). Empty column shows `—`.

---

## 5. `/admin/sales/summary` — Exec summary

Single page. Sections top-to-bottom:

1. **Header:** "SRE Sales — Exec Summary", generatedAt timestamp, print button.
2. **Pipeline by stage** — horizontal bar chart (count + $ value labels).
3. **Win rate (90d)** — big number `X%` + "N won / M lost" caption.
4. **Top customers by value** — table, 5 rows, columns: Customer, Deals, Total value.
5. **Aging deals (≥30d in stage)** — table, top 10 by daysInStage, columns: Days, Stage, Deal.
6. **By country** — table sorted by value desc.

**PDF:** skip. Use print-friendly CSS (`@media print`). Add real PDF export only if requested.

Chart lib: whatever the SRE app already uses. Do not add a new charting dep.

---

## 6. In-app notifications

**Table** (Supabase/whatever the app uses):

```sql
create table sales_notifications (
  id           uuid primary key default gen_random_uuid(),
  engineer_id  uuid not null,             -- SRE app user UUID (matches sre_engineer_user_id)
  category     text not null,             -- see enum below
  opportunity_id text not null,           -- GHL opportunity id
  title        text not null,
  body         text,
  action_url   text,                      -- deep link into /admin/sales?opp=<id>
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index on sales_notifications (engineer_id, read_at, created_at desc);
```

**Categories** (start with these — extend as new GHL events surface):

- `follow_up_due` — stale opportunity in Proposal Sent / Follow-up
- `approval_needed` — moved to Approved, awaiting sign-off
- `declined` — Lost stage set with reason
- `lost` — Lost stage set
- `won` — Won stage set
- `stage_changed` — any transition (opt-in per user, off by default)
- `assigned` — engineer set on an opportunity
- `note_added` — new GHL note on an owned opportunity

**Ingress endpoint** (SRE app hosts, automations service calls):

```
POST /api/notifications
Headers: X-SRE-Signature: hmac-sha256(SRE_WEBHOOK_SECRET, rawBody)
Body: {
  engineerId: string,        // sre_engineer_user_id
  category:  string,         // one of the enum above
  opportunityId: string,
  title: string,
  body?: string,
  actionUrl?: string
}
```

- Verify HMAC before insert. Reject on mismatch (401).
- Idempotency: if `(engineerId, category, opportunityId, roundedToDay(createdAt))` already exists unread, skip insert (prevents cron re-emission spam).
- On insert, no push, no email. In-app only for v1.

**UI:**
- Bell icon in global nav, badge with unread count (cap at "9+").
- Popover: grouped by category (`Follow-ups (3) · Stage changes (2) · Notes (1)`), each row clickable → `actionUrl`.
- Marking as read: on popover open, batch-mark visible items after 2s dwell OR on click.
- Full page: `/notifications` — same list, filterable by category, load-more paginated.

---

## 7. Wiring back to the automations repo

Env vars the SRE app needs:

```
SRE_AUTOMATIONS_URL=https://sre-ghl.internal
SRE_WEBHOOK_SECRET=<shared with automations repo>
```

The automations repo will:
- Call `POST {SRE_APP_URL}/api/notifications` from `followup-cron.ts` and `webhook-handler.ts`.
- Expose the `/api/opportunities*` and `/api/summary` endpoints listed in §2.

If the automations service is down: Kanban and summary pages show a banner "Live sync unavailable — last known data from Xh ago" and fall back to a cached snapshot (Redis / in-memory / whatever). Do not white-screen.

---

## 8. Build order (prototype)

1. Types + fetch client stub with hardcoded fixture data (mirror shape from §3).
2. `/admin/sales` Kanban with fixture — nail layout and card design first.
3. Card drawer + stage change PATCH (still against fixture).
4. `/admin/sales/summary` with fixture Summary.
5. Notifications table + `POST /api/notifications` + bell UI, seeded with fixture rows.
6. Swap fixture client for real `SRE_AUTOMATIONS_URL` calls.
7. Print CSS for summary, admin auth guard on the route group.

Skipping until Mohammad asks: drag-drop, PDF, mobile-specific views, push notifications, email digest.

---

## 9. Test hooks

- Fixture mode: `SRE_SALES_FIXTURES=1` returns the fixtures instead of hitting the automations service. Lets the SRE app boot without the sidecar running.
- One playwright smoke: open `/admin/sales` → assert 8 columns render → click first card → drawer opens → change stage → PATCH is fired.
- One assert-based unit test on the notification HMAC verifier.

---

## 10. Non-goals (write these down so future-you doesn't re-open them)

- No custom Kanban engine. GHL owns drag-drop; we click.
- No bidirectional field sync. SRE app writes only: stage, notes.
- No mobile-only layout. Responsive is enough.
- No inbox digest email in v1. In-app only.
- No new charting library. Use what the app already has.
- No direct GHL API calls from the browser. Everything routes through the automations service.
