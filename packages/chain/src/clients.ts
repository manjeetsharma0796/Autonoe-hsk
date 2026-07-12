import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MANTLE_SEPOLIA_CHAIN_ID, RPC_URL, EXPLORER_URL } from './network.js';

/** viem Chain for Mantle Sepolia (proper `defineChain` so client generics resolve). */
export const chain: Chain = defineChain({
  id: MANTLE_SEPOLIA_CHAIN_ID,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Mantlescan', url: EXPLORER_URL } },
  testnet: true,
});

export type PublicClientT = PublicClient;
export type WalletClientT = WalletClient<Transport, Chain, Account>;

/** Read-only client for the configured Mantle Sepolia RPC. */
export function getPublicClient(rpcUrl: string = RPC_URL): PublicClientT {
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

/** Wallet client bound to a viem Account (the agent wallet supplies this). */
export function getWalletClient(account: Account, rpcUrl: string = RPC_URL): WalletClientT {
  return createWalletClient({ account, chain, transport: http(rpcUrl) });
}

/** Convenience: derive an account from a raw private key (0x-prefixed or not). */
export function accountFromKey(key: string): Account {
  const k = key.startsWith('0x') ? key : `0x${key}`;
  return privateKeyToAccount(k as `0x${string}`);
}
