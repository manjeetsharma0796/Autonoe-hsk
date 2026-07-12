// Key-export helpers. Both require the wallet to already exist; exporting the
// raw private key additionally requires the passphrase (it unlocks first).

import { loadKeystore, unlock, type WalletStore } from './wallet.js';

/**
 * Decrypt and return the agent private key as a 0x-prefixed hex string.
 * Throws "Invalid passphrase" on a wrong passphrase.
 */
export async function exportPrivateKey(
  passphrase: string,
  store: WalletStore,
): Promise<string> {
  const { privateKey } = await unlock(passphrase, store);
  return privateKey;
}

/**
 * Return the encrypted keystore as a JSON string suitable for download/backup.
 * No passphrase needed — the contents stay encrypted at rest.
 */
export async function exportKeystoreJSON(store: WalletStore): Promise<string> {
  const ks = await loadKeystore(store);
  if (!ks) throw new Error('No agent wallet has been created');
  return JSON.stringify(ks, null, 2);
}
