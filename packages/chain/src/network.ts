// HashKey Chain config. Single source of truth for chain id, RPC, native token,
// and explorer. Track A's viem clients import `hashkeyTestnet` and pass it
// straight to viem's createPublicClient/defineChain.

export const HASHKEY_TESTNET_CHAIN_ID = 133 as const;

export const RPC_URL =
  (typeof process !== 'undefined' && process.env?.HASHKEY_TESTNET_RPC) ||
  'https://testnet.hsk.xyz';

export const EXPLORER_URL = 'https://testnet-explorer.hsk.xyz';

export const FAUCET_URL = 'https://hsk.xyz/faucet';

/** Shape compatible with viem's `Chain` so it can be passed to viem directly. */
export const hashkeyTestnet = {
  id: HASHKEY_TESTNET_CHAIN_ID,
  name: 'HashKey Chain',
  nativeCurrency: { name: 'HashKey Platform Token', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: ['https://testnet.hsk.xyz'] },
  },
  blockExplorers: {
    default: { name: 'HashKey Explorer', url: EXPLORER_URL },
  },
  testnet: true,
} as const;

/** Build an explorer link for a tx hash. */
export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

/** Build an explorer link for an address. */
export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
