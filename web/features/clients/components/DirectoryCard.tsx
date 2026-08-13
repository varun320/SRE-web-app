import Link from 'next/link';
import { Mail, Phone, MapPin, Users, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/shared/ui/status-badge';
import { formatDate } from '@/shared/lib/dates';
import type { DirectoryCard as CardData } from '@/features/clients/queries';

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

function shortCode(id: string): string {
  return `CL-${id.slice(-4).toUpperCase()}`;
}

function phaseTone(p: 'pre' | 'during' | 'post'): 'neutral' | 'info' | 'success' {
  return p === 'pre' ? 'neutral' : p === 'during' ? 'info' : 'success';
}
const PHASE_LABEL: Record<'pre' | 'during' | 'post', string> = { pre: 'Pre-Job', during: 'During Job', post: 'Post-Job' };

interface Props {
  card: CardData;
}

export function DirectoryCard({ card }: Props) {
  const repeat = card.previous_work.length > 0;
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4 md:p-5">
      <header className="flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-sm font-semibold"
          aria-hidden
        >
          {initials(card.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/clients/${card.id}`} className="text-base font-semibold hover:underline">
            {card.name}
          </Link>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Client ID {shortCode(card.id)} · {card.sites_count} site{card.sites_count === 1 ? '' : 's'} · {card.contacts_count} contact{card.contacts_count === 1 ? '' : 's'} · {card.jobs_count} job{card.jobs_count === 1 ? '' : 's'} on record
          </div>
        </div>
        {repeat ? <StatusBadge tone="warning">Repeat client</StatusBadge> : null}
      </header>

      <div className="mt-4 border-t border-[var(--color-accent)]/40" />

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Directory column: contacts + sites */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Contacts</span>
              <Link href={`/clients/${card.id}`} className="text-[var(--color-accent)] hover:underline normal-case tracking-normal">+ Add contact</Link>
            </div>
            {card.contacts.length === 0 ? (
              <div className="text-xs text-[var(--color-text-muted)]">No contacts yet.</div>
            ) : (
              <ul className="space-y-1.5">
                {card.contacts.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-medium">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        {c.name}
                        {c.role ? <span className="text-[var(--color-text-muted)]"> · {c.role}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-[var(--color-accent)]">
                            <Mail className="h-3 w-3" /> {c.email}
                          </a>
                        ) : null}
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-[var(--color-accent)]">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
                {card.contacts.length > 3 ? (
                  <li className="text-[11px] text-[var(--color-text-muted)]">
                    <Link href={`/clients/${card.id}`} className="hover:underline">+{card.contacts.length - 3} more →</Link>
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Sites / Locations</span>
              <Link href={`/clients/${card.id}`} className="text-[var(--color-accent)] hover:underline normal-case tracking-normal">+ Add site</Link>
            </div>
            {card.sites.length === 0 ? (
              <div className="text-xs text-[var(--color-text-muted)]">No sites yet.</div>
            ) : (
              <ul className="space-y-1">
                {card.sites.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <span className="font-mono text-[10px] text-[var(--color-accent)]">{s.short_code}</span>
                  </li>
                ))}
                {card.sites.length > 4 ? (
                  <li className="text-[11px] text-[var(--color-text-muted)]">
                    <Link href={`/clients/${card.id}`} className="hover:underline">+{card.sites.length - 4} more →</Link>
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          {card.sharepoint_url ? (
            <a
              href={card.sharepoint_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
            >
              SharePoint <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        {/* Jobs column: active + previous */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Active jobs</div>
            {card.active_jobs.length === 0 ? (
              <div className="text-xs text-[var(--color-text-muted)]">No active jobs.</div>
            ) : (
              <ul className="space-y-1">
                {card.active_jobs.slice(0, 3).map((j) => (
                  <li key={j.project_number} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/projects/${j.project_number}`} className="min-w-0 flex-1 truncate hover:underline">
                      <span className="font-mono text-[var(--color-accent)]">{j.project_number}</span>
                      <span className="ml-2">{j.scope}</span>
                    </Link>
                    <StatusBadge tone={phaseTone(j.phase)}>{PHASE_LABEL[j.phase]}</StatusBadge>
                  </li>
                ))}
                {card.active_jobs.length > 3 ? (
                  <li className="text-[11px] text-[var(--color-text-muted)]">
                    <Link href={`/clients/${card.id}`} className="hover:underline">+{card.active_jobs.length - 3} more →</Link>
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Previous work</div>
            {card.previous_work.length === 0 ? (
              <div className="text-xs text-[var(--color-text-muted)]">No previous work.</div>
            ) : (
              <ul className="space-y-1">
                {card.previous_work.slice(0, 3).map((j) => (
                  <li key={j.project_number} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/projects/${j.project_number}`} className="min-w-0 flex-1 truncate hover:underline">
                      <span className="font-mono text-[var(--color-accent)]">{j.project_number}</span>
                      <span className="ml-2">{j.scope}</span>
                    </Link>
                    {j.deadline ? (
                      <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{formatDate(j.deadline)}</span>
                    ) : null}
                  </li>
                ))}
                {card.previous_work.length > 3 ? (
                  <li className="text-[11px] text-[var(--color-text-muted)]">
                    <Link href={`/clients/${card.id}`} className="hover:underline">+{card.previous_work.length - 3} more →</Link>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
