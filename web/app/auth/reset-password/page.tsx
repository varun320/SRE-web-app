'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { updatePassword } from './actions';

type Status = 'verifying' | 'ready' | 'invalid';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const sp = useSearchParams();
  const code = sp.get('code');
  const [status, setStatus] = useState<Status>('verifying');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!code) {
      setStatus('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = getSupabaseBrowser();
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (cancelled) return;
      setStatus(error ? 'invalid' : 'ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-[var(--color-surface)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            SRE
          </span>
          <span>Timesheet</span>
        </div>

        {status === 'verifying' ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            Verifying reset link…
          </div>
        ) : status === 'invalid' ? (
          <InvalidLink />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
                <Lock className="h-4 w-4" />
              </div>
              <h1 className="mt-3 text-h1">Set a new password</h1>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Pick something at least 8 characters long. You&apos;ll be signed in automatically once it&apos;s saved.
              </p>
            </div>
            <form
              action={(fd) =>
                start(async () => {
                  const res = await updatePassword(fd);
                  if (res?.error) toast.error(res.error);
                })
              }
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" minLength={8} />
              </div>
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? (
                  'Saving…'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Save new password
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

function InvalidLink() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6 space-y-3">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-status-declined-bg)] text-[var(--color-status-declined-fg)]">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">This reset link is invalid or expired</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        Reset links expire after one hour. Head back to the sign-in page and request a new one.
      </p>
      <Button className="w-full" render={<a href="/login">Back to sign in</a>} />
    </div>
  );
}
