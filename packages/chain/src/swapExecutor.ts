import { readContract, writeContract, waitForTransactionReceipt } from 'viem/actions';
import type { SwapResult } from '@autonoe/shared';
import { erc20Abi, routerAbi } from './abis.js';
import { MAX_UINT256, waitForAllowance } from './allowance.js';
import { addresses } from './addresses.js';
import { txUrl } from './network.js';
import type { PublicClientT, WalletClientT } from './clients.js';

const DEADLINE_SECONDS = 1200;

export interface SwapParams {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  /** Slippage tolerance in basis points (e.g. 50 = 0.50%). */
  slippageBps?: number;
}

/** Quote `amountOut` for a single-hop swap through the AMM router (read-only). */
export async function getQuote(
  publicClient: PublicClientT,
  params: Pick<SwapParams, 'tokenIn' | 'tokenOut' | 'amountIn'>
): Promise<bigint> {
  const amounts = await readContract(publicClient, {
    address: addresses.router,
    abi: routerAbi,
    functionName: 'getAmountsOut',
    args: [params.amountIn, [params.tokenIn, params.tokenOut]],
  });
  const out = amounts[amounts.length - 1];
  if (out === undefined) throw new Error('router returned empty amounts');
  return out;
}

async function ensureAllowance(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint
): Promise<void> {
  const read = () =>
    readContract(publicClient, {
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
  if ((await read()) >= amount) return;
  const hash = await writeContract(walletClient, {
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, MAX_UINT256], // sticky approve
  });
  await waitForTransactionReceipt(publicClient, { hash });
  await waitForAllowance(read, amount); // defeat read-after-write RPC staleness
}

/** Approve (if needed) + execute a real swap on the AMM, returning a SwapResult. */
export async function swap(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  params: SwapParams
): Promise<SwapResult> {
  const to = walletClient.account.address;
  const slippageBps = params.slippageBps ?? 50;

  const expectedOut = await getQuote(publicClient, params);
  if (expectedOut === 0n) throw new Error('swap quote is zero (no liquidity?)');
  const amountOutMin = (expectedOut * BigInt(10_000 - slippageBps)) / 10_000n;

  await ensureAllowance(walletClient, publicClient, params.tokenIn, to, addresses.router, params.amountIn);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
  const hash = await writeContract(walletClient, {
    address: addresses.router,
    abi: routerAbi,
    functionName: 'swapExactTokensForTokens',
    args: [params.amountIn, amountOutMin, [params.tokenIn, params.tokenOut], to, deadline],
  });
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== 'success') throw new Error(`swap reverted: ${txUrl(hash)}`);

  // For a single-hop V2 swap with no concurrent trades, the realized out equals
  // the pre-trade quote (avoids racing a stale read-after-write RPC node).
  return {
    txHash: hash,
    amountIn: params.amountIn.toString(),
    amountOut: expectedOut.toString(),
    explorerUrl: txUrl(hash),
  };
}
