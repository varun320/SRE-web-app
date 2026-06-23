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
      className="grid gap-4 max-w-xl"
    >
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="employee_code">Employee code</Label><Input id="employee_code" name="employee_code" required /></div>
        <div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
      </div>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
      <div>
        <Label htmlFor="password">Initial password (optional)</Label>
        <Input id="password" name="password" type="text" placeholder="leave blank to require magic-link sign-in" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="position_id">Position</Label>
          <Select name="position_id">
            <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
            <SelectContent>
              {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.annual_vacation_hours}h vacation)</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="department">Department</Label><Input id="department" name="department" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="opening_til">Opening TIL (h)</Label><Input id="opening_til" name="opening_til" type="number" step="0.25" defaultValue="0" /></div>
        <div><Label htmlFor="opening_vacation">Opening vacation (h)</Label><Input id="opening_vacation" name="opening_vacation" type="number" step="0.25" defaultValue="0" /></div>
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue="employee">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="admin">Admin (also gets employee role automatically)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create employee'}</Button>
    </form>
  );
}
