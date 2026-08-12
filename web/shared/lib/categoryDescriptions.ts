import type { MainCategory } from './types';

// Plain-English descriptions of every category so a non-technical admin can
// pick the right option without training. Keyed by subcategory NAME (matches
// public.sub_categories.name from the taxonomy seed).

export const MAIN_CATEGORY_DESCRIPTIONS: Record<MainCategory, string> = {
  Project:
    'Billable work done against a specific project number — anything a client is paying for or that shows up on a project invoice.',
  Admin:
    'Non-billable company time — sick, vacation, TIL taken, statutory holidays, and internal admin work.',
  'Office & Sales':
    'Non-billable business-development time — customer contact, proposals, inventory, conferences, and general office work.',
};

export const SUB_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // Project
  Travel:                'Time spent travelling to or from a client site or project location.',
  'Site Travel':         'Movement between client locations during a site visit (not the initial trip out).',
  'Site Work':           'On-site engineering, commissioning, or fieldwork against the project.',
  Report:                'Writing project reports, deliverables, or client-facing documentation.',
  'Extra Integration':   'Integration effort beyond the original scope — new interfaces, systems, or vendor coordination.',
  Simulation:            'Process simulation, modelling, or design calculations for the project.',
  'Office Preparation':  'Office-side prep before a site visit — kit prep, drawings, PPE, coordination.',
  'Project Management':  'PM activity — schedule, budget, change orders, client comms, coordination.',
  'Engineering Work':    'Core engineering work at the office — design, calcs, drawings, reviews for a project.',

  // Admin
  'Overtime Taken':
    'Using previously-banked TIL hours as paid time off. Deducts from your TIL balance and does NOT count as base hours (so it will not inflate this week\'s overtime).',
  'TIL Payout':
    'Cashing out banked TIL as extra pay on a paycheck. Deducts from your TIL balance and does NOT count as base hours.',
  'Sick Time':           'Sick leave — does not consume TIL or vacation.',
  'Vacation Hours':      'Paid vacation drawn from your annual vacation balance.',
  'Statutory Holiday':   'Recognized statutory holiday — non-working day paid at regular rate.',
  Administrative:        'Internal admin work — timesheets, HR paperwork, expense reports, general admin tasks.',
  'Toolbox Meeting':     'Safety toolbox / tailgate meetings and mandatory internal briefings.',

  // Office & Sales
  'Customer Contact':    'Client-facing calls, meetings, or emails not tied to an active project.',
  'Project Development': 'Scoping and shaping potential future work — pre-proposal discovery.',
  'Proposals & Quotes':  'Writing proposals, RFQ responses, or generating quotes.',
  Inventory:             'Stock, tools, and materials management for the office or warehouse.',
  'SRU Study':           'Sulfur Recovery Unit studies or internal technical research.',
  Conference:            'Industry conference or trade-show attendance.',
  General:               'Office & sales work that does not fit the other buckets.',
};

export function subCategoryHint(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return SUB_CATEGORY_DESCRIPTIONS[name];
}

// Display-label overrides — the DB name stays canonical (referenced by SQL
// views and import rules), but the UI shows a plain-English label so a
// non-technical admin can tell "TIL taken as time off" apart from "TIL
// cashed out on a paycheck".
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'Overtime Taken': 'TIL — Taken as time off',
  'TIL Payout':     'TIL — Cash payout',
};

export function subCategoryLabel(name: string): string {
  return DISPLAY_NAME_OVERRIDES[name] ?? name;
}
