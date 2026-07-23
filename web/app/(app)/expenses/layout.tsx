import { ExpenseTabs, EMPLOYEE_EXPENSE_TABS } from '@/components/expenses/ExpenseTabs';

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExpenseTabs tabs={EMPLOYEE_EXPENSE_TABS} />
      {children}
    </>
  );
}
