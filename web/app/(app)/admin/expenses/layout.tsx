import { ExpenseTabs, ADMIN_EXPENSE_TABS } from '@/components/expenses/ExpenseTabs';

export default function AdminExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExpenseTabs tabs={ADMIN_EXPENSE_TABS} />
      {children}
    </>
  );
}
