// Signed-pull price oracle endpoint (T-210, PRD §8). The server signs a live
// market price so SyntheticExchange can verify it on-chain. The signing key is
// the oracle's trusted signer (ORACLE_SIGNER_PRIVATE_KEY, falling back to the
// deployer key which is the on-chain signer in the current deploy).

import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodeAbiParameters, parseUnits } from 'viem';
import addresses from '@autonoe/chain/addresses.json';

type SignerAccount = ReturnType<typeof privateKeyToAccount>;

const BYBIT_BASE = process.env.BYBIT_BASE ?? 'https://api.bybit.com';

// WMNT trades MNT under the hood; everything else maps to <SYMBOL>USDT spot.
const SYMBOL_OVERRIDE: Record<string, string> = { WMNT: 'MNTUSDT' };
function bybitSymbol(sym: string): string {
  return SYMBOL_OVERRIDE[sym] ?? `${sym.toUpperCase()}USDT`;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
const defaultFetch: FetchLike = (url) => fetch(url);

let cachedAccount: SignerAccount | null = null;
function signer(): SignerAccount {
  if (cachedAccount) return cachedAccount;
  const raw = process.env.ORACLE_SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw) throw Object.assign(new Error('oracle signer key not configured'), { status: 503 });
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  cachedAccount = privateKeyToAccount(key as `0x${string}`);
  return cachedAccount;
}

/** Address that signs attestations - must equal PriceOracle.trustedSigner on-chain. */
export function oracleSignerAddress(): string {
  return signer().address;
}

/** Live spot price (USD) for a symbol from Bybit public tickers. */
export async function getSpotPriceUsd(symbol: string, f: FetchLike = defaultFetch): Promise<number> {
  const url = `${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${bybitSymbol(symbol)}`;
  const res = await f(url);
  if (!res.ok) throw Object.assign(new Error(`bybit ${res.status}`), { status: 502 });
  const json = (await res.json()) as { result?: { list?: Array<{ lastPrice?: string }> } };
  const last = json.result?.list?.[0]?.lastPrice;
  if (last === undefined) throw Object.assign(new Error(`price unavailable for ${symbol}`), { status: 502 });
  return Number(last);
}

export interface SignedPrice {
  symbol: string;
  price: number;
  priceX18: string;
  timestamp: number;
  signature: `0x${string}`;
  signer: string;
}

/** Fetch the live price and return a signed attestation for SyntheticExchange. */
export async function signPrice(symbol: string, f: FetchLike = defaultFetch): Promise<SignedPrice> {
  const account = signer();
  const price = await getSpotPriceUsd(symbol, f);
  const priceX18 = parseUnits(price.toString(), 18);
  const timestamp = Math.floor(Date.now() / 1000);
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'string' }, { type: 'uint256' }, { type: 'uint256' }],
      [BigInt(addresses.chainId), addresses.oracle as `0x${string}`, symbol, priceX18, BigInt(timestamp)]
    )
  );
  const signature = await account.signMessage({ message: { raw: inner } });
  return { symbol, price, priceX18: priceX18.toString(), timestamp, signature, signer: account.address };
}
