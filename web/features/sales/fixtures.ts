import type {
  Opportunity,
  OpportunityDetail,
  OpportunityStage,
  Summary,
} from './types';
import { OPPORTUNITY_STAGES, daysInStage } from './types';

// Deterministic fixture set. Small enough to eyeball, wide enough to fill every
// column and expose the aging / country / value edges.
const NOW = new Date('2026-08-25T09:00:00.000Z');
const daysAgo = (d: number): string =>
  new Date(NOW.getTime() - d * 86_400_000).toISOString();

const stageId = (s: OpportunityStage): string =>
  `stage_${s.toLowerCase().replace(/\s+/g, '_')}`;

interface Seed {
  name: string;
  stage: OpportunityStage;
  value: number;
  country: string;
  engineer: string;
  engineerId: string;
  proposal: string;
  scope: NonNullable<Opportunity['customFields']>['sre_scope_type'];
  ageDays: number;
  stageAgeDays: number;
  nextAction?: string;
  sharepoint?: string;
}

const SEEDS: Seed[] = [
  { name: 'Aramco — SRE-2026-0142', stage: 'Inquiry', value: 180_000, country: 'Saudi Arabia', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0142', scope: 'Study', ageDays: 3, stageAgeDays: 3, nextAction: 'Draft technical scope' },
  { name: 'ADNOC Gas — SRE-2026-0138', stage: 'Inquiry', value: 95_000, country: 'UAE', engineer: 'Yasir Ahmed', engineerId: 'u_yasir', proposal: 'SRE-2026-0138', scope: 'RFQ', ageDays: 5, stageAgeDays: 5 },
  { name: 'Petronas — SRE-2026-0131', stage: 'Technical Proposal', value: 420_000, country: 'Malaysia', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0131', scope: 'EPC', ageDays: 12, stageAgeDays: 8, nextAction: 'Send draft for internal review' },
  { name: 'KOC — SRE-2026-0129', stage: 'Technical Proposal', value: 260_000, country: 'Kuwait', engineer: 'Tariq Rehman', engineerId: 'u_tariq', proposal: 'SRE-2026-0129', scope: 'Study', ageDays: 15, stageAgeDays: 11 },
  { name: 'QatarEnergy — SRE-2026-0121', stage: 'Commercial Proposal', value: 640_000, country: 'Qatar', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0121', scope: 'EPC', ageDays: 22, stageAgeDays: 6, nextAction: 'Finalize commercial terms' },
  { name: 'Sonatrach — SRE-2026-0118', stage: 'Proposal Sent', value: 305_000, country: 'Algeria', engineer: 'Yasir Ahmed', engineerId: 'u_yasir', proposal: 'SRE-2026-0118', scope: 'Study', ageDays: 34, stageAgeDays: 18, sharepoint: 'https://sharepoint.example.com/SRE-2026-0118' },
  { name: 'BAPCO — SRE-2026-0115', stage: 'Proposal Sent', value: 210_000, country: 'Bahrain', engineer: 'Tariq Rehman', engineerId: 'u_tariq', proposal: 'SRE-2026-0115', scope: 'Study', ageDays: 41, stageAgeDays: 33, nextAction: 'Follow up — no response in 3 weeks', sharepoint: 'https://sharepoint.example.com/SRE-2026-0115' },
  { name: 'PDO — SRE-2026-0111', stage: 'Follow-up', value: 155_000, country: 'Oman', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0111', scope: 'RFQ', ageDays: 48, stageAgeDays: 15 },
  { name: 'Pertamina — SRE-2026-0108', stage: 'Follow-up', value: 380_000, country: 'Indonesia', engineer: 'Yasir Ahmed', engineerId: 'u_yasir', proposal: 'SRE-2026-0108', scope: 'EPC', ageDays: 55, stageAgeDays: 38, nextAction: 'Call procurement lead' },
  { name: 'SABIC — SRE-2026-0104', stage: 'Approved', value: 720_000, country: 'Saudi Arabia', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0104', scope: 'EPC', ageDays: 62, stageAgeDays: 4, nextAction: 'Awaiting PO issuance', sharepoint: 'https://sharepoint.example.com/SRE-2026-0104' },
  { name: 'ADNOC Refining — SRE-2026-0099', stage: 'Won', value: 540_000, country: 'UAE', engineer: 'Tariq Rehman', engineerId: 'u_tariq', proposal: 'SRE-2026-0099', scope: 'Study', ageDays: 78, stageAgeDays: 20 },
  { name: 'Aramco Trading — SRE-2026-0091', stage: 'Won', value: 285_000, country: 'Saudi Arabia', engineer: 'Maaz Khan', engineerId: 'u_maaz', proposal: 'SRE-2026-0091', scope: 'Study', ageDays: 85, stageAgeDays: 42 },
  { name: 'ONGC — SRE-2026-0085', stage: 'Lost', value: 190_000, country: 'India', engineer: 'Yasir Ahmed', engineerId: 'u_yasir', proposal: 'SRE-2026-0085', scope: 'RFQ', ageDays: 92, stageAgeDays: 55 },
];

const FIXTURE_OPPS: OpportunityDetail[] = SEEDS.map((s, i) => ({
  id: `opp_${String(i + 1).padStart(4, '0')}`,
  name: s.name,
  status:
    s.stage === 'Won'
      ? 'won'
      : s.stage === 'Lost'
      ? 'lost'
      : ('open' as const),
  monetaryValue: s.value,
  pipelineStageId: stageId(s.stage),
  stage: s.stage,
  contactId: `contact_${i + 1}`,
  customFields: {
    sre_proposal_number: s.proposal,
    sre_proposal_sharepoint_url: s.sharepoint,
    sre_customer_country: s.country,
    sre_assigned_engineer: s.engineer,
    sre_engineer_user_id: s.engineerId,
    sre_scope_type: s.scope,
    sre_next_action: s.nextAction,
  },
  createdAt: daysAgo(s.ageDays),
  updatedAt: daysAgo(Math.min(s.ageDays, s.stageAgeDays)),
  stageEnteredAt: daysAgo(s.stageAgeDays),
  notes: [
    {
      id: `note_${i}_1`,
      body: `Kick-off call notes for ${s.name}. Client asked about turnaround.`,
      author: s.engineer,
      createdAt: daysAgo(Math.max(1, s.ageDays - 1)),
    },
    ...(s.nextAction
      ? [
          {
            id: `note_${i}_2`,
            body: `Next action: ${s.nextAction}`,
            author: s.engineer,
            createdAt: daysAgo(Math.max(0, s.stageAgeDays - 1)),
          },
        ]
      : []),
  ],
  tasks: s.nextAction
    ? [
        {
          id: `task_${i}_1`,
          title: s.nextAction,
          dueAt: daysAgo(-3),
          done: false,
        },
      ]
    : [],
}));

export function fixtureOpportunities(): OpportunityDetail[] {
  return FIXTURE_OPPS;
}

export function fixtureStages(): { name: string; id: string }[] {
  return OPPORTUNITY_STAGES.map((s) => ({ name: s, id: stageId(s) }));
}

export function fixtureSummary(): Summary {
  const opps = FIXTURE_OPPS;
  const byStage = OPPORTUNITY_STAGES.map((stage) => {
    const rows = opps.filter((o) => o.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((a, o) => a + (o.monetaryValue ?? 0), 0),
    };
  });
  const won = opps.filter((o) => o.status === 'won');
  const lost = opps.filter((o) => o.status === 'lost');
  const ratePct = won.length + lost.length === 0
    ? 0
    : Math.round((won.length / (won.length + lost.length)) * 100);
  const byCustomer = new Map<string, { value: number; count: number }>();
  for (const o of opps) {
    const customer = o.name.split(' — ')[0] ?? o.name;
    const prev = byCustomer.get(customer) ?? { value: 0, count: 0 };
    byCustomer.set(customer, {
      value: prev.value + (o.monetaryValue ?? 0),
      count: prev.count + 1,
    });
  }
  const topCustomers = Array.from(byCustomer.entries())
    .map(([customer, v]) => ({ customer, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const agingDeals = opps
    .filter((o) => o.status === 'open')
    .map((o) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      daysInStage: daysInStage(o.stageEnteredAt, NOW),
    }))
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 10);
  const byCountryMap = new Map<string, { value: number; count: number }>();
  for (const o of opps) {
    const c = o.customFields?.sre_customer_country ?? '—';
    const prev = byCountryMap.get(c) ?? { value: 0, count: 0 };
    byCountryMap.set(c, {
      value: prev.value + (o.monetaryValue ?? 0),
      count: prev.count + 1,
    });
  }
  const byCountry = Array.from(byCountryMap.entries())
    .map(([country, v]) => ({ country, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value);
  return {
    generatedAt: NOW.toISOString(),
    totalOpportunities: opps.length,
    byStage,
    winRate90d: { won: won.length, lost: lost.length, ratePct },
    topCustomers,
    agingDeals,
    byCountry,
  };
}
