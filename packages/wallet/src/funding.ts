// Funding helpers (T-305): read agent balances, mint mUSD via the token faucet,
// and surface the native MNT faucet link. The agent needs a little MNT for gas
// before it can call the mUSD faucet — see MNT_FAUCET_URL.

import { type Hex } from 'viem';
import { getBalance, readContract, writeContract, waitForTransactionReceipt } from 'viem/actions';
import {
  getPublicClient,
  getWalletClient,
  accountFromKey,
  addresses,
  musdAbi,
  erc20Abi,
  FAUCET_URL,
  txUrl,
} from '@autonoe/chain';

/** Native MNT faucet (gas) — surfaced in the wallet drawer. */
export const MNT_FAUCET_URL = FAUCET_URL;

export interface AgentBalances {
  /** Native MNT (gas), 18dec base units. */
  mnt: bigint;
  /** mUSD, 6dec base units. */
  mUSD: bigint;
  /** WMNT, 18dec base units. */
  wmnt: bigint;
}

export async function getAgentBalances(address: `0x${string}`, rpcUrl?: string): Promise<AgentBalances> {
  const pc = getPublicClient(rpcUrl);
  const [mnt, mUSD, wmnt] = await Promise.all([
    getBalance(pc, { address }),
    readContract(pc, { address: addresses.mUSD, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    readContract(pc, { address: addresses.WMNT, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
  ]);
  return { mnt, mUSD, wmnt };
}

/** Mint mUSD to the agent via the token faucet (cooldown + cap enforced on-chain). */
export async function fundMUSD(privateKey: Hex, rpcUrl?: string): Promise<{ txHash: Hex; explorerUrl: string }> {
  const account = accountFromKey(privateKey);
  const pc = getPublicClient(rpcUrl);
  const wc = getWalletClient(account, rpcUrl);
  const hash = await writeContract(wc, {
    address: addresses.mUSD,
    abi: musdAbi,
    functionName: 'faucet',
    args: [],
  });
  const r = await waitForTransactionReceipt(pc, { hash });
  if (r.status !== 'success') throw new Error(`mUSD faucet reverted: ${txUrl(hash)}`);
  return { txHash: hash, explorerUrl: txUrl(hash) };
}
