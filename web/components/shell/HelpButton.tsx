'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle, Clock, Receipt, Bot } from 'lucide-react';

export function HelpButton() {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Help"
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center"
      >
        <HelpCircle className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>How SRE works</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="timesheet">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="timesheet"><Clock className="h-3.5 w-3.5" /> Timesheet</TabsTrigger>
            <TabsTrigger value="expenses"><Receipt className="h-3.5 w-3.5" /> Expenses</TabsTrigger>
            <TabsTrigger value="claude"><Bot className="h-3.5 w-3.5" /> Claude / MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="timesheet" className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            <TimesheetHelp />
          </TabsContent>

          <TabsContent value="expenses" className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            <ExpensesHelp />
          </TabsContent>

          <TabsContent value="claude" className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            <ClaudeHelp />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// -------- Timesheet -------------------------------------------------------

const TIMESHEET_CATEGORIES = {
  Project: [
    'Travel', 'Site Travel', 'Site Work', 'Report',
    'Extra Integration', 'Simulation', 'Office Preparation',
    'Project Management', 'Engineering Work',
  ],
  Admin: [
    'Overtime Taken', 'TIL Payout', 'Sick Time', 'Vacation Hours',
    'Statutory Holiday', 'Administrative', 'Toolbox Meeting',
  ],
  'Office & Sales': [
    'Customer Contact', 'Project Development', 'Proposals & Quotes',
    'Inventory', 'SRU Study', 'Conference', 'General',
  ],
} as const;

function TimesheetHelp() {
  return (
    <>
      <Section title="Workflow">
        <ol className="text-sm space-y-1.5 list-decimal list-inside">
          <li><strong>Draft</strong> — you&apos;re editing. Save as you go.</li>
          <li><strong>Submitted</strong> — clicked Submit; waiting on admin review.</li>
          <li><strong>Approved</strong> — signed off and locked. Ask admin to unlock if you need a change.</li>
          <li><strong>Declined</strong> — sent back with a reason. Fix the noted rows and submit again.</li>
        </ol>
      </Section>

      <Section title="Categories">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {Object.entries(TIMESHEET_CATEGORIES).map(([main, subs]) => (
            <div key={main}>
              <div className="font-medium mb-1">{main}</div>
              <ul className="text-[var(--color-text-muted)] space-y-0.5 text-xs">
                {subs.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="TIL &amp; Vacation">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· Hours over 8/day count as overtime; approved overtime is added to your <strong>TIL bank</strong>.</li>
          <li>· Spend TIL as comp time via <em>Admin → Overtime Taken</em>. Cash out via <em>Admin → TIL Payout</em>.</li>
          <li>· Log vacation via <em>Admin → Vacation Hours</em>; draws from your annual vacation bank.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· <strong>Project</strong> rows need a project number (e.g. 2026101). Admin and Office &amp; Sales rows don&apos;t.</li>
          <li>· Description is required — one sentence on what you actually did that week.</li>
        </ul>
      </Section>
    </>
  );
}

// -------- Expenses --------------------------------------------------------

function ExpensesHelp() {
  return (
    <>
      <Section title="Workflow">
        <ol className="text-sm space-y-1.5 list-decimal list-inside">
          <li><strong>Draft</strong> — build up line items. Attach receipts once saved.</li>
          <li><strong>Submitted</strong> — waiting on admin. Within 24 h you can <em>pull it back</em> to draft.</li>
          <li><strong>Approved</strong> — locked. Waiting on payment.</li>
          <li><strong>Paid</strong> — payout recorded. Interest accrues on unpaid principal after Net-30.</li>
        </ol>
      </Section>

      <Section title="Line items">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· Pick a <strong>category</strong> from the 16-item list (Airfare, Hotel, Meal, SCBA Rental, …).</li>
          <li>· Set a <strong>project number</strong> for anything you can bill against a project — admin filters by this for accounting.</li>
          <li>· Enter the amount in <strong>CAD</strong>. If the receipt was foreign (USD/EUR), also fill the <em>Native</em> cell — CAD stays authoritative.</li>
          <li>· Tick <strong>personal</strong> on a line and it stays for your records but drops from the submitted total.</li>
          <li>· Add a <strong>receipt</strong> (image or PDF) once the draft is saved; admin can view it inline.</li>
        </ul>
      </Section>

      <Section title="Shortcuts">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· <strong>Auto-invoice #</strong> — new reports pre-fill the next number in your sequence (UC2026004 → 005).</li>
          <li>· <strong>Duplicate</strong> a prior report from the list — line items copy over (receipts don&apos;t).</li>
          <li>· <strong>Trip label</strong> on the report groups related lines (&quot;Czech Republic Aug 2026&quot;).</li>
          <li>· <strong>Favourites</strong> — save recurring rows (gym, software) under Settings, then add them in one click.</li>
        </ul>
      </Section>

      <Section title="Per-diem &amp; foreign trips">
        <p className="text-sm text-[var(--color-text-muted)]">
          Add a line with category <strong>Meal</strong>, no receipt, describe it (&quot;5 days USA @ $80 USD&quot;),
          put the native amount in <em>Native</em> (USD 400) and the converted CAD in Amount. Same pattern
          works for the Amex statement flow — one line per statement row, tick personal on the ones that
          aren&apos;t company spend.
        </p>
      </Section>

      <Section title="Settings">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· Register your <strong>credit cards</strong> so each line can record which one paid.</li>
          <li>· Set the <strong>interest rate</strong> that applies after Net-30 on unpaid balances.</li>
          <li>· Manage your <strong>favourites</strong> (recurring line templates).</li>
        </ul>
      </Section>
    </>
  );
}

// -------- Claude / MCP ----------------------------------------------------

function ClaudeHelp() {
  return (
    <>
      <Section title="What Claude can do">
        <p className="text-sm text-[var(--color-text-muted)]">
          The <strong>SRE MCP connector</strong> lets Claude read + write your expense and timesheet
          data directly. Handy for reconciling an Amex PDF, batch-creating expense lines, or
          drafting a timesheet from a rough day-by-day summary.
        </p>
      </Section>

      <Section title="Expenses via Claude">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· Drop a receipt photo or statement PDF into Claude &rarr; &quot;add this to my expense report&quot;.</li>
          <li>· Claude picks category, sets native currency, and can add multiple lines at once.</li>
          <li>· Review the draft in the app before submitting — Claude never submits for you.</li>
        </ul>
      </Section>

      <Section title="Timesheet via Claude">
        <ul className="text-sm space-y-1 text-[var(--color-text-muted)]">
          <li>· Describe your week naturally (&quot;Tue: 10 h at 2026101 site, Wed: 4 h Overtime Taken…&quot;).</li>
          <li>· Claude fills the rows via <em>replace_entries</em>; you review + submit in the app.</li>
        </ul>
      </Section>

      <Section title="Setup">
        <p className="text-sm text-[var(--color-text-muted)]">
          Add the connector once from your Claude settings — see the <em>MCP Setup</em> page in the app for the URL + auth flow.
        </p>
      </Section>
    </>
  );
}

// -------- helpers ---------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{title}</h3>
      {children}
    </section>
  );
}
