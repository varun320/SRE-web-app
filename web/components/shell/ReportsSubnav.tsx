'use client';

import { SectionTabs } from '@/components/ui/section-tabs';
import { REPORT_ITEMS } from '@/lib/reports/items';

export function ReportsSubnav() {
  return <SectionTabs tabs={REPORT_ITEMS} ariaLabel="Reports" />;
}
