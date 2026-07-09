'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInWithPassword, sendMagicLink, sendPasswordReset } from './actions';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function LoginPage() {
  const [pending, start] = useTransition();
  const [magicSent, setMagicSent] = useState(false);
  const nextParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') ?? '' : '';

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-between overflow-hidden bg-[var(--color-surface)] px-6 py-10">
      {/* Soft radial glow — the identity moment. No hard divider anywhere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 20%, var(--color-accent-tint) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--color-accent)' }}
      />

      {/* Brand mark, small, top */}
      <header className="relative z-10 w-full max-w-md flex justify-center">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            SRE
          </span>
          <span>Sulfur Recovery</span>
        </div>
      </header>

      {/* Editorial hero + form, stacked in one column */}
      <section className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight leading-[1.2]">
            Close the week{' '}
            <span className="text-[var(--color-accent)]">without the spreadsheet.</span>
          </h1>
          <p className="mt-3 text-body text-[var(--color-text-muted)] leading-relaxed max-w-[42ch] mx-auto">
            The in-house system for logging hours, tracking TIL, and approving weeks at Sulfur Recovery Engineering.
          </p>
        </div>

        <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)]/95 backdrop-blur-sm p-5 md:p-6">
          <Tabs defaultValue="password">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="magic">Magic link</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form
                action={(fd) =>
                  start(async () => {
                    const res = await signInWithPassword(fd);
                    if (res?.error) toast.error(res.error);
                  })
                }
                className="space-y-3 mt-4"
              >
                <input type="hidden" name="next" value={nextParam} />
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@sulfurrecovery.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" size="md" disabled={pending} className="w-full">
                  {pending ? 'Signing in…' : 'Sign in'}
                </Button>
                <div className="text-right pt-1">
                  <ForgotPasswordDialog />
                </div>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form
                action={(fd) =>
                  start(async () => {
                    const res = await sendMagicLink(fd);
                    if (res?.error) toast.error(res.error);
                    else {
                      setMagicSent(true);
                      toast.success('Magic link sent — check your inbox');
                    }
                  })
                }
                className="space-y-3 mt-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input id="magic-email" name="email" type="email" required autoComplete="email" placeholder="you@sulfurrecovery.com" />
                </div>
                <Button type="submit" size="md" disabled={pending || magicSent} className="w-full">
                  {magicSent ? 'Link sent' : pending ? 'Sending…' : 'Send magic link'}
                </Button>
                <p className="text-xs text-[var(--color-text-muted)]">
                  We&apos;ll email you a one-time sign-in link. No password required.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Need access? Ask your admin to create your account.
        </p>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-[11px] text-[var(--color-text-subtle)] pt-8">
        © {new Date().getFullYear()} Sulfur Recovery Engineering Inc.
      </footer>
    </main>
  );
}

function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSent(false); }}>
      <DialogTrigger
        render={(props) => (
          <button type="button" {...props} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:underline">
            Forgot password?
          </button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="space-y-2 py-2">
            <p className="text-sm">Done — check your inbox for a reset link.</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              The link expires after one hour. If you don&apos;t see it, check your spam folder or try again.
            </p>
          </div>
        ) : (
          <form
            action={(fd) =>
              start(async () => {
                const res = await sendPasswordReset(fd);
                if (res?.error) toast.error(res.error);
                else { setSent(true); toast.success('Reset link sent'); }
              })
            }
            className="space-y-3"
          >
            <p className="text-sm text-[var(--color-text-muted)]">
              Enter your work email and we&apos;ll send a link to reset your password.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input id="reset-email" name="email" type="email" required autoComplete="email" placeholder="you@sulfurrecovery.com" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Never mind</Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Send reset link'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
