// Bind a per-request Supabase session from an Authorization: Bearer header.
//
// The remote MCP transport calls this on every JSON-RPC request. The returned
// SupabaseClient carries the caller's JWT on every downstream REST/RPC call,
// so RLS resolves auth.uid() to the right user and adminOnly tools can be
// filtered accurately.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface McpSession {
  sb: SupabaseClient;
  userId: string;
  email: string | null;
  isAdmin: boolean;
}

const BEARER = /^Bearer\s+(.+)$/i;

export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const m = BEARER.exec(authHeader);
  return m ? m[1].trim() : null;
}

export async function sessionFromBearer(bearer: string): Promise<McpSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set on the server',
    );
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  const { data, error } = await sb.auth.getUser(bearer);
  if (error || !data.user) return null;

  const { data: role } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  return {
    sb,
    userId: data.user.id,
    email: data.user.email ?? null,
    isAdmin: !!role,
  };
}
