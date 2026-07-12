// T-201 - tiny key/value store on bun:sqlite (Mono pattern), plus encrypted
// storage for provider API keys. Single source of truth for server-side state.

import { Database } from 'bun:sqlite';
import { encrypt, decrypt } from './crypto.ts';
import type { AIRole, ProviderId, RoleModelMap } from '@autonoe/shared';

const db = new Database(process.env.AUTONOE_DB ?? 'autonoe.db');
db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');

const getStmt = db.query<{ value: string }, [string]>('SELECT value FROM kv WHERE key = ?');
const setStmt = db.query(
  'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);
const delStmt = db.query('DELETE FROM kv WHERE key = ?');

export const kv = {
  get(key: string): string | null {
    return getStmt.get(key)?.value ?? null;
  },
  set(key: string, value: string): void {
    setStmt.run(key, value);
  },
  del(key: string): void {
    delStmt.run(key);
  },
  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  },
};

// ── Provider API keys (encrypted at rest) ────────────────────────────────────

const keyName = (p: ProviderId) => `provider_key:${p}`;

export function setProviderKey(provider: ProviderId, apiKey: string): void {
  kv.set(keyName(provider), encrypt(apiKey));
}

export function getProviderKey(provider: ProviderId): string | null {
  const enc = kv.get(keyName(provider));
  return enc ? decrypt(enc) : null;
}

export function hasProviderKey(provider: ProviderId): boolean {
  return kv.get(keyName(provider)) !== null;
}

// Seed provider keys from env (e.g. MISTRAL_API_KEY) into the store at boot, so a
// pre-set `.env`/`.env.local` key works without visiting Settings. Stored keys win.
const ENV_KEY_NAME: Record<ProviderId, string> = {
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

export function seedEnvProviderKeys(): void {
  for (const provider of Object.keys(ENV_KEY_NAME) as ProviderId[]) {
    const value = process.env[ENV_KEY_NAME[provider]];
    if (value && !hasProviderKey(provider)) setProviderKey(provider, value);
  }
}

// ── Role → model config ──────────────────────────────────────────────────────

const ROLES_KEY = 'role_model_map';

export function getRoles(): RoleModelMap | null {
  return kv.getJSON<RoleModelMap>(ROLES_KEY);
}

export function setRoles(map: RoleModelMap): void {
  kv.setJSON(ROLES_KEY, map);
}

// ── Trade metadata (off-chain complement to on-chain DecisionLog) ─────────────

/** Off-chain metadata keyed by thesisHash, joined onto on-chain DecisionRecord. */
export interface TradeMeta {
  thesisId: string;
  thesisHash: `0x${string}`;
  source: 'ai' | 'human';
  judged: boolean;
  chosenOptionRef: string;
  modelsUsed: Partial<Record<AIRole, { provider: ProviderId; model: string }>>;
  asset: string;
  /** Hash of the tx that logged this decision on-chain (for the History explorer link). */
  txHash: `0x${string}` | null;
  /** Commit-reveal payload that hashes to thesisHash; revealed for verification. */
  commitment?: unknown;
  createdAt: string;
}

const TRADES_KEY = 'trades';

/** Append a new TradeMeta record to the kv list. */
export function recordTrade(meta: TradeMeta): void {
  const list = kv.getJSON<TradeMeta[]>(TRADES_KEY) ?? [];
  list.push(meta);
  kv.setJSON(TRADES_KEY, list);
}

/** Return all stored TradeMeta records. */
export function listTrades(): TradeMeta[] {
  return kv.getJSON<TradeMeta[]>(TRADES_KEY) ?? [];
}
