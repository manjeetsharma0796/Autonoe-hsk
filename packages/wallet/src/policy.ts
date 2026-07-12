// Spending policy for the embedded agent wallet. The agent may only execute
// trades that satisfy this policy; the UI lets the user tune it and it is
// persisted alongside the keystore.

import type { WalletStore } from './wallet.js';

export const POLICY_KEY = 'autonoe.wallet.policy';

export interface SpendingPolicy {
  /** Hard cap on a single trade, denominated in mUSD. */
  maxTradeMUSD: number;
  /** Token symbols/addresses the agent is allowed to trade. */
  allowedTokens: string[];
}

export interface PolicyCheckInput {
  token: string;
  amountMUSD: number;
}

export interface PolicyCheckResult {
  ok: boolean;
  reason?: string;
}

/** Conservative default: small per-trade cap, only the seeded mock assets. */
export const DEFAULT_POLICY: SpendingPolicy = {
  maxTradeMUSD: 1_000,
  allowedTokens: ['WHSK', 'BTC', 'ETH', 'SUI', 'SOL'],
};

/** Pure check: does this trade satisfy the policy? */
export function checkPolicy(
  policy: SpendingPolicy,
  input: PolicyCheckInput,
): PolicyCheckResult {
  const { token, amountMUSD } = input;

  if (!Number.isFinite(amountMUSD) || amountMUSD <= 0) {
    return { ok: false, reason: 'Trade amount must be a positive number' };
  }
  if (amountMUSD > policy.maxTradeMUSD) {
    return {
      ok: false,
      reason: `Trade size ${amountMUSD} mUSD exceeds limit of ${policy.maxTradeMUSD} mUSD`,
    };
  }
  if (!policy.allowedTokens.includes(token)) {
    return { ok: false, reason: `Token "${token}" is not in the allow-list` };
  }
  return { ok: true };
}

/** Like {@link checkPolicy} but throws on violation. */
export function enforcePolicy(policy: SpendingPolicy, input: PolicyCheckInput): void {
  const result = checkPolicy(policy, input);
  if (!result.ok) {
    throw new Error(result.reason ?? 'Trade violates spending policy');
  }
}

/** Load the persisted policy, falling back to {@link DEFAULT_POLICY}. */
export async function getPolicy(store: WalletStore): Promise<SpendingPolicy> {
  const raw = await store.get(POLICY_KEY);
  if (!raw) return { ...DEFAULT_POLICY, allowedTokens: [...DEFAULT_POLICY.allowedTokens] };
  return JSON.parse(raw) as SpendingPolicy;
}

/** Persist a policy as JSON. */
export async function setPolicy(
  store: WalletStore,
  policy: SpendingPolicy,
): Promise<void> {
  await store.set(POLICY_KEY, JSON.stringify(policy));
}
