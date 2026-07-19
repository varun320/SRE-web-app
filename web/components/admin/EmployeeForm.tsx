'use client';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEmployee } from '@/app/(app)/admin/employees/new/actions';
import { toast } from 'sonner';

interface Position { id: string; name: string; annual_vacation_hours: number; }

export function EmployeeForm({ positions }: { positions: Position[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        const res = await createEmployee(fd);
        if (res?.error) toast.error(res.error);
      })}
      className="space-y-4 max-w-3xl"
    >
      <FormSection
        title="Identity"
        description="How this person shows up in reports and reviews."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" htmlFor="full_name">
            <Input id="full_name" name="full_name" required autoComplete="off" />
          </Field>
          <Field label="Employee code" htmlFor="employee_code" hint="Short code used on timesheets and payouts.">
            <Input id="employee_code" name="employee_code" required autoComplete="off" placeholder="e.g. EMP-014" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Access"
        description="Sign-in credentials and app role."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="off" placeholder="name@sulfurrecovery.com" />
          </Field>
          <Field label="Initial password" htmlFor="password" hint="Leave blank to require magic-link sign-in.">
            <Input id="password" name="password" type="text" autoComplete="off" placeholder="optional" />
          </Field>
          <Field label="Role" htmlFor="role" hint="Admin also gets employee role automatically.">
            <Select name="role" defaultValue="employee">
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Assignment"
        description="Position drives default vacation hours; department is free-text."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Position" htmlFor="position_id">
            <Select name="position_id">
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
            <Input id="department" name="department" autoComplete="off" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Opening balances"
        description="Carry-over hours as of this employee's start date. Zero is fine for new hires."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Opening TIL (hours)" htmlFor="opening_til">
            <Input id="opening_til" name="opening_til" type="number" step="0.25" defaultValue="0" className="tabular-nums" />
          </Field>
          <Field label="Opening vacation (hours)" htmlFor="opening_vacation">
            <Input id="opening_vacation" name="opening_vacation" type="number" step="0.25" defaultValue="0" className="tabular-nums" />
          </Field>
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create employee'}
        </Button>
      </div>
    </form>
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
