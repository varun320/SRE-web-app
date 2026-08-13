'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { updateProject, deleteProject } from '@/features/projects/actions/projects';
import { friendlyError } from '@/shared/lib/errors';
import type { ClientWithDirectory, TemplateSummary, UserOption } from '@/features/projects/queries';
import type { ProjectPhase } from '@/features/projects/types';

interface Props {
  projectId: string;
  isLegacy: boolean;              // template_id currently null
  initial: {
    scope_title: string | null;
    client_id: string | null;
    site_id: string | null;
    contact_id: string | null;
    template_id: string | null;
    lead_id: string | null;
    deadline: string | null;
    phase: ProjectPhase;
    team_ids: string[];
    has_onsite: boolean;
    onsite_start: string | null;
    onsite_end: string | null;
  };
  clients: ClientWithDirectory[];
  templates: TemplateSummary[];
  users: UserOption[];
}

const NONE = '__none__';
const NEW = '__new__';

export function EditJobPanel({ projectId, isLegacy, initial, clients, templates, users }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [scopeTitle, setScopeTitle] = useState(initial.scope_title ?? '');
  const [clientId, setClientId] = useState(initial.client_id ?? '');
  const [siteChoice, setSiteChoice] = useState(initial.site_id ?? NONE);
  const [newSiteName, setNewSiteName] = useState('');
  const [contactChoice, setContactChoice] = useState(initial.contact_id ?? NONE);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [templateId, setTemplateId] = useState(initial.template_id ?? '');
  const [leadId, setLeadId] = useState(initial.lead_id ?? '');
  const [deadline, setDeadline] = useState(initial.deadline ?? '');
  const [phase, setPhase] = useState<ProjectPhase>(initial.phase);
  const [hasOnsite, setHasOnsite] = useState(initial.has_onsite);
  const [onsiteStart, setOnsiteStart] = useState(initial.onsite_start ?? '');
  const [onsiteEnd, setOnsiteEnd] = useState(initial.onsite_end ?? '');
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set(initial.team_ids));

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clientId, clients]);
  const currentTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templateId, templates]);

  function toggleTeam(id: string) {
    setTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    start(async () => {
      const payload: Parameters<typeof updateProject>[0] = { id: projectId };
      payload.scope_title = scopeTitle.trim() || undefined;
      payload.client_id = clientId || null;
      payload.site_id = siteChoice === NONE ? null : siteChoice === NEW ? undefined : siteChoice;
      payload.contact_id = contactChoice === NONE ? null : contactChoice === NEW ? undefined : contactChoice;
      if (siteChoice === NEW && newSiteName) payload.new_site_name = newSiteName;
      if (contactChoice === NEW && newContactName) {
        payload.new_contact_name = newContactName;
        payload.new_contact_role = newContactRole;
        payload.new_contact_email = newContactEmail;
        payload.new_contact_phone = newContactPhone;
      }
      if (isLegacy && templateId) payload.template_id = templateId;
      if (leadId) payload.lead_id = leadId;
      payload.deadline = deadline || null;
      payload.phase = phase;
      payload.has_onsite = hasOnsite;
      payload.onsite_start = hasOnsite ? (onsiteStart || null) : null;
      payload.onsite_end   = hasOnsite ? (onsiteEnd   || null) : null;
      if (hasOnsite && onsiteStart && onsiteEnd && onsiteStart > onsiteEnd) {
        toast.error('On-site start must be on/before end');
        return;
      }
      payload.team_ids = Array.from(teamIds);

      const res = await updateProject(payload);
      if (res?.error) { toast.error(friendlyError(res.error)); return; }
      toast.success(isLegacy && templateId ? 'Adopted — tasks generated' : 'Project updated');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3.5 w-3.5" />
        {isLegacy ? 'Adopt / edit' : 'Edit job'}
      </Button>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface)] p-5 space-y-3">
      <h2 className="text-h3">Edit job</h2>
      {isLegacy ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Legacy project — pick a template to generate tasks. Fields below can also be changed.
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Scope title" className="md:col-span-2">
          <input value={scopeTitle} onChange={(e) => setScopeTitle(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Client">
          <select
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setSiteChoice(NONE); setContactChoice(NONE); }}
            className={inputCls}
          >
            <option value="">— pick a client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Site / Location">
          <select value={siteChoice} onChange={(e) => setSiteChoice(e.target.value)} className={inputCls}>
            <option value={NONE}>— none —</option>
            {client?.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value={NEW}>+ Add new site</option>
          </select>
          {siteChoice === NEW ? (
            <input value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="Site name" />
          ) : null}
        </Field>

        <Field label="Contact" className="md:col-span-2">
          <select value={contactChoice} onChange={(e) => setContactChoice(e.target.value)} className={inputCls}>
            <option value={NONE}>— none —</option>
            {client?.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>)}
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

        <Field label={`Template${currentTemplate ? ` · ${currentTemplate.task_count} tasks` : ''}`}>
          {isLegacy ? (
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
              <option value="">— pick a template —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)] px-2 py-1.5">
              {currentTemplate?.name ?? '—'} <span className="text-[10px]">(locked)</span>
            </div>
          )}
        </Field>
        <Field label="Phase">
          <select value={phase} onChange={(e) => setPhase(e.target.value as ProjectPhase)} className={inputCls}>
            <option value="pre">Pre</option>
            <option value="during">During</option>
            <option value="post">Post</option>
          </select>
        </Field>

        <Field label="Lead">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={inputCls}>
            <option value="">— pick a lead —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </Field>
        <Field label="Report submission date">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
        </Field>

        <Field label="On-site activity" className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasOnsite} onChange={(e) => setHasOnsite(e.target.checked)} className="h-4 w-4" />
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
              const isLead = u.id === leadId;
              const on = teamIds.has(u.id) || isLead;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => !isLead && toggleTeam(u.id)}
                  disabled={isLead}
                  className={[
                    'px-2 py-1 rounded-full text-xs border transition-colors',
                    on
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
                      : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
                    isLead ? 'opacity-80 cursor-default' : '',
                  ].join(' ')}
                >
                  {u.full_name}{isLead ? ' · lead' : ''}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-soft)]">
        <button
          type="button"
          onClick={() => {
            if (!confirm('Delete this job? Tasks, subitems, comments, and attachments will be removed. Timesheet entries stay put. This cannot be undone.')) return;
            start(async () => {
              const res = await deleteProject({ id: projectId });
              if (res?.error) { toast.error(res.error); return; }
              toast.success('Job deleted');
              router.push('/projects');
            });
          }}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-2.5 py-1.5 text-xs text-[var(--color-status-declined-fg)] hover:bg-[var(--color-status-declined-bg)]/40 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete job
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isLegacy && templateId ? 'Adopt & save' : 'Save')}
          </Button>
        </div>
      </div>
    </section>
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
