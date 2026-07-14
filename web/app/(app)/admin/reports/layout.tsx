import { ReportsSubnav } from '@/components/shell/ReportsSubnav';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 md:px-4 py-5 md:py-6 space-y-5">
      <ReportsSubnav />
      {children}
    </div>
  );
}
