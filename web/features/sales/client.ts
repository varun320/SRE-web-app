import 'server-only';
import {
  fixtureOpportunities,
  fixtureStages,
  fixtureSummary,
} from './fixtures';
import type {
  Opportunity,
  OpportunityDetail,
  OpportunityStage,
  Summary,
} from './types';

// The sidecar isn't live yet, so this client always resolves to fixtures unless
// SRE_AUTOMATIONS_URL is set AND SRE_SALES_FIXTURES !== '1'. When the real
// endpoints ship, delete the ternary — signature stays.
//
// Every fetch has a `stale: boolean` flag; pages render a banner when true so
// operators know they're looking at cached/fixture data.

interface Fetched<T> {
  data: T;
  stale: boolean;
  source: 'fixture' | 'live' | 'cache';
  error?: string;
}

function useFixtures(): boolean {
  if (process.env.SRE_SALES_FIXTURES === '1') return true;
  if (!process.env.SRE_AUTOMATIONS_URL) return true;
  return false;
}

async function callSidecar<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.SRE_AUTOMATIONS_URL;
  if (!base) throw new Error('SRE_AUTOMATIONS_URL not set');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      // ponytail: shared-secret header only, add HMAC signing when sidecar ships
      'x-sre-secret': process.env.SRE_APP_SHARED_SECRET ?? '',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Sidecar ${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function listOpportunities(): Promise<Fetched<OpportunityDetail[]>> {
  if (useFixtures()) {
    return { data: fixtureOpportunities(), stale: false, source: 'fixture' };
  }
  try {
    const data = await callSidecar<OpportunityDetail[]>('/api/opportunities');
    return { data, stale: false, source: 'live' };
  } catch (e: unknown) {
    return {
      data: fixtureOpportunities(),
      stale: true,
      source: 'fixture',
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export async function getOpportunity(
  id: string,
): Promise<Fetched<OpportunityDetail | null>> {
  if (useFixtures()) {
    const found = fixtureOpportunities().find((o) => o.id === id) ?? null;
    return { data: found, stale: false, source: 'fixture' };
  }
  try {
    const data = await callSidecar<OpportunityDetail>(`/api/opportunities/${id}`);
    return { data, stale: false, source: 'live' };
  } catch (e: unknown) {
    const fallback =
      fixtureOpportunities().find((o) => o.id === id) ?? null;
    return {
      data: fallback,
      stale: true,
      source: 'fixture',
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export async function getSummary(): Promise<Fetched<Summary>> {
  if (useFixtures()) {
    return { data: fixtureSummary(), stale: false, source: 'fixture' };
  }
  try {
    const data = await callSidecar<Summary>('/api/summary');
    return { data, stale: false, source: 'live' };
  } catch (e: unknown) {
    return {
      data: fixtureSummary(),
      stale: true,
      source: 'fixture',
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export async function listStages(): Promise<Fetched<{ name: string; id: string }[]>> {
  if (useFixtures()) {
    return { data: fixtureStages(), stale: false, source: 'fixture' };
  }
  try {
    const data = await callSidecar<{ name: string; id: string }[]>('/api/stages');
    return { data, stale: false, source: 'live' };
  } catch (e: unknown) {
    return {
      data: fixtureStages(),
      stale: true,
      source: 'fixture',
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export async function patchStage(
  id: string,
  stage: OpportunityStage,
): Promise<{ ok: boolean; stale: boolean; error?: string }> {
  if (useFixtures()) return { ok: true, stale: true };
  try {
    await callSidecar(`/api/opportunities/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
    return { ok: true, stale: false };
  } catch (e: unknown) {
    return {
      ok: false,
      stale: true,
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export async function postNote(
  id: string,
  body: string,
): Promise<{ ok: boolean; stale: boolean; error?: string }> {
  if (useFixtures()) return { ok: true, stale: true };
  try {
    await callSidecar(`/api/opportunities/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return { ok: true, stale: false };
  } catch (e: unknown) {
    return {
      ok: false,
      stale: true,
      error: e instanceof Error ? e.message : 'Unknown sidecar error',
    };
  }
}

export type { Opportunity, OpportunityDetail, Summary };
