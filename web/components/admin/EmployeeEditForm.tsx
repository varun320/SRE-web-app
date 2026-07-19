'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateEmployee, resetEmployeePassword, updateOpeningBalances } from '@/app/(app)/admin/employees/[id]/actions';
import { toast } from 'sonner';

interface Position { id: string; name: string; annual_vacation_hours: number; }
export interface EmployeeEditValues {
  id: string;
  full_name: string;
  email: string;
  employee_code: string;
  department: string | null;
  position_id: string | null;
  is_active: boolean;
  role: 'employee' | 'admin';
}

export function EmployeeEditForm({
  employee,
  positions,
  openingTil,
  openingVacation,
}: {
  employee: EmployeeEditValues;
  positions: Position[];
  openingTil: number;
  openingVacation: number;
}) {
  const [pending, start] = useTransition();
  const [pwPending, startPw] = useTransition();
  const [obPending, startOb] = useTransition();
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="space-y-4 max-w-3xl">
      <form
        action={(fd) => start(async () => {
          const res = await updateEmployee(fd);
          if (res?.error) toast.error(res.error);
          else toast.success('Employee saved');
        })}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={employee.id} />

        <FormSection title="Identity" description="How this person shows up in reports and reviews.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name" htmlFor="full_name">
              <Input id="full_name" name="full_name" required defaultValue={employee.full_name} autoComplete="off" />
            </Field>
            <Field label="Employee code" htmlFor="employee_code" hint="Short code used on timesheets and payouts.">
              <Input id="employee_code" name="employee_code" required defaultValue={employee.employee_code} autoComplete="off" />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Access" description="Sign-in credentials and app role.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email" htmlFor="email" hint="Changes the auth login too.">
              <Input id="email" name="email" type="email" required defaultValue={employee.email} autoComplete="off" />
            </Field>
            <Field label="Role" htmlFor="role" hint="Admin also gets employee role automatically.">
              <Select name="role" defaultValue={employee.role}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" htmlFor="is_active" hint="Inactive employees can't sign in or submit timesheets.">
              <Select name="is_active" defaultValue={employee.is_active ? 'true' : 'false'}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Assignment" description="Position drives default vacation hours; department is free-text.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Position" htmlFor="position_id">
              <Select name="position_id" defaultValue={employee.position_id ?? undefined}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a position…">
                    {(value: string) => positions.find((p) => p.id === value)?.name ?? 'Pick a position…'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span>{p.name}</span>
                      <span className="ml-auto text-[var(--color-text-muted)] text-xs tabular-nums">
                        {p.annual_vacation_hours}h vacation
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Department" htmlFor="department" hint="e.g. Engineering, Ops, Field.">
              <Input id="department" name="department" defaultValue={employee.department ?? ''} autoComplete="off" />
            </Field>
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <FormSection
        title="Opening balances"
        description="Rewrites the seed ledger row and marks later weeks stale so carry-forward recomputes."
      >
        <form
          action={(fd) => startOb(async () => {
            const res = await updateOpeningBalances(fd);
            if (res?.error) toast.error(res.error);
            else toast.success('Opening balances updated');
          })}
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <input type="hidden" name="id" value={employee.id} />
          <Field label="Opening TIL (hours)" htmlFor="opening_til">
            <Input id="opening_til" name="opening_til" type="number" step="0.25" min="0" defaultValue={openingTil} className="tabular-nums" />
          </Field>
          <Field label="Opening vacation (hours)" htmlFor="opening_vacation">
            <Input id="opening_vacation" name="opening_vacation" type="number" step="0.25" min="0" defaultValue={openingVacation} className="tabular-nums" />
          </Field>
          <Button type="submit" variant="outline" disabled={obPending}>
            {obPending ? 'Updating…' : 'Update balances'}
          </Button>
        </form>
      </FormSection>

      <FormSection title="Reset password" description="Sets a new password for this user immediately. Share it over a secure channel.">
        <form
          action={(fd) => startPw(async () => {
            const res = await resetEmployeePassword(fd);
            if (res?.error) toast.error(res.error);
            else {
              toast.success('Password updated');
              (document.getElementById('new_password') as HTMLInputElement | null)?.setAttribute('value', '');
            }
          })}
          className="flex flex-col sm:flex-row sm:items-end gap-3"
        >
          <input type="hidden" name="id" value={employee.id} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new_password" className="text-xs font-medium">New password</Label>
            <Input
              id="new_password"
              name="password"
              type={showPw ? 'text' : 'password'}
              minLength={8}
              placeholder="min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] sm:mb-3">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
            Show
          </label>
          <Button type="submit" variant="outline" disabled={pwPending}>
            {pwPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </FormSection>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5 md:p-6">
      <header className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-[var(--color-text)]">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p> : null}
    </div>
  );
}
