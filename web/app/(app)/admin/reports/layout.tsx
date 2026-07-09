import { ReportsSubnav } from '@/components/shell/ReportsSubnav';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 md:px-4 py-5 space-y-5">
      <header className="space-y-3">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Reports</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Hand-off-ready CSVs and on-screen breakdowns. Built from approved weeks only.
          </p>
        </div>
        <ReportsSubnav />
      </header>
      {children}
    </div>
  );
}
