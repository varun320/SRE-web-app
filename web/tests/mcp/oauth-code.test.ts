// Unit tests for the OAuth authorization-code signer.
//
// The code is HMAC-signed and self-contained (no DB) so we can round-trip it
// synchronously without any external services.

import { describe, expect, it, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';

beforeAll(() => {
  process.env.MCP_OAUTH_SECRET =
    'test-secret-that-is-at-least-thirty-two-chars-long';
});

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('oauth-code', () => {
  it('issues and verifies a code round-trip', async () => {
    const { issueCode, verifyCode } = await import('@/lib/expenses/mcp/oauth-code');
    const code = issueCode({
      sub: 'user-1',
      email: 'user@example.com',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: 'abc',
      code_challenge_method: 'S256',
      supabase_access_token: 'sb-access',
      supabase_refresh_token: 'sb-refresh',
      supabase_expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    const payload = verifyCode(code);
    expect(payload.sub).toBe('user-1');
    expect(payload.supabase_access_token).toBe('sb-access');
    expect(payload.supabase_refresh_token).toBe('sb-refresh');
  });

  it('rejects a code with a tampered signature', async () => {
    const { issueCode, verifyCode } = await import('@/lib/expenses/mcp/oauth-code');
    const code = issueCode({
      sub: 'u',
      email: null,
      redirect_uri: 'https://x/y',
      code_challenge: 'abc',
      code_challenge_method: 'S256',
      supabase_access_token: 'a',
      supabase_refresh_token: 'r',
      supabase_expires_at: null,
    });
    const [body] = code.split('.');
    const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(() => verifyCode(tampered)).toThrow(/signature/);
  });

  it('rejects a code with a mutated body', async () => {
    const { issueCode, verifyCode } = await import('@/lib/expenses/mcp/oauth-code');
    const code = issueCode({
      sub: 'u',
      email: null,
      redirect_uri: 'https://x/y',
      code_challenge: 'abc',
      code_challenge_method: 'S256',
      supabase_access_token: 'a',
      supabase_refresh_token: 'r',
      supabase_expires_at: null,
    });
    const parts = code.split('.');
    // Flip one char in the body — signature no longer matches.
    const mutated = parts[0].slice(0, -1) + (parts[0].slice(-1) === 'A' ? 'B' : 'A');
    expect(() => verifyCode(`${mutated}.${parts[1]}`)).toThrow(/signature/);
  });

  it('verifies PKCE S256', async () => {
    const { verifyPkce } = await import('@/lib/expenses/mcp/oauth-code');
    const verifier = 'test-verifier-abcdef1234567890abcdef1234567890abcdef';
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    expect(verifyPkce(verifier, challenge, 'S256')).toBe(true);
    expect(verifyPkce('wrong-verifier', challenge, 'S256')).toBe(false);
  });

  it('verifies PKCE plain', async () => {
    const { verifyPkce } = await import('@/lib/expenses/mcp/oauth-code');
    expect(verifyPkce('same', 'same', 'plain')).toBe(true);
    expect(verifyPkce('a', 'b', 'plain')).toBe(false);
  });
});
