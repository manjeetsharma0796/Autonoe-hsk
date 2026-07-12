/**
 * Typed fetch helpers for the Autonoe backend.
 * All routes are same-origin — Next.js rewrites /api/* to the bun backend.
 * On non-2xx, the helpers parse `{ error }` from the response body and throw
 * an Error with that message.
 */

import type {
  AIRole,
  ChatMessage,
  DebateResult,
  IntakeFields,
  ProviderId,
  RoleModelMap,
  Thesis,
  TokenInfo,
} from '@autonoe/shared';

import type {
  HistoryResponse,
  LeaderboardResponse,
  ModelsResponse,
  ProviderInfo,
  RolesResponse,
  SetKeyResponse,
} from '@autonoe/shared';

// ── helpers ──────────────────────────────────────────────────────────────────

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors — keep the HTTP status message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function post<B, T>(url: string, body: B): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

// ── /api/thesis ───────────────────────────────────────────────────────────────

export interface PostThesisArgs {
  intent: string;
  activeSources: AIRole[];
}

export function postThesis(args: PostThesisArgs): Promise<Thesis> {
  return post<PostThesisArgs, Thesis>('/api/thesis', args);
}

// ── /api/thesis/human ─────────────────────────────────────────────────────────

export interface PostThesisHumanArgs {
  intent: string;
  body: string;
  /** Widened to string so any Bybit token can be selected, not just the closed AssetSymbol union. */
  suggestedPair: string;
}

export function postThesisHuman(args: PostThesisHumanArgs): Promise<Thesis> {
  return post<PostThesisHumanArgs, Thesis>('/api/thesis/human', args);
}

// ── /api/debate ───────────────────────────────────────────────────────────────

export function postDebate(thesis: Thesis): Promise<DebateResult> {
  return post<{ thesis: Thesis }, DebateResult>('/api/debate', { thesis });
}

// ── /api/assistant ────────────────────────────────────────────────────────────

export interface PostAssistantArgs {
  messages: ChatMessage[];
  context?: Record<string, unknown>;
}

export function postAssistant(args: PostAssistantArgs): Promise<ChatMessage> {
  return post<PostAssistantArgs, ChatMessage>('/api/assistant', args);
}

// ── /api/intake/extract ─────────────────────────────────────────────────────

/** LLM-extract the trade-scoping fields a user stated in a free-form intake answer. */
export function extractIntake(message: string): Promise<IntakeFields> {
  return post<{ message: string }, IntakeFields>('/api/intake/extract', { message });
}

// ── /api/history ──────────────────────────────────────────────────────────────

export function getHistory(): Promise<HistoryResponse> {
  return get<HistoryResponse>('/api/history');
}

// ── /api/leaderboard ──────────────────────────────────────────────────────────

export function getLeaderboard(): Promise<LeaderboardResponse> {
  return get<LeaderboardResponse>('/api/leaderboard');
}

// ── /api/candles ──────────────────────────────────────────────────────────────

export interface Candle {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function getCandles(symbol: string, interval = '60', limit = 100): Promise<Candle[]> {
  return get<Candle[]>(
    `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
  );
}

// ── /api/providers ────────────────────────────────────────────────────────────

export function getProviders(): Promise<ProviderInfo[]> {
  return get<ProviderInfo[]>('/api/providers');
}

// ── /api/models ───────────────────────────────────────────────────────────────

export function getModels(provider: ProviderId): Promise<ModelsResponse> {
  return get<ModelsResponse>(`/api/models?provider=${encodeURIComponent(provider)}`);
}

// ── /api/roles ────────────────────────────────────────────────────────────────

export function getRoles(): Promise<RolesResponse> {
  return get<RolesResponse>('/api/roles');
}

/** Accepts a PARTIAL map - the backend merges it into the current roles, so a
 *  single-role update never clobbers the others. Returns the full merged map. */
export function putRoles(roles: Partial<RoleModelMap>): Promise<RolesResponse> {
  return request<RolesResponse>('/api/roles', {
    method: 'PUT',
    body: JSON.stringify(roles),
  });
}

// ── /api/keys ─────────────────────────────────────────────────────────────────

export interface PostKeyArgs {
  provider: ProviderId;
  apiKey: string;
}

export function postKey(args: PostKeyArgs): Promise<SetKeyResponse> {
  return post<PostKeyArgs, SetKeyResponse>('/api/keys', args);
}

// ── /api/trades ───────────────────────────────────────────────────────────────

import type { Commitment } from './commitment';

/** Off-chain trade metadata persisted after a successful on-chain execution. */
export interface TradeMetaInput {
  thesisId: string;
  thesisHash: `0x${string}`;
  source: 'ai' | 'human';
  judged: boolean;
  chosenOptionRef: string;
  modelsUsed: Partial<RoleModelMap>;
  asset: string;
  txHash: `0x${string}` | null;
  /** Commit-reveal payload that hashes to thesisHash (null for legacy trades). */
  commitment?: Commitment | null;
  createdAt: string;
}

/** Record trade metadata so the execution shows up on History / leaderboard. */
export function recordTrade(meta: TradeMetaInput): Promise<{ ok: boolean }> {
  return post<TradeMetaInput, { ok: boolean }>('/api/trades', meta);
}

// ── /api/verify ───────────────────────────────────────────────────────────────

export interface VerifyResult {
  /** thesisHash recorded on-chain for this tx (null if unknown). */
  onChainHash: `0x${string}` | null;
  /** whether a DecisionLog entry with that hash actually exists on-chain. */
  onChain: boolean;
  /** the revealed commitment payload (null for legacy trades with no commit). */
  commitment: Commitment | null;
}

/** Reveal the commitment for a trade tx so the client can recompute + verify it. */
export function verifyTrade(txHash: string): Promise<VerifyResult> {
  return get<VerifyResult>(`/api/verify?tx=${encodeURIComponent(txHash)}`);
}

// ── /api/symbols ──────────────────────────────────────────────────────────────

export type { TokenInfo };

export function getSymbols(q?: string, limit?: number): Promise<TokenInfo[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (limit != null) params.set('limit', String(limit));
  const qs = params.toString();
  return get<TokenInfo[]>(`/api/symbols${qs ? `?${qs}` : ''}`);
}
