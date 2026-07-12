// Embedded agent wallet core: dedicated agent EOA whose private key is
// encrypted at rest with a user passphrase (PBKDF2 -> AES-GCM via WebCrypto).
//
// The keystore is a plain, serializable object so it can be persisted in any
// async key/value store (IndexedDB, localStorage, server KV, …). Real browser
// adapters land later; for now an in-memory store keeps this testable under bun.

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';

/** Storage key under which the encrypted keystore JSON is persisted. */
export const KEYSTORE_KEY = 'autonoe.wallet.keystore';

/** PBKDF2 iteration count. Kept well above the recommended floor. */
const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Serializable, at-rest representation of the encrypted agent key. */
export interface Keystore {
  /** Public address of the agent EOA (not secret). */
  address: Address;
  /** PBKDF2 salt, base64. */
  salt: string;
  /** AES-GCM IV/nonce, base64. */
  iv: string;
  /** AES-GCM ciphertext of the private key, base64. */
  ciphertext: string;
}

/**
 * Injectable async storage. Implementations may be backed by IndexedDB,
 * localStorage, or anything else; the wallet core only needs get/set.
 */
export interface WalletStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** In-memory {@link WalletStore} for tests and ephemeral usage. */
export function memoryStore(): WalletStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

// ── base64 helpers (no Node Buffer dependency) ───────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error('WebCrypto (globalThis.crypto.subtle) is not available');
  }
  return c.subtle;
}

/** Derive an AES-GCM key from a passphrase + salt via PBKDF2-SHA-256. */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await subtle().importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPrivateKey(
  passphrase: string,
  address: Address,
  privateKey: Hex,
): Promise<Keystore> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKey),
  );
  return {
    address,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptPrivateKey(passphrase: string, ks: Keystore): Promise<Hex> {
  const salt = fromBase64(ks.salt);
  const iv = fromBase64(ks.iv);
  const ciphertext = fromBase64(ks.ciphertext);
  const key = await deriveKey(passphrase, salt);
  let plain: ArrayBuffer;
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
  } catch {
    // AES-GCM auth tag mismatch => wrong passphrase (or tampered keystore).
    throw new Error('Invalid passphrase');
  }
  return dec.decode(plain) as Hex;
}

// ── persistence ──────────────────────────────────────────────────────────────

/** Load the persisted keystore, or null if no wallet has been created. */
export async function loadKeystore(store: WalletStore): Promise<Keystore | null> {
  const raw = await store.get(KEYSTORE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Keystore;
}

async function saveKeystore(store: WalletStore, ks: Keystore): Promise<void> {
  await store.set(KEYSTORE_KEY, JSON.stringify(ks));
}

// ── public API ───────────────────────────────────────────────────────────────

/** True once an agent wallet keystore exists in the store. */
export async function isCreated(store: WalletStore): Promise<boolean> {
  return (await loadKeystore(store)) !== null;
}

/**
 * Generate a fresh agent EOA, encrypt its private key with `passphrase`, and
 * persist the keystore. Returns the public address. The plaintext key never
 * leaves this function.
 */
export async function createAgentWallet(
  passphrase: string,
  store: WalletStore,
): Promise<{ address: Address }> {
  if (!passphrase) throw new Error('A passphrase is required');
  if (await isCreated(store)) {
    throw new Error('An agent wallet already exists');
  }
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const ks = await encryptPrivateKey(passphrase, account.address, privateKey);
  await saveKeystore(store, ks);
  return { address: account.address };
}

/**
 * Decrypt the agent private key with `passphrase`. Throws "Invalid passphrase"
 * on the wrong passphrase, or if no wallet has been created yet.
 */
export async function unlock(
  passphrase: string,
  store: WalletStore,
): Promise<{ address: Address; privateKey: Hex }> {
  const ks = await loadKeystore(store);
  if (!ks) throw new Error('No agent wallet has been created');
  const privateKey = await decryptPrivateKey(passphrase, ks);
  // Cross-check the recovered key really maps to the stored address.
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== ks.address.toLowerCase()) {
    throw new Error('Invalid passphrase');
  }
  return { address: ks.address, privateKey };
}
