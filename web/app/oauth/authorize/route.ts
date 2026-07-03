// RFC 6749 §3.1 Authorization Endpoint (with PKCE per RFC 7636).
//
// Claude opens this URL in the user's browser. If the user has a valid
// Supabase session cookie, we mint a signed authorization code that
// embeds their Supabase tokens and 302-redirect back to Claude's
// redirect_uri. If not, we bounce through /login first.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { issueCode } from '@/lib/expenses/mcp/oauth-code';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorRedirect(
  redirectUri: string | null,
  state: string | null,
  error: string,
  description: string,
): NextResponse {
  if (!redirectUri) {
    return NextResponse.json({ error, error_description: description }, { status: 400 });
  }
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return NextResponse.redirect(url.toString(), { status: 302 });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const responseType = p.get('response_type');
  const clientId = p.get('client_id');
  const redirectUri = p.get('redirect_uri');
  const codeChallenge = p.get('code_challenge');
  const codeChallengeMethod = p.get('code_challenge_method') ?? 'S256';
  const state = p.get('state');

  if (responseType !== 'code') {
    return errorRedirect(
      redirectUri,
      state,
      'unsupported_response_type',
      'only response_type=code is supported',
    );
  }
  if (!clientId) {
    return errorRedirect(redirectUri, state, 'invalid_request', 'client_id is required');
  }
  if (!redirectUri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'redirect_uri is required' },
      { status: 400 },
    );
  }
  if (!codeChallenge) {
    return errorRedirect(
      redirectUri,
      state,
      'invalid_request',
      'code_challenge is required (PKCE)',
    );
  }
  if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
    return errorRedirect(
      redirectUri,
      state,
      'invalid_request',
      'code_challenge_method must be S256 or plain',
    );
  }

  const sb = await getSupabaseServer();
  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session) {
    const next = `/oauth/authorize?${p.toString()}`;
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  const code = issueCode({
    sub: session.user.id,
    email: session.user.email ?? null,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod as 'S256' | 'plain',
    supabase_access_token: session.access_token,
    supabase_refresh_token: session.refresh_token,
    supabase_expires_at: session.expires_at ?? null,
  });

  const back = new URL(redirectUri);
  back.searchParams.set('code', code);
  if (state) back.searchParams.set('state', state);
  return NextResponse.redirect(back.toString(), { status: 302 });
}
