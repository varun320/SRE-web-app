'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';

// Mirrors supabase/seed.sql. Update both if categories change.
const CATEGORIES = {
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

export function HelpButton() {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Help"
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center"
      >
        <HelpCircle className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How the timesheet works</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Workflow</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li><strong>Draft</strong> — you're editing. Use Save draft as you go.</li>
            <li><strong>Submitted</strong> — clicked Submit; waiting on admin review.</li>
            <li><strong>Approved</strong> — admin signed off; the week is locked. Need a change? Ask an admin to unlock.</li>
            <li><strong>Declined</strong> — admin sent it back with a reason. Fix the noted rows and submit again.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {Object.entries(CATEGORIES).map(([main, subs]) => (
              <div key={main}>
                <div className="font-medium mb-1">{main}</div>
                <ul className="text-[var(--color-text-muted)] space-y-0.5">
                  {subs.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-1 text-sm">
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Tips</h3>
          <ul className="space-y-1 text-[var(--color-text-muted)]">
            <li>· <strong>Project</strong> rows need a project number (e.g. 2026101). Admin and Office &amp; Sales rows don't.</li>
            <li>· Hours over 8 in a single day count as overtime and get added to your TIL bank when approved.</li>
            <li>· Use <em>Admin → Vacation Hours</em> to log time off; it draws from your vacation bank.</li>
            <li>· Use <em>Admin → Overtime Taken</em> when you're spending TIL hours as comp time.</li>
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
