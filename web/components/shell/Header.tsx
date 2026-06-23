import Link from 'next/link';
import { HelpButton } from './HelpButton';

export function Header({ email, isAdmin }: { email: string; isAdmin?: boolean }) {
  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/week/current" className="font-semibold tracking-tight">SRE Timesheet</Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/week/current">Week</Link>
          <Link href="/me/til">TIL</Link>
          <Link href="/me/vacation">Vacation</Link>
          {isAdmin ? <Link href="/admin" className="font-medium text-[var(--color-accent)]">Admin</Link> : null}
          <HelpButton />
          <span className="text-[var(--color-text-muted)]">{email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
