# SRE Nexus — Next Steps

Rebrand: **web app → SRE Nexus** (nav/logo/title/meta).

---

## Part A — Bug fixes surfaced by Utsav (do first)

### Timesheet / TIL
- `TIL history`: reconcile "current balance" with "overtime earned lifetime". Both should be derivable from `opening_balance + sum(earned) − sum(used)`. Right now they diverge (561h vs 19.25h).
- Timesheet form: `TIL remaining` shows `0` — should show **running lifetime balance** (not per-week). Same for vacation hours.
- Pending drafts must factor into the balance shown on subsequent drafts (draft 9h OT on top of 561 → next draft shows 570 as the starting point). Recompute on admin approve/reject.

### Expenses
- Merge `status` and `payment` columns into one — the `status` column duplicates and is inaccurate. Utsav's 7 reports: 4 + #6 paid, most in 2 tranches.
- Support **partial payments**: admin field for amount paid per tranche, derived `% paid`. Row `status` = `unpaid | partial | paid` from that.
- Image upload: bump limit to **10–15MB** AND add **client-side compression** before upload (target ~2MB after compress). Phone photos routinely exceed 5MB.

### Notifications
- Add browser/OS push (currently only in-app bell).
- Add optional email reminders (per-user toggle).

### Admin
- Deferred. Ashley on vacation; revisit after CRM foundation.

### Rollout
- Enable subscriptions for Kunal, Curtis first (once Venn funds land), then Ashley + Dharmesh.

---

## Part B — CRM sales pipeline (plan-ahead, wire up when GHL endpoint is ready)

**Placement:** New top-nav tab inside SRE Nexus. Same codebase. Not a subdomain.

**Direction:** Confirm with Maaz before shipping — his vision is Claude-MCP-driven, no manual GHL logins.

### Data model (Supabase)
```
leads
  id, number (SRE-Q26NN), client_id, site_id, contact_id,
  scope_title, project_type, currency (USD|EUR|CAD),
  proposal_value, stage, region,
  engineer_id (assigned), created_at, updated_at
lead_stage_history       (audit: from, to, at, by)
lead_documents           (kind: rfq|tech_proposal|comm_proposal|po|invoice, sharepoint_url, uploaded_at)
lead_activity            (kind: email|meeting|note|followup_sent, body, at, by)
followups                (lead_id, due_at, done, notify_engineer, notify_admin)
invoices                 (lead_id, number, sent_date, terms_days, expected_date, amount, currency, paid_amount, paid_date)
```

Reuse existing `clients` table. Add `contacts` (client_id, name, role, email, phone) + `sites` (client_id, name, address, lat, lng) — will be shared with Directory in Part C.

### Pipeline stages (8)
`Inquiry → Technical Proposal (in prep) → Proposal Sent → Follow-up → Approved → Won → Lost` (+ `On Hold`)

Do **not** auto-draft emails/proposals. Proposal skill stays manual per Utsav — automation risks lazy QC.

### Multi-currency
- Currency chosen per-lead at creation (default by region: ME/US → USD, EU → EUR, CA → CAD).
- FX conversion for aggregate reporting via existing Claude MCP FX skill (target: CAD for internal rollups).
- Expenses stay CAD-only (unchanged).

### Kanban UI
- Board view with 8 stage columns + card drag between stages.
- Filters: All / By country / By region / By engineer / By stage / By currency.
- Card: number, client, scope, value+currency, engineer avatar, deadline, SharePoint URL icon.
- Analytics strip: MoM/YoY won value, close rate per stage, avg cycle time.

### SharePoint integration
- **Weekly scan** of `/Projects/{year}/{client}/...` folders → seed/update leads.
- Historical backfill from Utsav's master client list (already have lat/lng from clients-map seed — reuse).
- Only surface **relevant subfolder URLs per stage**:
  - Inquiry/Proposal stages → `Emails`, `Meetings`, `Proposals`, `PO`
  - After `Won` → hand off to Projects module (Part C), CRM stops surfacing execution folders.
- Skip folders 2–9 in the CRM UI (they're for execution, not sales).
- **Known gap:** Middle East team doesn't follow folder conventions. Either enforce (org-level ask) or add a manual "attach SharePoint URL" fallback per lead.

### Approved → Projects handoff
When lead moves to `Approved`:
1. Create `project` record (Part C) with: client, site, contacts, PO, currency, value, engineer.
2. Claude MCP job: bundle all `Emails/*` from the lead's SharePoint folder → single PDF + short summary (what happened, next steps, deadlines) → drop into project's `Emails` folder.
3. Notify assigned engineer + admin.

**Build the Projects module (Part C) first**, then wire this automation.

### Follow-up automation
- Weekly scan: for leads in `Proposal Sent` with no `followup_sent` in last N days → create `followup` row + notify engineer (in-app + optional email). Admin gets a digest of *all* pending follow-ups (nag backup).
- Per-user summary channel: distinct views for admin vs engineer (admin sees everyone; engineer sees own).

### Invoice / payment tracking (the real gap)
Separate tab under CRM (or after `Won` stage — decide with Maaz):
- Fields: `invoice_number, sent_date, PO_number, terms (net 30/60), expected_payment_date, amount, currency, paid_amount, paid_date`.
- Auto-remind admin when `expected_payment_date` passes with `paid_amount < amount`.
- Cash-flow view: pipeline of expected inflows over next 90 days (grouped by currency, converted to CAD total).
- Human-in-loop: engineer or admin manually ticks "payment received" + attaches invoice PDF.

### Meeting transcripts
Not part of app work — but decision needed org-side:
- Evaluate **Granola** (silent recording, one seat trial) vs **Whisperflow** (desktop meeting record already; verify mobile + MCP).
- Whichever wins: expose its MCP so Claude can pull transcripts into `lead_activity` and project `Meetings` folder.

### Endpoint contract (what we need from GHL side)
When Maaz's GHL is ready, we need:
- `POST /leads` (create from inquiry email)
- `PATCH /leads/:id` (stage change, field updates)
- `GET /leads?stage=&engineer=&updated_since=` (sync poll)
- Webhook: stage change → SRE Nexus (so Kanban stays in sync)

App-side is stack-agnostic — if GHL endpoint changes shape, only the sync adapter changes. All CRM UI/logic reads from local Supabase.

### Build order (once fixes ship)
1. Data model + migrations.
2. Read-only Kanban seeded from SharePoint scan (no GHL yet).
3. Lead detail page + stage transitions (writes to local DB only).
4. Follow-up automation + notifications.
5. Invoice tab.
6. GHL sync adapter (last — plug into steps 2–3 once endpoint contract lands).
7. Analytics strip.

---

## Part C — Projects module

See [`projects-dashboard-plan.md`](./projects-dashboard-plan.md). Depends on: Part A fixes shipped; can build in parallel with Part B foundation.
