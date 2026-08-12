'use client';
import { useTransition, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { createClient } from '@/features/clients/actions';
import { toast } from 'sonner';

export function ClientForm() {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text)]">Add client</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Get coordinates from Google Maps: right-click a location → click the lat/lng to copy → paste below.
        </p>
      </header>
      <form
        ref={formRef}
        action={(fd) => start(async () => {
          const res = await createClient(fd);
          if (res?.error) toast.error(res.error);
          else { toast.success('Client added'); formRef.current?.reset(); }
        })}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Name</Label>
          <Input id="name" name="name" required placeholder="Aramco Ras Tanura" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location" className="text-xs font-medium">Location <span className="text-[var(--color-text-muted)]">(optional label)</span></Label>
          <Input id="location" name="location" placeholder="Ras Tanura, Saudi Arabia" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coords" className="text-xs font-medium">Coordinates</Label>
          <Input id="coords" name="coords" required placeholder="25.276987, 55.296249" className="tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sharepoint_url" className="text-xs font-medium">SharePoint URL <span className="text-[var(--color-text-muted)]">(optional)</span></Label>
          <Input id="sharepoint_url" name="sharepoint_url" type="url" placeholder="https://sulfurrec.sharepoint.com/..." />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add client'}</Button>
        </div>
      </form>
    </section>
  );
}
