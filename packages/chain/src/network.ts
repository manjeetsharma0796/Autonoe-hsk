// Mantle Sepolia testnet config (verified June 2026). Single source of truth
// for chain id, RPC, native token, and explorer. Track A's viem clients import
// `mantleSepolia` and pass it straight to viem's createPublicClient/defineChain.

export const MANTLE_SEPOLIA_CHAIN_ID = 5003 as const;

export const RPC_URL =
  (typeof process !== 'undefined' && process.env?.MANTLE_SEPOLIA_RPC) ||
  'https://rpc.sepolia.mantle.xyz';

export const EXPLORER_URL = 'https://sepolia.mantlescan.xyz';

export const FAUCET_URL = 'https://faucet.sepolia.mantle.xyz/';

/** Shape compatible with viem's `Chain` so it can be passed to viem directly. */
export const mantleSepolia = {
  id: MANTLE_SEPOLIA_CHAIN_ID,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantlescan', url: EXPLORER_URL },
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
