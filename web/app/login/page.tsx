'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInWithPassword, sendMagicLink, sendPasswordReset } from './actions';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock4, FileSpreadsheet, Lock } from 'lucide-react';

export default function LoginPage() {
  const [pending, start] = useTransition();
  const [magicSent, setMagicSent] = useState(false);
  const nextParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') ?? '' : '';

  return (
    <main className="min-h-dvh grid md:grid-cols-2 bg-[var(--color-surface)]">
      {/* Brand panel */}
      <aside className="hidden md:flex flex-col justify-between p-10 lg:p-14 bg-gradient-to-br from-[var(--color-accent-tint)] via-[var(--color-surface)] to-[var(--color-surface-2)] relative overflow-hidden">
        <div className="relative z-10">
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
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-tight">
            Weekly timesheets,
            <br />
            <span className="text-[var(--color-accent)]">without the spreadsheet pain.</span>
          </h1>
          <p className="mt-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
            Sulfur Recovery Engineering&apos;s in-house system for logging hours, tracking TIL,
            and approving weeks. Replaces the per-employee Excel workbook with a single shared
            source of truth.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm">
            <Feature icon={Clock4} label="Auto-computed TIL + vacation balances" />
            <Feature icon={FileSpreadsheet} label="Excel-aware category palette & overtime rules" />
            <Feature icon={Lock} label="Immutable approval audit trail" />
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[var(--color-text-muted)]">
          © {new Date().getFullYear()} Sulfur Recovery Engineering Inc.
        </p>

        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'var(--color-accent)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-25 blur-3xl"
          style={{ background: 'var(--color-cat-office-border)' }}
        />
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              SRE
            </span>
            <span>Timesheet</span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Sign in with your work email to continue.
            </p>
          </div>

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
                <Button type="submit" disabled={pending} className="w-full">
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
                <Button type="submit" disabled={pending || magicSent} className="w-full">
                  {magicSent ? 'Link sent' : pending ? 'Sending…' : 'Send magic link'}
                </Button>
                <p className="text-xs text-[var(--color-text-muted)]">
                  We&apos;ll email you a one-time sign-in link. No password required.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Need access? Ask your admin to create your account.
          </p>
        </div>
      </section>
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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

function Feature({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[var(--color-text)]">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface)] ring-1 ring-[var(--color-border)] text-[var(--color-accent)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {label}
    </li>
  );
}
