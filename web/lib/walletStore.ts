// Browser localStorage-backed WalletStore for the embedded agent wallet.
// Guards for SSR: all operations are no-ops when window is not defined.

import type { WalletStore } from '@autonoe/wallet';

const browserWalletStoreImpl: WalletStore = {
  async get(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
};

export const browserWalletStore: WalletStore = browserWalletStoreImpl;
