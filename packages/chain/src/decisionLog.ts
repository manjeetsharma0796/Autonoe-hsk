import { parseEventLogs } from 'viem';
import { readContract, writeContract, simulateContract, waitForTransactionReceipt } from 'viem/actions';
import { decisionLogAbi } from './abis.js';
import { addresses } from './addresses.js';
import { txUrl } from './network.js';
import type { PublicClientT, WalletClientT } from './clients.js';

export interface DecisionInput {
  thesisHash: `0x${string}`;
  verdictHash: `0x${string}`;
  asset: string;
  amountIn: bigint;
  amountOut: bigint;
  pnl: bigint; // signed
  optionRef: string;
}

export interface DecisionRecord extends DecisionInput {
  id: number;
  user: `0x${string}`;
  timestamp: number;
}

/** Write a decision + outcome to the on-chain benchmark. */
export async function writeDecision(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  d: DecisionInput
): Promise<{ id: bigint; txHash: `0x${string}`; explorerUrl: string }> {
  const { request } = await simulateContract(publicClient, {
    account: walletClient.account,
    address: addresses.decisionLog,
    abi: decisionLogAbi,
    functionName: 'logDecision',
    args: [d.thesisHash, d.verdictHash, d.asset, d.amountIn, d.amountOut, d.pnl, d.optionRef],
  });
  const hash = await writeContract(walletClient, request);
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== 'success') throw new Error(`logDecision reverted: ${txUrl(hash)}`);
  // Authoritative id from the emitted event (a post-tx length read can hit a
  // stale RPC node and return the wrong index).
  const events = parseEventLogs({ abi: decisionLogAbi, eventName: 'DecisionLogged', logs: receipt.logs });
  const id = events[0]?.args.id ?? -1n;
  return { id, txHash: hash, explorerUrl: txUrl(hash) };
}

/** Read one decision by id. */
export async function readDecision(publicClient: PublicClientT, id: number): Promise<DecisionRecord> {
  const r = await readContract(publicClient, {
    address: addresses.decisionLog,
    abi: decisionLogAbi,
    functionName: 'getDecision',
    args: [BigInt(id)],
  });
  return {
    id,
    user: r.user,
    thesisHash: r.thesisHash,
    verdictHash: r.verdictHash,
    asset: r.asset,
    amountIn: r.amountIn,
    amountOut: r.amountOut,
    pnl: r.pnl,
    optionRef: r.optionRef,
    timestamp: Number(r.timestamp),
  };
}

/** Read a user's full decision history (or all decisions if no user given). */
export async function readHistory(
  publicClient: PublicClientT,
  user?: `0x${string}`
): Promise<DecisionRecord[]> {
  let ids: number[];
  if (user) {
    const raw = await readContract(publicClient, {
      address: addresses.decisionLog,
      abi: decisionLogAbi,
      functionName: 'getUserDecisions',
      args: [user],
    });
    ids = raw.map(Number);
  } else {
    const len = await readContract(publicClient, {
      address: addresses.decisionLog,
      abi: decisionLogAbi,
      functionName: 'decisionsLength',
    });
    ids = Array.from({ length: Number(len) }, (_, i) => i);
  }
  return Promise.all(ids.map((id) => readDecision(publicClient, id)));
}
