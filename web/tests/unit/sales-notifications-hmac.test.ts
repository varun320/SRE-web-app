import { describe, it, expect } from 'vitest';
import { signBody, verifySignature } from '@/features/sales/notifications/hmac';

describe('sales notifications HMAC verifier', () => {
  const secret = 'test-secret-123';
  const body = JSON.stringify({
    engineerId: 'u1',
    category: 'follow_up_due',
    opportunityId: 'opp_1',
    title: 'Follow up',
  });

  it('accepts a signature produced with the shared secret', () => {
    const sig = signBody(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it('rejects tampered bodies', () => {
    const sig = signBody(body, secret);
    expect(verifySignature(body + ' ', sig, secret)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const sig = signBody(body, 'other-secret');
    expect(verifySignature(body, sig, secret)).toBe(false);
  });

  it('rejects missing signature', () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, '', secret)).toBe(false);
  });

  it('rejects malformed signature length', () => {
    expect(verifySignature(body, 'abc', secret)).toBe(false);
  });
});
