'use client';

import { useMemo, useState, useTransition } from 'react';
import { ExternalLink, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { OpportunityDetail, OpportunityStage } from '@/features/sales/types';
import { OPPORTUNITY_STAGES, daysInStage } from '@/features/sales/types';
import { StatusBadge } from '@/shared/ui/status-badge';
import { EmptyState } from '@/shared/ui/empty-state';
import { OpportunityDrawer } from './OpportunityDrawer';

type FilterKind = 'all' | 'mine' | 'country' | 'stage';

interface Props {
  opportunities: OpportunityDetail[];
  currentEngineerId: string | null;
  isAdmin: boolean;
}

function canEditOpp(
  opp: OpportunityDetail,
  currentEngineerId: string | null,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  const owner = opp.customFields?.sre_engineer_user_id;
  return Boolean(owner && currentEngineerId && owner === currentEngineerId);
}

function formatCurrency(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function KanbanBoard({ opportunities, currentEngineerId, isAdmin }: Props) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [country, setCountry] = useState<string>('');
  const [stage, setStage] = useState<OpportunityStage | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Optimistic override of an opp's stage after a drop — instant UI move
  // while the server action fires; rolled back if the action fails.
  const [overrides, setOverrides] = useState<Record<string, OpportunityStage>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<OpportunityStage | null>(null);

  const countries = useMemo(
    () =>
      Array.from(
        new Set(
          opportunities
            .map((o) => o.customFields?.sre_customer_country)
            .filter((c): c is string => Boolean(c)),
        ),
      ).sort(),
    [opportunities],
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'mine':
        if (!currentEngineerId) return [];
        return opportunities.filter(
          (o) => o.customFields?.sre_engineer_user_id === currentEngineerId,
        );
      case 'country':
        if (!country) return opportunities;
        return opportunities.filter(
          (o) => o.customFields?.sre_customer_country === country,
        );
      case 'stage':
        if (!stage) return opportunities;
        return opportunities.filter((o) => o.stage === stage);
      default:
        return opportunities;
    }
  }, [filter, country, stage, opportunities, currentEngineerId]);

  const byStage = useMemo(() => {
    const map = new Map<OpportunityStage, OpportunityDetail[]>();
    for (const s of OPPORTUNITY_STAGES) map.set(s, []);
    for (const o of filtered) {
      const effective = overrides[o.id] ?? o.stage;
      map.get(effective)?.push(o);
    }
    return map;
  }, [filtered, overrides]);

  const totalValue = filtered.reduce((a, o) => a + (o.monetaryValue ?? 0), 0);

  const selected = selectedId
    ? opportunities.find((o) => o.id === selectedId) ?? null
    : null;

  const handleActionResult = (result: {
    ok: boolean;
    stale: boolean;
    error?: string;
  }) => {
    if (!result.ok) {
      toast.error(result.error ?? 'Action failed');
      return;
    }
    if (result.stale) {
      toast.info('Saved locally — live sync unavailable, will re-emit when the sidecar is up.');
    } else {
      toast.success('Saved');
    }
  };

  const handleStageChange = (id: string, next: OpportunityStage) => {
    startTransition(async () => {
      const { changeStageAction } = await import('./actions');
      const result = await changeStageAction({ id, stage: next });
      handleActionResult(result);
      if (!result.ok) {
        setOverrides((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      }
    });
  };

  const handleDrop = (id: string, next: OpportunityStage) => {
    const opp = opportunities.find((o) => o.id === id);
    if (!opp) return;
    if (!canEditOpp(opp, currentEngineerId, isAdmin)) {
      toast.error('Only the assigned engineer or an admin can move this card.');
      return;
    }
    const currentEffective = overrides[id] ?? opp.stage;
    if (currentEffective === next) return;
    setOverrides((prev) => ({ ...prev, [id]: next }));
    handleStageChange(id, next);
  };

  const handleAddNote = (id: string, body: string) => {
    startTransition(async () => {
      const { addNoteAction } = await import('./actions');
      const result = await addNoteAction({ id, body });
      handleActionResult(result);
    });
  };

  return (
    <div className="space-y-4">
      <FilterRow
        filter={filter}
        setFilter={setFilter}
        country={country}
        setCountry={setCountry}
        stage={stage}
        setStage={setStage}
        countries={countries}
        totalCount={filtered.length}
        totalValue={totalValue}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nothing here yet"
          description={
            filter === 'mine' && !currentEngineerId
              ? 'Your user is not linked to any GHL opportunities yet.'
              : 'No opportunities match this view.'
          }
        />
      ) : (
        <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-3 -mx-3 md:-mx-4 px-3 md:px-4">
          {OPPORTUNITY_STAGES.map((s) => {
            const rows = byStage.get(s) ?? [];
            const colValue = rows.reduce((a, o) => a + (o.monetaryValue ?? 0), 0);
            return (
              <section
                key={s}
                aria-label={`${s} column`}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTargetStage !== s) setDropTargetStage(s);
                }}
                onDragLeave={(e) => {
                  // Only clear if the pointer actually left the column, not just moved onto a child.
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTargetStage((prev) => (prev === s ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  setDropTargetStage(null);
                  setDraggingId(null);
                  if (id) handleDrop(id, s);
                }}
                className={[
                  'flex flex-col rounded-xl border bg-[var(--color-surface-2)]/40 min-h-[60vh] transition-colors',
                  dropTargetStage === s
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-tint)]/30'
                    : 'border-[var(--color-border-soft)]',
                ].join(' ')}
              >
                <header className="sticky top-0 z-[1] rounded-t-xl bg-[var(--color-surface-2)]/70 backdrop-blur border-b border-[var(--color-border-soft)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-[var(--color-text)]">{s}</h3>
                    <span className="text-[11px] font-mono tabular text-[var(--color-text-muted)]">
                      {rows.length}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono tabular text-[var(--color-text-subtle)]">
                    {formatCurrency(colValue)}
                  </div>
                </header>
                <div className="flex-1 space-y-2 p-2">
                  {rows.length === 0 ? (
                    <div className="text-center text-xs text-[var(--color-text-subtle)] py-8">
                      —
                    </div>
                  ) : (
                    rows.map((o) => {
                      const editable = canEditOpp(o, currentEngineerId, isAdmin);
                      return (
                        <OpportunityCard
                          key={o.id}
                          opp={o}
                          canEdit={editable}
                          onOpen={() => setSelectedId(o.id)}
                          isDragging={draggingId === o.id}
                          onDragStart={
                            editable
                              ? (e) => {
                                  e.dataTransfer.setData('text/plain', o.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggingId(o.id);
                                }
                              : undefined
                          }
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropTargetStage(null);
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <OpportunityDrawer
        opportunity={selected}
        canEdit={selected ? canEditOpp(selected, currentEngineerId, isAdmin) : false}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
        onStageChange={handleStageChange}
        onAddNote={handleAddNote}
        pending={isPending}
      />
    </div>
  );
}

interface CardProps {
  opp: OpportunityDetail;
  canEdit: boolean;
  onOpen: () => void;
  isDragging: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}

function OpportunityCard({ opp, canEdit, onOpen, isDragging, onDragStart, onDragEnd }: CardProps) {
  const days = daysInStage(opp.stageEnteredAt);
  const engineer = opp.customFields?.sre_assigned_engineer ?? '—';
  const proposal = opp.customFields?.sre_proposal_number;
  const country = opp.customFields?.sre_customer_country;
  const sharepoint = opp.customFields?.sre_proposal_sharepoint_url;
  const aging = days >= 30;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      title={canEdit ? undefined : 'Read-only — assigned to another engineer'}
      className={[
        'w-full text-left group rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5 hover:border-[var(--color-accent)] hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-[var(--color-text)] leading-snug line-clamp-2">
          {opp.name.split(' — ')[0]}
        </h4>
        {sharepoint ? (
          <ExternalLink
            aria-label="SharePoint proposal"
            className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--color-text-subtle)] group-hover:text-[var(--color-accent)]"
          />
        ) : null}
      </div>
      {proposal ? (
        <div className="mt-1 text-[11px] font-mono tabular text-[var(--color-text-subtle)]">
          {proposal}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[var(--color-text)] tabular">
          {formatCurrency(opp.monetaryValue)}
        </span>
        <StatusBadge tone={aging ? 'danger' : 'muted'}>{days}d</StatusBadge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-tint)] text-[10px] font-medium text-[var(--color-accent)]"
          >
            {initialsOf(engineer)}
          </span>
          <span className="truncate max-w-[80px]">{engineer.split(' ')[0]}</span>
        </span>
        {country ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{country}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface FilterRowProps {
  filter: FilterKind;
  setFilter: (f: FilterKind) => void;
  country: string;
  setCountry: (c: string) => void;
  stage: OpportunityStage | '';
  setStage: (s: OpportunityStage | '') => void;
  countries: string[];
  totalCount: number;
  totalValue: number;
}

function FilterRow({
  filter,
  setFilter,
  country,
  setCountry,
  stage,
  setStage,
  countries,
  totalCount,
  totalValue,
}: FilterRowProps) {
  const tabs: { key: FilterKind; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'My deals' },
    { key: 'country', label: 'By country' },
    { key: 'stage', label: 'By stage' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] pb-3">
      <div role="tablist" className="flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={[
              'inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
              filter === t.key
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
        {filter === 'country' ? (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="ml-2 rounded-md border border-[var(--color-border-soft)] bg-transparent px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        {filter === 'stage' ? (
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as OpportunityStage | '')}
            className="ml-2 rounded-md border border-[var(--color-border-soft)] bg-transparent px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label="Filter by stage"
          >
            <option value="">All stages</option>
            {OPPORTUNITY_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="text-body-sm text-[var(--color-text-muted)] font-mono tabular">
        {totalCount} deals
        <span className="mx-2 text-[var(--color-text-subtle)]">·</span>
        {formatCurrency(totalValue)}
      </div>
    </div>
  );
}
