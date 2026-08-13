'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { createProject } from '@/features/projects/actions/projects';

export interface ClientOpt {
  id: string;
  name: string;
  sites: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; name: string; email: string | null; role: string | null }>;
  past_projects: Array<{
    project_number: number;
    name: string;
    scope_title: string | null;
    site_id: string | null;
    deadline: string | null;
    status: string;
  }>;
}
export interface TemplateOpt {
  id: string;
  name: string;
  description: string | null;
  task_count: number;
}
export interface UserOpt {
  id: string;
  full_name: string;
}

interface Props {
  clients: ClientOpt[];
  templates: TemplateOpt[];
  users: UserOpt[];
  suggestedNumber: number;
}

const NONE = '__none__';
const NEW = '__new__';

export function NewJobModal({ clients, templates, users, suggestedNumber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [number, setNumber] = useState(String(suggestedNumber));
  const [scopeTitle, setScopeTitle] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [siteChoice, setSiteChoice] = useState(NONE);
  const [newSiteName, setNewSiteName] = useState('');
  const [contactChoice, setContactChoice] = useState(NONE);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [leadId, setLeadId] = useState(users[0]?.id ?? '');
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set());
  const [deadline, setDeadline] = useState('');
  const [hasOnsite, setHasOnsite] = useState(false);
  const [onsiteStart, setOnsiteStart] = useState('');
  const [onsiteEnd, setOnsiteEnd] = useState('');

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clientId, clients]);
  const template = useMemo(() => templates.find((t) => t.id === templateId), [templateId, templates]);
  const pastProjects = useMemo(() => {
    if (!client?.past_projects?.length) return [];
    const selectedSite = siteChoice !== NONE && siteChoice !== NEW ? siteChoice : null;
    return client.past_projects
      .filter((p) => (selectedSite ? p.site_id === selectedSite : true))
      .slice(0, 6);
  }, [client, siteChoice]);

  function toggleTeam(id: string) {
    setTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!clientId) return toast.error('Pick a client');
    if (!templateId) return toast.error('Pick a project type');
    if (!leadId) return toast.error('Pick a project lead');
    if (!deadline) return toast.error('Pick a report submission date');
    if (!scopeTitle.trim()) return toast.error('Enter a scope title');
    if (hasOnsite) {
      if (!onsiteStart || !onsiteEnd) return toast.error('Fill on-site start + end');
      if (onsiteStart > onsiteEnd) return toast.error('On-site start must be on/before end');
    }
    const n = Number(number);
    if (!Number.isFinite(n) || n < 2020000 || n > 2099999) return toast.error('Project # must be 7 digits (e.g. 2026101)');

    start(async () => {
      const fd = new FormData();
      fd.set('project_number', String(n));
      fd.set('scope_title', scopeTitle.trim());
      fd.set('template_id', templateId);
      fd.set('client_id', clientId);
      fd.set('site_choice', siteChoice);
      if (siteChoice === NEW) fd.set('new_site_name', newSiteName);
      fd.set('contact_choice', contactChoice);
      if (contactChoice === NEW) {
        fd.set('new_contact_name', newContactName);
        fd.set('new_contact_email', newContactEmail);
        fd.set('new_contact_role', newContactRole);
        fd.set('new_contact_phone', newContactPhone);
      }
      fd.set('lead_id', leadId);
      for (const id of teamIds) fd.append('team_ids', id);
      fd.set('deadline', deadline);
      fd.set('has_onsite', String(hasOnsite));
      if (hasOnsite) {
        fd.set('onsite_start', onsiteStart);
        fd.set('onsite_end', onsiteEnd);
      }

      const res = await createProject(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Job ${res?.project_number} created`);
      setOpen(false);
      if (res?.project_number) router.push(`/projects/${res.project_number}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<Button variant="default" size="sm" />}>
        <Plus className="mr-1 h-3.5 w-3.5" /> New job
      </DialogPrimitive.Trigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Project number">
            <input
              type="number"
              min={2020000}
              max={2099999}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={`Project type${template ? ` · ${template.task_count} tasks` : ''}`}>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Scope title" className="md:col-span-2">
            <input
              value={scopeTitle}
              onChange={(e) => setScopeTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. SRU Tail Gas Sampling Survey"
            />
          </Field>

          <Field label="Client">
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteChoice(NONE); setContactChoice(NONE); }} className={inputCls}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Site / Location">
            <select value={siteChoice} onChange={(e) => setSiteChoice(e.target.value)} className={inputCls}>
              <option value={NONE}>— none —</option>
              {client?.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value={NEW}>+ Add new site</option>
            </select>
            {siteChoice === NEW ? (
              <input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className={`${inputCls} mt-1.5`}
                placeholder="Site name (e.g. Fort McMurray, AB)"
              />
            ) : null}
          </Field>

          {pastProjects.length > 0 ? (
            <div className="md:col-span-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/60 p-2.5">
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                Past work for {client?.name}
                {siteChoice !== NONE && siteChoice !== NEW ? ` · ${client?.sites.find((s) => s.id === siteChoice)?.name ?? ''}` : ''}
              </div>
              <ul className="space-y-1">
                {pastProjects.map((p) => {
                  const siteName = p.site_id ? client?.sites.find((s) => s.id === p.site_id)?.name : null;
                  return (
                    <li key={p.project_number} className="flex items-center justify-between gap-2 text-xs">
                      <a
                        href={`/projects/${p.project_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[var(--color-accent)] hover:underline"
                      >
                        {p.project_number}
                      </a>
                      <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                        {p.scope_title ?? p.name}
                      </span>
                      <span className="shrink-0 text-[var(--color-text-muted)]">
                        {siteName ? `${siteName} · ` : ''}{p.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <Field label="Contact" className="md:col-span-2">
            <select value={contactChoice} onChange={(e) => setContactChoice(e.target.value)} className={inputCls}>
              <option value={NONE}>— none —</option>
              {client?.contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>
              ))}
              <option value={NEW}>+ Add new contact</option>
            </select>
            {contactChoice === NEW ? (
              <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className={inputCls} placeholder="Name" />
                <input value={newContactRole} onChange={(e) => setNewContactRole(e.target.value)} className={inputCls} placeholder="Role" />
                <input value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} className={inputCls} placeholder="Email" />
                <input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} className={inputCls} placeholder="Phone" />
              </div>
            ) : null}
          </Field>

          <Field label="Project lead">
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={inputCls}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Report submission date">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
          </Field>

          <Field label="On-site activity" className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasOnsite}
                onChange={(e) => setHasOnsite(e.target.checked)}
                className="h-4 w-4"
              />
              This job includes on-site work
            </label>
            {hasOnsite ? (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">On-site start</span>
                  <input type="date" value={onsiteStart} onChange={(e) => setOnsiteStart(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">On-site end</span>
                  <input type="date" value={onsiteEnd} onChange={(e) => setOnsiteEnd(e.target.value)} className={inputCls} />
                </label>
              </div>
            ) : null}
          </Field>

          <Field label="Team members" className="md:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = teamIds.has(u.id) || u.id === leadId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => u.id !== leadId && toggleTeam(u.id)}
                    disabled={u.id === leadId}
                    className={[
                      'px-2 py-1 rounded-full text-xs border transition-colors',
                      on
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
                        : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
                      u.id === leadId ? 'opacity-80 cursor-default' : '',
                    ].join(' ')}
                  >
                    {u.full_name}{u.id === leadId ? ' · lead' : ''}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <p className="text-[11px] text-[var(--color-text-muted)]">
          Tasks auto-generate from the template. Pre-Job dates anchor 14 days before the on-site start (or before the report deadline if no on-site). During-Job anchors 6 days before on-site start. Post-Job anchors 1 day before the report submission date.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
