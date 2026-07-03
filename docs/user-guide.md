---
title: "SRE-app User Guide"
subtitle: "Timesheets, TIL, vacation, and expenses — everything you need in one place"
version: "1.0 — July 2026"
---

# Welcome

The SRE-app is Sulfur Recovery Engineering's in-house tool for the three
things that used to live in spreadsheets:

1. **Weekly timesheets** — log your hours by day, category, and project.
2. **Balances** — your TIL (time-in-lieu) bank and vacation hours, updated
   automatically as your weeks get approved.
3. **Expense reports** — monthly claims, admin approval, payout tracking,
   and Net-30 interest if anything sits unpaid.

Everything runs in your browser. You can also connect Claude AI to submit
and query your expenses in plain English (covered near the end).

This guide has two parts:

- **Part 1 — For everyone.** How to sign in, fill out your week, watch your
  balances, and file expenses. Read this first.
- **Part 2 — For admins.** Extra pages and buttons you'll only see if your
  account has the admin role.

You can skim the table of contents and jump to whatever you need — nothing
here is essential to memorize.

---

# Part 1 — For everyone

## Signing in

Open **https://sre-web-app.vercel.app** in any modern browser. If you
haven't signed in yet, you'll land on the login page.

There are three ways to sign in:

- **Password** — enter your work email and your password, click **Sign in**.
- **Magic link** — enter your email on the *Magic link* tab, click **Send
  link**, then open the email we send you and click the link. No password
  needed. The link expires in one hour.
- **Forgot password?** — the link under the password box opens a small
  dialog. Type your email and we'll send you a reset link (also good for
  one hour). Check your spam folder if it doesn't arrive within a minute or
  two.

After sign-in you land on **this week's timesheet**. That's the home page.

If you close the tab and come back later, you'll usually stay signed in for
several days. If it forgets you, it just shows the login page again — no
big deal.

## The nav bar

The strip along the top of every page is your main navigation. From left to
right:

- **SRE badge + "Timesheet"** — click to jump back to this week's
  timesheet. (Tap the little **SRE** badge five times quickly for a
  surprise — see *Little touches* at the end.)
- **Week** — this week's timesheet grid.
- **TIL bank** — your overtime savings account.
- **Vacation** — your remaining vacation hours.
- **Expenses** — monthly expense reports.
- **Admin** (only if you're an admin) — the approval queue and everything
  in Part 2.
- **Bell icon** — notifications. A red dot means you have unread ones.
- **Question mark** — small help popover.
- **Your initial in a circle** — click to open a dropdown with:
  - **Claude connector** — instructions to hook up Claude AI (see the
    Claude section below).
  - **Sign out**.

On phones the nav collapses behind a menu button on the right — same
items, just stacked.

## Notifications (the bell icon)

The bell shows you the last 50 events that matter to you. You'll get one
whenever:

- You submit a week — a friendly confirmation.
- An admin **approves** your week.
- An admin **declines** your week — with the reason.
- An admin **unlocks** a week you thought was final so you can fix
  something.
- An admin **force-submits** a week for you (for example, if the deadline
  passed and you forgot).

Click any row to jump straight to the week it's about. Unread rows are
highlighted; clicking marks them read.

At the top of the notifications page there's a checkbox to also get these
events by **email**. Turn it off if you find them noisy.

## Your weekly timesheet

The timesheet is the heart of the app. Everything about your balances and
your paycheck flows from what you log here.

### What the page looks like

At the top of the page:

- The **week of** date (Monday of that week).
- A **View report** link that opens a read-only summary of the week
  (handy for glancing before you submit).
- A **status banner** telling you where the week stands: *Draft*,
  *Submitted*, *Approved*, or *Declined*. If it was declined, the admin's
  reason shows here.
- A **KPI strip** with your current TIL balance, current vacation balance,
  and total hours logged so far this week.

Then a big table — one row per activity, one column per day (Mon → Sun).

### Filling out a row

Each row captures **one kind of work you did that week**. If you spent
Monday and Tuesday on Project 2026001, that's one row with hours in Mon
and Tue. If Wednesday and Thursday were general office work, that's a
second row.

For each row, pick:

- **Main category** — the big bucket the hours belong to (Project work,
  Office, Admin, and so on).
- **Sub-category** — the finer split under that main. Some main categories
  only have one sub, some have several.
- **Project #** — only needed for project-work rows. Pick from the
  dropdown; only *active* projects appear.
- **Description** — a short note about what you actually did. Think "one
  line you'd tell your PM."

Then punch **decimal hours** into each day. Half an hour is `0.5`; a full
day is usually `8`. The total for the row shows on the right.

Below the table you'll see how many *validation issues* the sheet has.
It's zero when everything is fine; it counts up when something needs
attention (missing category, unknown project, and so on). You can't
submit until it's zero.

### Buttons

- **Add row (+)** — appears at the end of the table. Click to add a blank
  row for another activity.
- **Save draft** — writes everything to the server without submitting.
  Only you can see it. Save as often as you like; it just overwrites.
- **Submit for approval** — locks the week and sends it to the admin
  queue. You'll see a burst of confetti and a random cheerful message.
  Once submitted, you can't edit the week further unless an admin
  declines or unlocks it.

### What happens after you submit

An admin reviews the week and either:

- **Approves it.** The week becomes final. Your TIL bank picks up any
  overtime from that week; your vacation goes down by whatever you logged
  as *Vacation Hours*. You'll get a notification.
- **Declines it with a reason.** The week goes back to draft; you can
  edit and resubmit. The reason shows in the status banner and in the
  notification.

### What if a week you thought was final needs fixing

An admin can *unlock* an approved week. That means the week goes back to
"declined" for you (with the admin's reason), so you can fix and
re-submit. When they unlock, the app also marks all your **later weeks'
balances** as *superseded* — because unlocking one week means the numbers
downstream might change once the fixed version is re-approved. You'll see
those balances re-compute automatically when the next week gets
re-approved.

### The week report

The **View report** link (top of the timesheet page, and also
`/week/<date>/report`) shows the same hours four ways:

- Daily breakdown (Mon → Sun grid).
- By main category.
- By sub-category.
- By project.

Each table has a **Download CSV** button, useful if you want the numbers
outside the app.

## Your TIL bank

Every hour you work over 8 in a single day gets added to your TIL bank
automatically when the week gets approved. Think of it as an overtime
savings account you can spend later.

Open the **TIL bank** page (from the top nav) to see:

- Your **current balance** in big numbers at the top.
- **OT earned (lifetime)** — total overtime you've ever accumulated.
- **TIL used (lifetime)** — total hours you've spent.
- A **ledger table** — one row per week, showing opening balance,
  overtime earned that week, TIL used that week, and closing balance.

### How to spend TIL

On your timesheet, log the hours you took off under the **Admin** main
category, using one of these sub-categories:

- **Overtime taken** — you took a day (or hours) off in exchange for
  overtime you'd banked.
- **TIL payout** — you were paid out cash for banked TIL instead of
  taking the time off.

Either one deducts from your balance when the week is approved.

### About the "superseded" badge

If an admin unlocks an older week, ledger rows for later weeks may show
a *superseded* badge. That just means the numbers you see for those
weeks are the old numbers — they'll be re-computed and updated as later
weeks get re-approved. You don't need to do anything.

## Your vacation balance

Very similar to TIL. Open the **Vacation** page to see:

- Your **remaining vacation hours** at the top (turns red if under 8,
  which is a soft "getting low" warning — you can still use it).
- **Opening (annual)** — your annual entitlement, set by your position.
- **Used (lifetime)**.
- **Closing balance** — same as the number at the top.
- A **ledger** — opening/used/closing per week.

### How to book vacation

Log the hours on your timesheet under **Admin → Vacation hours**. They
deduct from your balance when the week is approved.

If you go negative, the balance shows in red on the header. Talk to an
admin if that's unexpected.

## Expense reports

Anything you paid out of pocket that Sulfur Recovery owes you back goes
here — one report per invoice, submitted monthly.

Open the **Expenses** page (top nav). Three stat blocks at the top:

- **Submitted** — total you've claimed.
- **Received** — what you've been paid.
- **Outstanding** — the difference.
- **Interest** — interest you're owed on anything past its Net-30 due
  date.
- **Total owing** — outstanding plus interest.

Below that, a table of every report you've ever filed.

### Filing a new report

Click **New report**. You'll get a form with:

- **Invoice #** — a unique identifier for your report, e.g. `UC2026007`.
  Use whatever naming convention your team follows.
- **Period from** and **Period to** — the dates the expenses cover.
- **Submission date** — defaults to today.
- **Amount CAD** — the base claim (before tax).
- **GST CAD** — any GST you're claiming back.
- **Notes** — anything the admin needs to know.

**Total** below the fields is `amount + gst`, updated live.

Then either:

- **Save draft** — stores it so only you can see it. You can come back
  and edit any time.
- **Save & submit** — sends it to the admin for approval. Once submitted
  the form goes read-only for you unless the admin declines it.

### Viewing / editing an existing report

Click any invoice number on the list. You'll see the same form as
*New report* (editable if the report is still a draft or was declined,
read-only otherwise) plus:

- Any admin's **decline reason** at the top, if applicable.
- A **Payments received** table at the bottom, listing every payout the
  admin has recorded against this invoice. Each payout has a date, an
  amount, and a reference (e.g. a cheque number).

### The states of an expense report

- **Draft** — you're still working on it.
- **Submitted** — admin has it.
- **Approved** — admin ok'd it; you're waiting on payment.
- **Declined** — admin sent it back with a reason.
- **Paid** — all of it (or what admin marked as paid).

### Balance & interest

On the *Expenses* page, the **Balance** button (top right) opens a
per-invoice breakdown of what's due, what's paid, what's overdue, and
what interest is accruing.

The rule: expenses are Net-30 from submission. After 30 days, any unpaid
balance starts accruing interest at your APR (default 21.99% / year),
calculated daily on the outstanding principal. Any payment stops the
clock and shrinks the principal.

Formula shown at the top:

```
interest = unpaid × (days_overdue / 365) × APR
```

The table has columns for invoice, submitted date, due date, claimed,
paid, outstanding, interest, total owing, days overdue, and a status
badge. Green = paid. Red = overdue. Amber = interest is running.

## Using Claude with your expenses

The app can talk to Claude AI. You add it once, then you can ask Claude
things like:

- *"What's my current expense balance?"*
- *"Draft an expense report UC2026008 for June 1 to 30, $1,234.56 CAD
  plus $61.73 GST, and submit it."*
- *"List my declined reports."*

Claude only sees **your** data — the connector is bound to your login,
so RLS in the database keeps everyone's data separate.

To set it up, open the user menu (your initial, top-right) → **Claude
connector**. You'll see the exact URL to paste into Claude and the four
or five clicks to add the connector. It only takes a minute, and after
the first tool call Claude keeps you signed in.

The Claude connector works on:

- Claude on the web (claude.ai).
- Claude on iOS and Android.
- Claude Desktop and Claude Code (via a slightly different flow — the
  admin will help set up if you want it).

## Little touches

- **Confetti.** When you submit your timesheet, the app throws confetti
  and shows a random cheerful message ("🎉 Submitted — your future self
  thanks you"). It's not a bug. If you have *reduced motion* enabled in
  your OS, the confetti stays off.
- **Snake game.** Tap the little **SRE** badge in the top-left five
  times within two seconds to launch a snake game. Arrow keys or WASD
  to move; Space or Enter to restart; Escape to close. Your high score
  is saved on your device. If you leave the app open and don't touch it
  for a while, the badge will wiggle gently — that's the hint.
- **Dark mode.** The app respects your operating system's light/dark
  preference. Change it there and refresh.

## Common questions

**I submitted a week by accident. Can I fix it?** Yes — ask an admin to
decline it (with a note like "submitted early, please fix"). It'll come
back to you as a draft.

**My TIL balance seems off.** Check your ledger on the TIL bank page.
The most common cause is that an admin unlocked an older week; you'll
see *superseded* badges until later weeks get re-approved.

**I forgot my password.** Use the *Forgot password?* link on the sign-in
page. If the reset email doesn't arrive, ask an admin to send you a
magic link.

**I can't see the admin section.** That's by design — you'll only see it
if your account has the admin role. Ask an admin to add you if you need
access.

**My expense is showing interest — what do I do?** Nothing on your end.
Interest just means it's past due; the amount is what Sulfur Recovery
owes you extra for the delay. Once payment is recorded, the interest
freezes at whatever it was.

---

# Part 2 — For admins

Admins can do everything an employee can, plus review other people's
work, unlock finalised weeks, record payouts, manage employees, and
generate reports.

## The admin nav

When you're on any `/admin/*` page you'll see a second nav strip
underneath the top nav. It has:

- **Approvals** — the admin landing page. Approval queue + all weeks.
- **Locked weeks** — approved timesheets you can unlock.
- **Expenses** — everyone's expense reports.
- **Employees** — the staff directory.
- **Projects** — project master list.
- **Positions** — position definitions (and their annual vacation
  entitlement).
- **Audit log** — every approve/decline/unlock/import action, immutable.
- **Reports** — payroll, balances, hours-by-project, per-employee period.
- **Import** — historical import wizard (only if the feature is enabled
  on this deployment).

## The admin home page

At **/admin** you see:

- A **quick queue** at the top of the newest submitted timesheets. Click
  a card to open that week in the review view.
- Four **stat cards**: pending review, approved (last 7 days), declined
  (last 7 days), imported (last 7 days).
- The **All weeks** table — every week ever, paginated 50 at a time,
  with filters at the top (status + employee dropdowns).

Each row of the *all weeks* table has the employee, week, status,
submitted date, approved date, total hours, OT earned, and an action
link that takes you into the detailed review view.

## Reviewing a week

Click into any week (from the queue or from the all-weeks table) and
you're on `/admin/employees/<id>/week/<week>`. Header shows employee
info + week + current status + the last decline reason if any.

Below the header, the same four report tables an employee sees on their
own report page — daily, by category, by sub-category, by project.

At the bottom is a **sticky decision bar** with buttons that depend on
the current state:

- **Approve** — locks the week, freezes the ledgers as of that week,
  logs the action. Standard case.
- **Approve (override)** — if the week is still a draft or was declined,
  you can approve it directly. Use if the employee is out.
- **Decline** — opens a dialog for a reason (required). The week goes
  back to draft with your reason visible to the employee.
- **Unlock** — if the week is already approved, unlocks it back to
  declined. Requires a reason. **See the cascade note below.**
- **Force-submit** — if the week is still draft/declined and the
  deadline has passed, submits it on the employee's behalf so you can
  then approve it.

### The unlock cascade

Unlocking an already-approved week is destructive to downstream numbers:
any TIL / vacation ledger rows for **later** weeks are marked as
*stale*. They'll auto-recompute the next time each of those weeks is
re-approved. That's why the unlock dialog asks for a reason and gives
you a stern reminder.

Tell the employee what you did and why. They'll get a notification, but
a Slack message is usually kinder.

## Locked weeks

**Admin → Locked weeks** lists every approved, currently-locked week
with an *Unlock* button per row. Same behaviour as unlocking from the
per-week review view; useful when you know you need to unlock but don't
have the week open yet.

## Expenses

**Admin → Expenses** shows every expense report in the system with
filters (status + name/invoice search) at the top. Click any invoice to
open its detail page, where you can:

- **Approve** — approves the report. Locks the form for the employee
  and enables payout recording.
- **Decline** — opens a reason dialog; sends it back to the employee.
- **+ Payout** — opens a dialog with date, amount, reference (cheque
  number / ACH ref), and optional notes. Each payout reduces the
  outstanding balance and, if it clears the full amount, stops interest
  accrual.
- **Unlock** — if you approved something in error and need the employee
  to change it, unlock puts it back into declined with a reason.

The **Payout log** button (top-right of the expenses list) opens
`/admin/expenses/payouts`, an immutable table of every payout ever
recorded — date, employee, invoice, amount, reference, notes. Useful
for reconciling with accounting.

## Employees

**Admin → Employees** lists everyone. Columns: name, email, code,
department, active flag. Click a name for the detail page.

The detail page shows:

- Employee code, name, email, position, department, active status.
- Two **balance cards** — current TIL, current vacation.
- The **20 most recent weeks** with status; click any to open the
  review view.

**Add employee** (top of the list) opens a form: full name, email,
employee code, department, position (dropdown — the annual vacation
entitlement comes from here), active. On save the account gets created
in Supabase Auth and the initial balances get seeded.

## Projects

**Admin → Projects** is the project master list. Numbering convention
is `YYYYNNN` (e.g. `2026007`). Fields:

- **Project number** (unique).
- **Project name**.
- **Status** — Active or Closed.

Only *active* projects appear in the timesheet dropdowns employees see.
Closing a project hides it from new timesheets but keeps historical
hours intact.

Add a project with the form above the table; edit or delete inline.

## Positions

**Admin → Positions** defines each role in the company and the
**annual vacation hours** for that role. When you create a new
employee, the position dropdown seeds their annual vacation from here.

Editing the number here does **not** retroactively adjust anyone's
existing balance. Only new employees inherit the new value; existing
balances stay as they were unless you adjust them by hand.

## Audit log

**Admin → Approvals → Audit log** (or wherever the subnav links it)
shows the 500 most recent immutable actions: approve, decline, unlock,
force-submit, import. Each entry has the actor, the employee affected,
the week, the before-state, the total hours + OT on that week, and any
comment the actor entered (required for decline / unlock).

You can't edit or delete anything here — that's the point.

## Reports

Four reports live under **Admin → Reports**:

- **Payroll.** Pick a bi-weekly period; get a table of regular hours,
  OT hours, TIL used, vacation used, current TIL balance, and current
  vacation balance per employee. Download as CSV to feed into payroll.
- **Balances.** A point-in-time snapshot of everyone's current TIL and
  vacation balances. Vacation < 8 hours is flagged red. CSV download.
- **Hours by project.** Filter by project + date range. Two views:
  summary (total hours per project) and detail (which employee logged
  how many hours on which project). CSV download.
- **Per-employee period.** A printable, signature-ready summary sheet
  for one employee and one period. Landscape print layout with two
  signature lines at the bottom. Save as PDF from your browser's print
  dialog if you need a file.

## Historical import (if enabled)

**Admin → Import** is a two-step wizard for bringing legacy timesheet
data into the app:

1. Pick an employee, paste or upload a CSV of weekly totals.
2. Click **Dry run** to see exactly what would be imported and any
   conflicts (duplicate weeks, balance mismatches, etc.). Fix the CSV
   until dry run is clean.
3. Click **Commit** to actually create the entries.

Every import ends up in the audit log as an `imported` action.

The wizard is behind a feature flag (`NEXT_PUBLIC_IMPORTER_ENABLED`) —
if it's off on this deployment, the page will 404 and you'll need
someone with server access to turn it on.

## Claude for admins

When you set up the Claude connector as an admin, you get the same six
tools employees get **plus** four admin-only tools:

- `approve_expense` — approve someone's report.
- `decline_expense` — decline with a reason.
- `unlock_expense` — unlock a previously approved report.
- `record_payout` — log a payout against a specific invoice.

The admin tools only show up in Claude's tool list if your account has
the admin role — so a non-admin using Claude with the same connector
URL simply can't see or call them.

Handy admin prompts:

- *"Approve UC2026005 for user &lt;uuid&gt;."*
- *"Record a payout of $5,000 CAD on 2026-05-10 against UC2026001,
  reference chq-4471."*
- *"Show me all submitted expenses in the last week."*

---

# Appendix A — Every keyboard shortcut

Not many, but worth knowing:

- **Snake game (once open):** arrow keys / WASD to move, Space or Enter
  to restart after game over, Escape to close.
- Otherwise the app is standard tab / enter / esc — no custom
  shortcuts.

# Appendix B — When something goes wrong

- **Page shows only "Loading…"** — try a hard refresh
  (Ctrl+Shift+R / Cmd+Shift+R). If it keeps happening on the same
  page, tell an admin the URL.
- **"Not authorised" / redirected to login unexpectedly** — your session
  expired. Sign in again.
- **Claude connector shows "Couldn't connect to the server"** — the
  deployment may be down or the OAuth environment vars are missing on
  the server. Contact the admin.
- **The Excel workbook doesn't match what's here** — the app is now the
  source of truth. If you find a real discrepancy in the maths (interest,
  totals, balances), open a bug with a screenshot and the invoice
  number.

# Appendix C — What lives where

Rough map from feature to URL (all under
`https://sre-web-app.vercel.app`):

| I want to…                            | Go to                                    |
| ------------------------------------- | ---------------------------------------- |
| Fill in this week                     | `/week/current`                          |
| Look at an old week                   | `/week/<YYYY-MM-DD>`                     |
| See the summary of a week             | `/week/<YYYY-MM-DD>/report`              |
| Check TIL balance                     | `/me/til`                                |
| Check vacation                        | `/me/vacation`                           |
| See my notifications                  | `/me/notifications`                      |
| Look at my expenses                   | `/expenses`                              |
| Start a new expense report            | `/expenses/new`                          |
| Open one expense report               | `/expenses/<invoice_no>`                 |
| See my expense balance & interest     | `/expenses/balance`                      |
| Connect Claude                        | `/mcp-setup`                             |
| **Admin only** — approval queue       | `/admin`                                 |
| Approve one week                      | `/admin/employees/<id>/week/<date>`      |
| Unlock a locked week                  | `/admin/locked`                          |
| Everyone's expenses                   | `/admin/expenses`                        |
| Payout log                            | `/admin/expenses/payouts`                |
| Staff directory                       | `/admin/employees`                       |
| Add an employee                       | `/admin/employees/new`                   |
| Manage projects                       | `/admin/projects`                        |
| Manage positions                      | `/admin/positions`                       |
| Audit log                             | `/admin/approvals`                       |
| Payroll export                        | `/admin/reports/payroll`                 |
| Balances snapshot                     | `/admin/reports/balances`                |
| Hours by project                      | `/admin/reports/projects`                |
| Signable per-employee period sheet    | `/admin/reports/period`                  |
| Historical import wizard              | `/admin/import`                          |
