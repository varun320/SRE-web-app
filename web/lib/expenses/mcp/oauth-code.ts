// Signed, self-contained authorization codes for the MCP OAuth flow.
//
// We're stateless (Vercel serverless functions), so we don't store codes in a
// database. Instead we HMAC-sign a JSON payload that carries everything the
// /oauth/token endpoint needs: the Supabase session tokens (which become the
// returned access/refresh tokens), the PKCE code_challenge to verify against,
// the redirect_uri, and a short expiry.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const CODE_TTL_SECONDS = 10 * 60; // 10 minutes — plenty for a browser round-trip.

export interface OAuthCodePayload {
  sub: string;
  email: string | null;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: 'S256' | 'plain';
  supabase_access_token: string;
  supabase_refresh_token: string;
  supabase_expires_at: number | null;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function getSecret(): Buffer {
  const secret = process.env.MCP_OAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'MCP_OAUTH_SECRET must be set to at least 32 characters for the OAuth code signer',
    );
  }
  return Buffer.from(secret, 'utf8');
}

export function issueCode(
  payload: Omit<OAuthCodePayload, 'iat' | 'exp'>,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: OAuthCodePayload = { ...payload, iat: now, exp: now + CODE_TTL_SECONDS };
  const body = b64url(JSON.stringify(full));
  const sig = b64url(createHmac('sha256', getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyCode(code: string): OAuthCodePayload {
  const parts = code.split('.');
  if (parts.length !== 2) throw new Error('malformed code');
  const [body, sig] = parts;
  const expected = b64url(createHmac('sha256', getSecret()).update(body).digest());
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('code signature invalid');
  const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as OAuthCodePayload;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('code expired');
  return payload;
}

export function verifyPkce(
  verifier: string,
  challenge: string,
  method: 'S256' | 'plain',
): boolean {
  if (method === 'plain') return verifier === challenge;
  const hash = createHash('sha256').update(verifier).digest();
  return b64url(hash) === challenge;
}
