# SRE Timesheet — Brand Guidelines

> **Audience.** Designers and engineers building the SRE Timesheet + Expense + Vacation app. This document defines *how the product sounds and feels*. For visual specifications, see `DESIGN.md`.
>
> **Product.** An internal HR/ops app for Sulfur Recovery Engineering (SRE) — an oil & gas engineering firm. Timesheet entry, expense reports, vacation tracking, and admin approvals.

---

## 1. Positioning

**SRE Timesheet is the calm, professional back-office app that SRE's engineers, accountants, and management use to close the week.** It replaces a stack of Excel workbooks, Outlook attachments, and QuickBooks re-entry with one place to log hours, submit expenses, request vacation, and approve them all. The people using it — engineering managers, project accountants, the CEO — are not power users. They are competent professionals who live in Excel and Outlook and want software that respects their time, doesn't lecture them, and prints cleanly for the audit binder.

We are not building a consumer app. We are not building a "modern dev tool." We are building **the calm HR/ops surface for a serious industrial firm** — closer to BambooHR or Gusto in feel, closer to QuickBooks Time or Harvest in mechanics, closer to Ramp in design polish.

---

## 2. Personality attributes

Each attribute is paired with the anti-example the team already agreed to avoid.

### Confident, not corporate
We write short, declarative sentences. We say what things do. We do not hedge behind "please" or add "kindly" as filler. But we also don't ape enterprise vendor voice — no "empowering your workforce," no "transformative solutions," no capitalized nouns like "Team Members." A person who spent 25 years in an oil-and-gas back office should read the UI and feel it was written by a colleague, not a marketing team.

### Warm, not cutesy
The palette is warm. The tone is warm. But we are not Slack. No exclamation marks on error states. No "Woohoo!" on success. No emoji in system messages. Warmth comes from acknowledging the person on the other side of the screen — "Your week is saved. Send it whenever you're ready." — not from performative cheerfulness.

### Precise, not clinical
Numbers are exact. Dates are exact. When we say a timesheet was submitted, we tell the user *when* and *to whom*. We prefer "Approved by Talha · Jul 8" to "Status: Approved." But we are not a spreadsheet. We do not surface every internal ID, we do not label buttons with system-speak like "Persist Draft," and we do not tell the user "Error: 422" — we tell them what went wrong and what to do next.

### Professional, not dated
This is the hardest one. The oil & gas industry has a house style that looks like a 2007 SharePoint intranet: blue bars, gradient buttons, drop shadows, and Trade Gothic. We're rejecting that entirely. We look like a 2026 app that a serious company built — clean type, one accent color used with discipline, warm neutrals, no chrome. But we are *not* a consumer SaaS marketing homepage. No hero cards with animated gradients on the dashboard. No "Get started with a template!" empty states. No emoji-driven celebration screens.

### Human, not chatty
We use contractions ("you're," "we've," "it's"). We use first person plural sparingly ("We couldn't save your changes — try again?"). We never invent a mascot. We never name a feature after a person or a metaphor ("The Timesheet Wizard"). The product does not have a personality; the *people writing to the user* do.

---

## 3. Voice principles

### 3.1 Plain-English button labels

Buttons name the action from the user's point of view, in the user's language.

| Instead of | Say |
|---|---|
| Submit | Send for approval |
| Cancel | Discard changes |
| OK | Got it |
| Save | Save draft |
| Delete | Remove |
| Confirm | Yes, decline this expense |
| Proceed | Continue |
| Approve All Selected | Approve 4 timesheets |
| No | Keep editing |
| Update | Save changes |
| Reset | Clear all |
| Enter | Add row |

**Rule:** the button label should read as a natural completion of the sentence "I want to \_\_\_\_." If it doesn't, rewrite it.

### 3.2 Human error copy

Error messages have three parts: what happened, why (if useful), what to do next. Never blame the user.

| Bad | Good |
|---|---|
| Invalid input. | That doesn't look like a valid date. Try MM/DD/YYYY. |
| Error 500: server error. | Something went wrong on our end. Your changes are saved as a draft — try sending again in a minute. |
| You cannot submit this timesheet. | You've already logged 168 hours this week — that's more than a week has. Adjust one of the rows to send it in. |
| Field required. | Add a project code before saving. |
| Login failed. | We didn't recognize that email or password. Try again, or reset your password. |

### 3.3 Banned words

Do not use these in any user-facing surface (buttons, labels, help text, toasts, empty states, marketing).

- **Utilize** (use "use")
- **Leverage** (use "use")
- **Empower**, **empowering**
- **Solution**, **solutions** (say what it actually is — "the timesheet," "the approval flow")
- **Seamless**, **seamlessly**
- **Robust**
- **Delightful**, **delight**
- **Woohoo**, **Yay**, **Awesome!**
- **Oops** (in error states — patronizing)
- **Kindly** (as filler, e.g. "Kindly submit your timesheet")
- **Please note that…** (just say it)
- **Team Members** capitalized (they are employees, or teammates, or people)
- **Onboarding journey**
- **World-class**, **best-in-class**, **industry-leading**
- **Synergy**, **synergies**
- **Circle back**, **touch base**, **loop in**
- **Ping** (as a verb for messaging)
- **Time & Attendance** (Title Case corporate — use "Timesheets")

### 3.4 Prefer these phrasings

| Instead of | Prefer |
|---|---|
| Time & Attendance | Timesheets |
| Personal Time Off (PTO) | Vacation |
| Expense Report | Expense report *(sentence case — no title case)* |
| Employee ID | ID |
| Team Member | employee, or the person's name |
| Manager | approver, or the person's name |
| Please submit your timesheet by Friday | Send your timesheet by Friday |
| We are unable to process | We can't process |
| Not applicable / N/A | leave the cell empty, or "—" |
| $0.00 | $0 *(never trailing zeros on whole dollars in tables)* |
| Approved on 07/08/2026 at 14:32 UTC | Approved Jul 8 · 9:32 AM |
| View all → | See all |
| Load more | Show more |
| Filter | Filter by… (state what you filter on) |

### 3.5 Sentence case, always

Buttons, headings, labels, menu items, table columns, tabs — **sentence case**. Only proper nouns and product names are capitalized.

- ✅ "Send for approval," "This week," "Add expense," "Project code"
- ❌ "Send For Approval," "This Week," "Add Expense," "Project Code"

The one exception: the wordmark "SRE Timesheet" and the parent brand "Sulfur Recovery Engineering."

### 3.6 Numbers, dates, and times

- **Currency:** `$1,240` — no trailing `.00` on whole dollars in tables. In detail views and totals where cents matter, show them: `$1,240.55`. Always US dollars unless a future release adds multi-currency.
- **Hours:** `7.5 h` in dense views, `7.5 hours` in prose. Never `7:30` unless it is a clock time.
- **Percent:** `82%`, no space. Use `pp` for percentage points if we ever show deltas.
- **Dates:** `Jul 8`, `Jul 8, 2026`, or `2026-07-08` in exports/prints. Never `07/08/2026` in the UI (ambiguous internationally, and the audience skews older and dislikes ambiguity).
- **Times:** `9:32 AM`, `2:15 PM`. 12-hour format. Include the timezone abbreviation only when it isn't the user's local zone.
- **Ranges:** `Jul 6 – Jul 12` (en dash, spaces).
- **Tabular numerals** in every column of numbers, and in every KPI value. See `DESIGN.md`.

---

## 4. Tone by surface

The product speaks to two audiences on two very different days. The voice shifts, the values don't.

### 4.1 Employee-facing (weekly timesheet, expense entry, vacation request)

**Encouraging, forgiving, low-friction.** These are people doing an administrative chore at the end of a long week. They will forget hours. They will type the wrong project code. They will submit twice.

Tone rules:
- Never scold. If they save a partial timesheet, say "Saved as draft" — not "Timesheet incomplete."
- If they exceed 40 hours, acknowledge it neutrally: "That's 46 hours this week — send it if that's right." Do not say "Warning: Overtime exceeded."
- Save-on-blur, always. Don't make them press Save. If they navigate away, the row is saved.
- Recover their state. If they hit "Send for approval" and something fails, keep the draft.
- One CTA per screen, obvious and prominent.

**Example strings:**
- Empty state on Monday morning: "New week. Add your first entry to get started."
- Draft saved indicator (subtle, below the grid): "Draft saved · 9:14 AM"
- Post-submit toast: "Sent to Talha for approval."
- Overtime nudge (inline, not a modal): "That's 46 h this week. Send it if that's right, or adjust the rows."

### 4.2 Admin-facing (approvals, reports, employee management)

**Calm, decisive, respects their time.** Admins process a stack. They want counts, filters, keyboard shortcuts, and bulk actions. Don't get in their way with celebration.

Tone rules:
- Show counts everywhere. "4 timesheets waiting," not "You have pending items."
- Bulk actions on selection: "Approve 3 timesheets" — with the number.
- Never confirm the obvious. Approvals happen instantly with an undo affordance (5s toast). No "Are you sure?" modals for reversible actions.
- Decline **does** require a reason. That's the one place we slow the admin down.
- Use their language: "week," "period," "approver," "project code," "GL code."

**Example strings:**
- Inbox heading: "4 timesheets waiting for you"
- Bulk toolbar: "Approve 3 · Decline 3 · Deselect"
- Decline modal title: "Send this back to Maaz?"
- Decline placeholder: "What needs to change? (e.g. Wrong project code on Wed / Missing lunch break)"
- Post-approval toast: "Approved. Undo" *(Undo is a link, 5s)*

### 4.3 Error / decline / lock states

**Specific, actionable, never blame the user.** Every error state gives the user their next move.

Rules:
- Say what happened.
- Say what they can do.
- Never expose stack traces, HTTP codes, or ORM messages.
- If it's our fault, say so plainly. "Something went wrong on our end."

**Examples:**
- Locked week banner: "This week is locked because you sent it for approval on Jul 8. Ask Talha to send it back if you need to change something."
- Declined toast: "Talha sent this back. Reason: Missing project code on Wed. Fix and re-send."
- Server error: "We couldn't save that. Your draft is still here — try again in a minute."
- Validation: "Hours can't be negative."
- No permission: "You don't have access to this. Ask Maaz if you should."

### 4.4 Empty states

**Warm, not preachy.** An empty state is not an opportunity to teach the whole product. It's a nudge toward one obvious action.

Rules:
- One-line description, one CTA.
- Never illustrate a mascot or a floating hand pointing at nothing.
- Use a small monochrome icon (see `DESIGN.md`), not a color illustration.

**Examples:**
- Timesheet: "New week. Add your first entry." *[+ Add entry]*
- Expenses: "No expenses yet this month. Snap a receipt or add one manually." *[+ Add expense]*
- Vacation: "You have 200 h of vacation available. Request a day off when you're ready." *[Request vacation]*
- Approvals inbox: "You're all caught up." *(no CTA)*
- Search no-results: "Nothing matches '\_\_\_'. Try a different name or code."

---

## 5. Product name + wordmark treatment

### 5.1 Name

The product's internal and user-facing name is **SRE Timesheet**.

- On the login page and browser title: `SRE Timesheet`.
- Inside the app, the sidebar shows just the wordmark. Don't repeat "SRE Timesheet" in page titles.
- In email subjects and system messages, use the full name: `SRE Timesheet: Talha approved your Jul 6 – 12 week`.
- The company is **Sulfur Recovery Engineering** in full, **SRE** as the abbreviation in body copy after first mention. Never "SRE, Inc." unless in a legal footer.

### 5.2 Wordmark

- Wordmark is set in the product's display sans (see `DESIGN.md` — Inter Display / Inter, weight 600, tracking `-0.02em`).
- The word **SRE** is in the accent color at 100% (`--color-accent`). The word **Timesheet** is in `--color-text` at 100%.
- Minimum size: 14px. Below that, use only `SRE` mark.
- Clear space: 0.5× the cap-height on all sides.
- Do **not** italicize. Do **not** stretch. Do **not** add a droplet, flame, refinery, or gear icon.
- On dark backgrounds, both words invert to `--color-surface`; the SRE mark keeps the accent tint (`--color-accent-tint`) as a soft highlight — see the dark tokens in `DESIGN.md`.

### 5.3 Favicon / app icon

A single letter **S** in the display sans, weight 700, on a `--color-accent` background, corners `radius-md`. Never a full-color logo. Never an oil-and-gas cliché (drop, flame, well, tank).

---

## 6. Sample copy library

Real strings, ready to paste. Grouped by surface.

### 6.1 Login

- Title: `Sign in to SRE Timesheet`
- Email field: `Work email`
- Password field: `Password`
- Primary button: `Sign in`
- Secondary link: `Forgot password?`
- Error: `We didn't recognize that email or password. Try again, or reset your password.`
- Success (post-login redirect): (silent — go straight to the dashboard)

### 6.2 Dashboard headings

- Employee dashboard title: `This week`
- Employee subtitle (under title): `Jul 6 – Jul 12 · Draft`
- Admin dashboard title: `Approvals`
- Admin subtitle: `4 timesheets · 2 expense reports · 1 vacation request`

### 6.3 Timesheet grid

- Column headers: `Project` · `Category` · `Description` · `Mon` · `Tue` · `Wed` · `Thu` · `Fri` · `Sat` · `Sun` · `Total`
- Add row: `+ Add entry`
- Row action menu: `Duplicate row`, `Clear row`, `Remove`
- Total footer label: `Week total`
- Draft indicator: `Draft saved · 9:14 AM`
- Overtime nudge: `That's 46 h this week. Send it if that's right, or adjust the rows.`
- Primary CTA: `Send for approval`
- Secondary link: `Save and finish later`

### 6.4 Approval side panel (admin)

- Panel title: `Maaz Ahmed · Jul 6 – Jul 12`
- Subtitle: `46 h · sent Jul 8, 9:14 AM`
- Approve button: `Approve`
- Decline button: `Send back`
- Send-back modal title: `Send this back to Maaz?`
- Reason placeholder: `What needs to change? (e.g. Wrong project code on Wed / Missing lunch break)`
- Reason help text: `Maaz will see this note. Be specific so they can fix it quickly.`
- Confirm button: `Send back`
- Post-approve toast: `Approved. Undo`
- Post-decline toast: `Sent back to Maaz.`

### 6.5 Expense report

- Empty state: `No expenses yet this month. Snap a receipt or add one manually.`
- Add: `+ Add expense`
- Fields: `Date`, `Category`, `Vendor`, `Amount`, `Description`, `Receipt`
- Attach receipt link: `Attach receipt`
- Missing receipt warning (inline, not blocking): `No receipt attached. Add one before sending.`
- Category examples: `Travel`, `Meals`, `Materials`, `Software`, `Office`, `Other`
- Submit button: `Send for approval`
- Post-submit: `Sent to Talha for approval.`

### 6.6 Vacation

- Balance card title: `Vacation balance`
- Balance value: `200 h available` (subtitle: `~25 days`)
- Request button: `Request vacation`
- Request form title: `Request vacation`
- Fields: `From`, `To`, `Notes (optional)`
- Submit: `Send for approval`
- Post-submit: `Sent to Maaz for approval.`

### 6.7 Locked / status banners

- Locked (submitted): `This week is locked because you sent it for approval on Jul 8. Ask Talha to send it back if you need to change something.`
- Approved banner: `Approved by Talha · Jul 8, 4:12 PM`
- Declined banner: `Sent back by Talha · Jul 8, 4:12 PM. Reason: "Wrong project code on Wed."` *(with prominent `Edit and re-send` button)*
- Draft banner (subtle, top-right): `Draft · saved 9:14 AM`

### 6.8 Toasts

- Save (rarely shown — most saves are silent): `Saved.`
- Send: `Sent to Talha for approval.`
- Approve: `Approved. Undo`
- Decline: `Sent back to Maaz.`
- Delete: `Removed. Undo`
- Copy: `Copied.`
- Error (generic fallback): `Something went wrong. Try again.`
- Network offline: `You're offline. Changes will save when you reconnect.`

### 6.9 Notifications (email + in-app)

- Approval needed (to admin): `Maaz sent Jul 6 – 12 for approval.`
- Approved (to employee): `Talha approved your Jul 6 – 12 week.`
- Declined (to employee): `Talha sent Jul 6 – 12 back — "Wrong project code on Wed."`
- Reminder (Friday afternoon): `Your Jul 6 – 12 timesheet is still a draft. Send it when you're ready.`

### 6.10 Print / PDF

- Header: `Sulfur Recovery Engineering · Timesheet · Jul 6 – 12, 2026`
- Employee line: `Maaz Ahmed · maaz@sulfurrecovery.com`
- Footer: `Approved by Talha Khan on Jul 8, 2026 at 4:12 PM · Signed electronically`

---

## 7. What we won't do

An anti-checklist. If you see any of these in a mock or a PR, push back.

- ❌ Gradient buttons or gradient hero backgrounds
- ❌ Illustrated empty-state cartoons
- ❌ Emojis in system copy
- ❌ "Congrats!" / "Nice work!" / "🎉" style celebrations after saving a timesheet
- ❌ Modal confirmations for reversible actions
- ❌ Title-Case Buttons Like This
- ❌ Progress bars for "profile completeness"
- ❌ Onboarding tour bubbles that hijack the screen
- ❌ Skeuomorphic imagery — no receipt with curled corners, no clipboard
- ❌ Oil-and-gas visual clichés — no rig silhouettes, no droplet flames, no earth-toned "industrial" gradients
- ❌ Sidebar chrome overload — three levels of nesting, badges everywhere, expand/collapse animations
- ❌ System-speak errors — "Persist failed," "422 Unprocessable Entity," "Null reference in row 4"

---

## 8. When in doubt

Read the string out loud. If it sounds like something Maaz would actually say to Talha in the hallway, ship it. If it sounds like a vendor demo, rewrite it.
