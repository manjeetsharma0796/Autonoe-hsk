// Agent-sign + execute (T-304). Given a chosen option, the agent wallet signs
// and submits a REAL trade on Mantle Sepolia, then records the decision on-chain.
// Hybrid routing: WMNT settles via the AMM; every other asset is an oracle-priced
// synthetic position. Execution is manual-confirm — the UI confirms before calling.

import { type Hex, parseUnits } from 'viem';
import {
  getPublicClient,
  getWalletClient,
  accountFromKey,
  addresses,
  swap,
  openSynthetic,
  closeSynthetic,
  readPosition,
  writeDecision,
  type PriceAttestation,
} from '@autonoe/chain';
import { checkPolicy, type SpendingPolicy } from './policy.js';

export type Direction = 'long' | 'short' | 'hedge' | 'hold';

export interface ExecuteOptionInput {
  /** Agent private key (from `unlock`). Held only for the duration of the call. */
  privateKey: Hex;
  direction: Direction;
  asset: string; // 'WMNT' (AMM) | 'BTC' | 'ETH' | 'SUI' | 'SOL' (synthetic)
  sizeMUSD: number; // human mUSD
  thesisHash: Hex;
  verdictHash: Hex;
  optionRef: string;
  /** Enforced before signing (manual-confirm happens in the UI first). */
  policy: SpendingPolicy;
  /** Base URL for the server's /api/price/sign (default '' = same origin). */
  apiBase?: string;
  slippageBps?: number;
  rpcUrl?: string;
}

export interface ExecuteResult {
  kind: 'amm' | 'synthetic';
  txHash: Hex;
  explorerUrl: string;
  amountInMUSD: number;
  /** AMM: WMNT out (18dec base units). Synthetic: collateral (mUSD base units). */
  amountOut: string;
  positionId?: string;
  /** null if the trade committed but the on-chain DecisionLog write failed (see logError). */
  decision: { id: string; txHash: Hex; explorerUrl: string } | null;
  /** Set iff logging failed AFTER a committed trade — the UI must NOT retry the trade. */
  logError?: string;
}

interface SignedPriceResponse {
  symbol: string;
  priceX18: string;
  timestamp: number;
  signature: Hex;
}

async function fetchAttestation(apiBase: string, symbol: string): Promise<PriceAttestation> {
  const res = await fetch(`${apiBase}/api/price/sign?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`price-sign failed (${res.status}) for ${symbol}`);
  const j = (await res.json()) as SignedPriceResponse;
  // Defense in depth: never let the server quietly swap the symbol under us.
  if (j.symbol !== symbol) throw new Error(`oracle returned ${j.symbol}, expected ${symbol}`);
  return {
    symbol: j.symbol,
    priceX18: BigInt(j.priceX18),
    timestamp: j.timestamp,
    signature: j.signature,
  };
}

/** Execute a chosen option: real AMM swap (WMNT) or open a synthetic (others). */
export async function executeOption(input: ExecuteOptionInput): Promise<ExecuteResult> {
  if (input.direction === 'hold') throw new Error('Cannot execute a "hold" option');

  // Policy gate — hard cap + allow-list, enforced before any signature.
  const check = checkPolicy(input.policy, { token: input.asset, amountMUSD: input.sizeMUSD });
  if (!check.ok) throw new Error(check.reason ?? 'Trade violates spending policy');

  const account = accountFromKey(input.privateKey);
  const publicClient = getPublicClient(input.rpcUrl);
  const walletClient = getWalletClient(account, input.rpcUrl);
  const sizeUnits = parseUnits(input.sizeMUSD.toString(), 6);
  const apiBase = input.apiBase ?? '';

  let kind: 'amm' | 'synthetic';
  let txHash: Hex;
  let explorerUrl: string;
  let amountOut: string;
  let amountInUnits = sizeUnits;
  let positionId: string | undefined;

  if (input.asset === 'WMNT') {
    kind = 'amm';
    const r = await swap(walletClient, publicClient, {
      tokenIn: addresses.mUSD,
      tokenOut: addresses.WMNT,
      amountIn: sizeUnits,
      slippageBps: input.slippageBps,
    });
    txHash = r.txHash;
    explorerUrl = r.explorerUrl;
    amountOut = r.amountOut;
    amountInUnits = BigInt(r.amountIn);
  } else {
    kind = 'synthetic';
    const isLong = input.direction === 'long'; // short + hedge → short side
    const attestation = await fetchAttestation(apiBase, input.asset);
    const o = await openSynthetic(walletClient, publicClient, { isLong, sizeMUSD: sizeUnits, attestation });
    txHash = o.txHash;
    explorerUrl = o.explorerUrl;
    amountOut = sizeUnits.toString();
    positionId = o.id.toString();
  }

  // Record the decision on-chain (entry; realized pnl is logged on close). The
  // trade is ALREADY committed — if logging fails we must NOT throw, or the caller
  // would retry and double-trade. Surface the failure via logError instead.
  let decision: ExecuteResult['decision'] = null;
  let logError: string | undefined;
  try {
    const d = await writeDecision(walletClient, publicClient, {
      thesisHash: input.thesisHash,
      verdictHash: input.verdictHash,
      asset: input.asset,
      amountIn: amountInUnits,
      amountOut: BigInt(amountOut),
      pnl: 0n,
      optionRef: input.optionRef,
    });
    decision = { id: d.id.toString(), txHash: d.txHash, explorerUrl: d.explorerUrl };
  } catch (e) {
    logError = e instanceof Error ? e.message : String(e);
  }

  return {
    kind,
    txHash,
    explorerUrl,
    amountInMUSD: input.sizeMUSD,
    amountOut,
    positionId,
    decision,
    logError,
  };
}

export interface CloseSyntheticInput {
  privateKey: Hex;
  positionId: bigint | string;
  /** Optional expected asset; asserted against the on-chain position if provided. */
  asset?: string;
  thesisHash: Hex;
  verdictHash: Hex;
  optionRef: string;
  apiBase?: string;
  rpcUrl?: string;
}

export interface CloseResult {
  /** Authoritative on-chain symbol of the closed position. */
  symbol: string;
  pnlMUSD: number;
  payoutMUSD: number;
  txHash: Hex;
  explorerUrl: string;
  decision: { id: string; txHash: Hex; explorerUrl: string } | null;
  logError?: string;
}

/** Close a synthetic position, realizing PnL, and log the realized outcome. */
export async function closeSyntheticPosition(input: CloseSyntheticInput): Promise<CloseResult> {
  const account = accountFromKey(input.privateKey);
  const publicClient = getPublicClient(input.rpcUrl);
  const walletClient = getWalletClient(account, input.rpcUrl);
  const positionId = BigInt(input.positionId);

  // Use the AUTHORITATIVE on-chain symbol — the contract verifies the attestation
  // against the stored position symbol, and the benchmark must log that same asset.
  const position = await readPosition(publicClient, positionId);
  if (!position.open) throw new Error('position is already closed');
  const symbol = position.symbol;
  if (input.asset && input.asset !== symbol) {
    throw new Error(`position ${input.positionId} is ${symbol}, not ${input.asset}`);
  }

  const attestation = await fetchAttestation(input.apiBase ?? '', symbol);
  const c = await closeSynthetic(walletClient, publicClient, { id: positionId, attestation });

  // Trade is committed — log non-throwingly (see executeOption rationale).
  let decision: CloseResult['decision'] = null;
  let logError: string | undefined;
  try {
    const d = await writeDecision(walletClient, publicClient, {
      thesisHash: input.thesisHash,
      verdictHash: input.verdictHash,
      asset: symbol,
      amountIn: 0n,
      amountOut: c.payout,
      pnl: c.pnl,
      optionRef: input.optionRef,
    });
    decision = { id: d.id.toString(), txHash: d.txHash, explorerUrl: d.explorerUrl };
  } catch (e) {
    logError = e instanceof Error ? e.message : String(e);
  }

  return {
    symbol,
    pnlMUSD: Number(c.pnl) / 1e6,
    payoutMUSD: Number(c.payout) / 1e6,
    txHash: c.txHash,
    explorerUrl: c.explorerUrl,
    decision,
    logError,
  };
}
