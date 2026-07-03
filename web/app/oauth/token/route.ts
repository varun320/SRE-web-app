// RFC 6749 §3.2 Token Endpoint.
//
// Two grants supported:
//   - authorization_code (initial exchange after /oauth/authorize)
//   - refresh_token       (proxied to Supabase so long-lived sessions work)
//
// Both return { access_token, token_type, expires_in, refresh_token } where
// access_token is a Supabase JWT — /mcp accepts it directly.

import type { NextRequest } from 'next/server';
import { verifyCode, verifyPkce } from '@/lib/expenses/mcp/oauth-code';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function oauthError(error: string, description: string, status = 400): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function readForm(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const j = (await req.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(j)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const params = await readForm(req);
  const grantType = params.grant_type;
  if (!grantType) return oauthError('invalid_request', 'grant_type is required');

  if (grantType === 'authorization_code') {
    return authorizationCodeGrant(params);
  }
  if (grantType === 'refresh_token') {
    return refreshTokenGrant(params);
  }
  return oauthError('unsupported_grant_type', `grant_type ${grantType} is not supported`);
}

async function authorizationCodeGrant(params: Record<string, string>): Promise<Response> {
  const { code, code_verifier, redirect_uri } = params;
  if (!code) return oauthError('invalid_request', 'code is required');
  if (!code_verifier) return oauthError('invalid_request', 'code_verifier is required (PKCE)');

  let payload;
  try {
    payload = verifyCode(code);
  } catch (err) {
    return oauthError(
      'invalid_grant',
      err instanceof Error ? err.message : 'code verification failed',
    );
  }

  if (redirect_uri && redirect_uri !== payload.redirect_uri) {
    return oauthError('invalid_grant', 'redirect_uri does not match authorization request');
  }
  if (!verifyPkce(code_verifier, payload.code_challenge, payload.code_challenge_method)) {
    return oauthError('invalid_grant', 'PKCE code_verifier does not match code_challenge');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn =
    payload.supabase_expires_at && payload.supabase_expires_at > now
      ? payload.supabase_expires_at - now
      : 3600;

  return new Response(
    JSON.stringify({
      access_token: payload.supabase_access_token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      refresh_token: payload.supabase_refresh_token,
      scope: 'mcp',
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } },
  );
}

async function refreshTokenGrant(params: Record<string, string>): Promise<Response> {
  const refreshToken = params.refresh_token;
  if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return oauthError(
      'server_error',
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
      500,
    );
  }

  const upstream = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: text.slice(0, 300) || 'supabase refresh failed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      },
    );
  }

  interface SupabaseRefreshResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  }
  const body = JSON.parse(text) as SupabaseRefreshResponse;

  return new Response(
    JSON.stringify({
      access_token: body.access_token,
      token_type: 'Bearer',
      expires_in: body.expires_in,
      refresh_token: body.refresh_token,
      scope: 'mcp',
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } },
  );
}
