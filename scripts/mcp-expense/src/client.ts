import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SreEnv {
  url: string;
  anonKey: string;
  accessToken: string;
  refreshToken?: string;
}

export function loadEnv(): SreEnv {
  const url = process.env.SRE_SUPABASE_URL;
  const anonKey = process.env.SRE_SUPABASE_ANON_KEY;
  const accessToken = process.env.SRE_ACCESS_TOKEN;
  const refreshToken = process.env.SRE_REFRESH_TOKEN;
  if (!url || !anonKey || !accessToken) {
    throw new Error(
      'Missing env: SRE_SUPABASE_URL, SRE_SUPABASE_ANON_KEY, SRE_ACCESS_TOKEN are required',
    );
  }
  return { url, anonKey, accessToken, refreshToken };
}

export async function connect(env: SreEnv): Promise<SupabaseClient> {
  const sb = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${env.accessToken}` } },
  });
  // Provide the session so RLS binds to the correct auth.uid().
  await sb.auth.setSession({
    access_token: env.accessToken,
    refresh_token: env.refreshToken ?? env.accessToken,
  });
  return sb;
}

export async function currentUser(sb: SupabaseClient): Promise<{ id: string; email: string | null }> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error(`auth.getUser failed: ${error?.message ?? 'no user'}`);
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function isAdmin(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) return false;
  return !!data;
}
