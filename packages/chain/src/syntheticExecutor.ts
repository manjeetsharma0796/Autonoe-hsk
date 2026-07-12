import { encodeAbiParameters, keccak256, parseEventLogs, parseUnits, type Account } from 'viem';
import { readContract, writeContract, simulateContract, waitForTransactionReceipt } from 'viem/actions';
import { erc20Abi, oracleAbi, syntheticAbi } from './abis.js';
import { MAX_UINT256, waitForAllowance } from './allowance.js';
import { addresses } from './addresses.js';
import { txUrl } from './network.js';
import type { PublicClientT, WalletClientT } from './clients.js';

/** Server-signed price attestation consumed by SyntheticExchange (PRD §8). */
export interface PriceAttestation {
  symbol: string;
  priceX18: bigint;
  timestamp: number;
  signature: `0x${string}`;
}

/** Convert a human price (mUSD per 1 unit of asset) to the 1e18-scaled oracle value. */
export function priceToX18(price: number | string): bigint {
  return parseUnits(typeof price === 'number' ? price.toString() : price, 18);
}

/**
 * Produce a price attestation the `account` (oracle's trusted signer) signs.
 * Mirrors PriceOracle.priceDigest. The backend (T-210) calls this with its key;
 * tests call it with the deployer key (which is the on-chain signer).
 */
export async function signPriceAttestation(
  account: Account,
  params: { symbol: string; priceX18: bigint; timestamp: number; oracle?: `0x${string}`; chainId?: number }
): Promise<PriceAttestation> {
  const oracle = params.oracle ?? addresses.oracle;
  const chainId = BigInt(params.chainId ?? addresses.chainId);
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'string' }, { type: 'uint256' }, { type: 'uint256' }],
      [chainId, oracle, params.symbol, params.priceX18, BigInt(params.timestamp)]
    )
  );
  if (!account.signMessage) throw new Error('account cannot sign messages');
  const signature = await account.signMessage({ message: { raw: inner } });
  return { symbol: params.symbol, priceX18: params.priceX18, timestamp: params.timestamp, signature };
}

export interface OpenResult {
  id: bigint;
  txHash: `0x${string}`;
  explorerUrl: string;
}
export interface CloseResult {
  pnl: bigint;
  payout: bigint;
  txHash: `0x${string}`;
  explorerUrl: string;
}

async function ensureAllowance(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  owner: `0x${string}`,
  amount: bigint
): Promise<void> {
  const read = () =>
    readContract(publicClient, {
      address: addresses.mUSD,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, addresses.syntheticExchange],
    });
  if ((await read()) >= amount) return;
  const hash = await writeContract(walletClient, {
    address: addresses.mUSD,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.syntheticExchange, MAX_UINT256], // sticky: avoids re-approve every trade
  });
  await waitForTransactionReceipt(publicClient, { hash });
  await waitForAllowance(read, amount); // defeat read-after-write RPC staleness
}

/** Open a synthetic position (long/short) settled in mUSD against the oracle. */
export async function openSynthetic(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  params: { isLong: boolean; sizeMUSD: bigint; attestation: PriceAttestation }
): Promise<OpenResult> {
  await ensureAllowance(walletClient, publicClient, walletClient.account.address, params.sizeMUSD);

  const { request } = await simulateContract(publicClient, {
    account: walletClient.account,
    address: addresses.syntheticExchange,
    abi: syntheticAbi,
    functionName: 'openPosition',
    args: [
      params.attestation.symbol,
      params.isLong,
      params.sizeMUSD,
      params.attestation.priceX18,
      BigInt(params.attestation.timestamp),
      params.attestation.signature,
    ],
  });
  const hash = await writeContract(walletClient, request);
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== 'success') throw new Error(`openPosition reverted: ${txUrl(hash)}`);
  // Authoritative id from the PositionOpened event (avoids stale read-after-write).
  const events = parseEventLogs({ abi: syntheticAbi, eventName: 'PositionOpened', logs: receipt.logs });
  const id = events[0]?.args.id ?? -1n;
  return { id, txHash: hash, explorerUrl: txUrl(hash) };
}

/** Close a position; returns realized pnl + payout (both mUSD base units). */
export async function closeSynthetic(
  walletClient: WalletClientT,
  publicClient: PublicClientT,
  params: { id: bigint; attestation: PriceAttestation }
): Promise<CloseResult> {
  const { request, result } = await simulateContract(publicClient, {
    account: walletClient.account,
    address: addresses.syntheticExchange,
    abi: syntheticAbi,
    functionName: 'closePosition',
    args: [
      params.id,
      params.attestation.priceX18,
      BigInt(params.attestation.timestamp),
      params.attestation.signature,
    ],
  });
  const [pnl, payout] = result;
  const hash = await writeContract(walletClient, request);
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== 'success') throw new Error(`closePosition reverted: ${txUrl(hash)}`);
  return { pnl, payout, txHash: hash, explorerUrl: txUrl(hash) };
}

export interface SyntheticPosition {
  trader: `0x${string}`;
  symbol: string;
  isLong: boolean;
  sizeMUSD: bigint;
  entryPriceX18: bigint;
  open: boolean;
}

/** Read a position by id (authoritative on-chain symbol/side/size). */
export async function readPosition(publicClient: PublicClientT, id: bigint): Promise<SyntheticPosition> {
  const p = await readContract(publicClient, {
    address: addresses.syntheticExchange,
    abi: syntheticAbi,
    functionName: 'getPosition',
    args: [id],
  });
  return p as SyntheticPosition;
}

/** House reserve (mUSD held by the exchange). */
export async function getSyntheticReserve(publicClient: PublicClientT): Promise<bigint> {
  return readContract(publicClient, {
    address: addresses.syntheticExchange,
    abi: syntheticAbi,
    functionName: 'reserve',
  });
}

/** Oracle config (the trusted signer + freshness window). */
export async function getOracleConfig(
  publicClient: PublicClientT
): Promise<{ trustedSigner: `0x${string}`; maxAge: bigint }> {
  const [trustedSigner, maxAge] = await Promise.all([
    readContract(publicClient, { address: addresses.oracle, abi: oracleAbi, functionName: 'trustedSigner' }),
    readContract(publicClient, { address: addresses.oracle, abi: oracleAbi, functionName: 'maxAge' }),
  ]);
  return { trustedSigner, maxAge };
}
