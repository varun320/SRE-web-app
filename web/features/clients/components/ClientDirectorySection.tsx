'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Mail, Phone, Users, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { ShowMore } from '@/shared/ui/show-more';
import { createContact, createSite, deleteContact, deleteSite } from '@/features/clients/actions';

type Line = { icon: 'mail' | 'phone'; text: string; href: string };
export interface DirectoryItem {
  id: string;
  primary: string;
  secondary: string | null;
  lines: Line[];
}

interface Props {
  title: string;
  clientId: string;
  isAdmin: boolean;
  items: DirectoryItem[];
  kind: 'contact' | 'site';
}

// Server → Client boundary can't carry component refs — pick icon by `kind`.
const KIND_ICON = { contact: Users, site: MapPin } as const;

export function ClientDirectorySection({ title, clientId, isAdmin, items, kind }: Props) {
  const Icon = KIND_ICON[kind];
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
          <span className="text-xs font-normal text-[var(--color-text-muted)]">· {items.length}</span>
        </h2>
        {isAdmin && !adding ? (
          <Button variant="outline" size="xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        ) : null}
      </div>

      {adding && isAdmin ? (
        <AddForm
          kind={kind}
          clientId={clientId}
          disabled={pending}
          onSubmit={(fd) => {
            start(async () => {
              const action = kind === 'contact' ? createContact : createSite;
              const res = await action(fd);
              if (res?.error) toast.error(res.error);
              else { toast.success('Added'); setAdding(false); }
            });
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      <div className="mt-3">
        <ShowMore
          items={items}
          initial={5}
          step={10}
          emptyLabel={kind === 'contact' ? 'No contacts yet.' : 'No sites yet.'}
          render={(item) => (
            <div key={item.id} className="py-2 border-t border-[var(--color-border-soft)] first:border-t-0 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.primary}</div>
                {item.secondary ? (
                  <div className="text-[11px] text-[var(--color-text-muted)]">{item.secondary}</div>
                ) : null}
                {item.lines.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {item.lines.map((l, i) => (
                      <a key={i} href={l.href} className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
                        {l.icon === 'mail' ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                        {l.text}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              {isAdmin ? (
                <form action={(fd) => start(async () => {
                  const action = kind === 'contact' ? deleteContact : deleteSite;
                  const res = await action(fd);
                  if (res?.error) toast.error(res.error);
                })}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button
                    type="submit"
                    aria-label="Remove"
                    disabled={pending}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-status-declined-fg)] p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : null}
            </div>
          )}
        />
      </div>
    </section>
  );
}

interface AddFormProps {
  kind: 'contact' | 'site';
  clientId: string;
  disabled: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}

function AddForm({ kind, clientId, disabled, onSubmit, onCancel }: AddFormProps) {
  return (
    <form
      action={onSubmit}
      className="mt-3 rounded-md border border-[var(--color-accent)]/60 bg-[var(--color-surface-2)]/40 p-3 space-y-2"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <input name="name" placeholder={kind === 'contact' ? 'Name' : 'Site name (e.g. Fort McMurray, AB)'} required className={inputCls} />
      {kind === 'contact' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input name="role"  placeholder="Role"  className={inputCls} />
          <input name="email" placeholder="Email" className={inputCls} />
          <input name="phone" placeholder="Phone" className={`${inputCls} md:col-span-2`} />
        </div>
      ) : (
        <input name="address" placeholder="Address (optional)" className={inputCls} />
      )}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="xs" onClick={onCancel} disabled={disabled}>Cancel</Button>
        <Button type="submit" size="xs" disabled={disabled}>Add</Button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm';
