import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_POLICY,
  checkPolicy,
  enforcePolicy,
  getPolicy,
  setPolicy,
  type SpendingPolicy,
} from '../src/policy.ts';
import { memoryStore } from '../src/wallet.ts';

const policy: SpendingPolicy = {
  maxTradeMUSD: 500,
  allowedTokens: ['WHSK', 'BTC'],
};

describe('spending policy', () => {
  test('allows an in-bounds trade', () => {
    const r = checkPolicy(policy, { token: 'WHSK', amountMUSD: 100 });
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  test('denies a trade over the limit', () => {
    const r = checkPolicy(policy, { token: 'WHSK', amountMUSD: 600 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('exceeds');
  });

  test('denies a disallowed token', () => {
    const r = checkPolicy(policy, { token: 'ETH', amountMUSD: 10 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('allow-list');
  });

  test('denies non-positive amounts', () => {
    expect(checkPolicy(policy, { token: 'WHSK', amountMUSD: 0 }).ok).toBe(false);
    expect(checkPolicy(policy, { token: 'WHSK', amountMUSD: -5 }).ok).toBe(false);
  });

  test('enforcePolicy throws on violation, passes when ok', () => {
    expect(() => enforcePolicy(policy, { token: 'WHSK', amountMUSD: 100 })).not.toThrow();
    expect(() => enforcePolicy(policy, { token: 'WHSK', amountMUSD: 9999 })).toThrow();
  });

  test('getPolicy returns the default when nothing persisted', async () => {
    const store = memoryStore();
    const p = await getPolicy(store);
    expect(p).toEqual(DEFAULT_POLICY);
  });

  test('setPolicy then getPolicy round-trips', async () => {
    const store = memoryStore();
    await setPolicy(store, policy);
    const p = await getPolicy(store);
    expect(p).toEqual(policy);
  });
});
