'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

interface Props {
  initial: boolean;
}

export function EmailPrefToggle({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) => {
    const prev = enabled;
    setEnabled(next); // optimistic
    start(async () => {
      const sb = getSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setEnabled(prev);
        toast.error('Not signed in');
        return;
      }
      const { error } = await sb
        .from('users')
        .update({ email_notifications: next })
        .eq('id', user.id);
      if (error) {
        setEnabled(prev);
        toast.error(error.message);
      } else {
        toast.success(next ? 'Email notifications on' : 'Email notifications off');
      }
    });
  };

  return (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3 cursor-pointer">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-sm font-medium">Also email me</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Send a copy of every notification to your work email. You&apos;ll still see them here.
          </div>
        </div>
      </div>
      <span className="relative inline-block h-5 w-9 shrink-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.currentTarget.checked)}
          disabled={pending}
          className="peer absolute inset-0 z-10 cursor-pointer appearance-none opacity-0"
          aria-label="Email notifications"
        />
        <span
          aria-hidden
          className={[
            'absolute inset-0 rounded-full transition-colors',
            enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]',
          ].join(' ')}
        />
        <span
          aria-hidden
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
            enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </label>
  );
}
