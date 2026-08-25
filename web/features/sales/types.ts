export const OPPORTUNITY_STAGES = [
  'Inquiry',
  'Technical Proposal',
  'Commercial Proposal',
  'Proposal Sent',
  'Follow-up',
  'Approved',
  'Won',
  'Lost',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned';
export type ScopeType = 'Study' | 'EPC' | 'RFQ' | 'NDA' | 'Other';

export interface OpportunityCustomFields {
  sre_proposal_number?: string;
  sre_proposal_sharepoint_url?: string;
  sre_customer_country?: string;
  sre_assigned_engineer?: string;
  sre_engineer_user_id?: string;
  sre_last_followup_at?: string;
  sre_next_action?: string;
  sre_scope_type?: ScopeType;
}

export interface Opportunity {
  id: string;
  name: string;
  status: OpportunityStatus;
  monetaryValue?: number;
  pipelineStageId: string;
  stage: OpportunityStage;
  contactId?: string;
  customFields?: OpportunityCustomFields;
  updatedAt: string;
  createdAt: string;
  stageEnteredAt: string;
}

export interface OpportunityNote {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface OpportunityTask {
  id: string;
  title: string;
  dueAt?: string;
  done: boolean;
}

export interface OpportunityDetail extends Opportunity {
  notes: OpportunityNote[];
  tasks: OpportunityTask[];
}

export interface Summary {
  generatedAt: string;
  totalOpportunities: number;
  byStage: { stage: string; count: number; value: number }[];
  winRate90d: { won: number; lost: number; ratePct: number };
  topCustomers: { customer: string; value: number; count: number }[];
  agingDeals: { id: string; name: string; stage: string; daysInStage: number }[];
  byCountry: { country: string; count: number; value: number }[];
}

export function daysInStage(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
