// Frozen REST API contract — see PRD §12. Server implements these; web/wallet
// call them. Keep request/response shapes in sync with this file only.

import type {
  AIRole,
  AssetSymbol,
  ChatMessage,
  DebateResult,
  IntakeFields,
  ProviderId,
  RoleModelMap,
  Thesis,
  TokenInfo,
} from './types.js';

/** Route paths, referenced by both server and client. */
export const API = {
  providers: '/api/providers',
  keys: '/api/keys',
  models: '/api/models',
  roles: '/api/roles',
  thesis: '/api/thesis',
  thesisHuman: '/api/thesis/human',
  debate: '/api/debate',
  assistant: '/api/assistant',
  intakeExtract: '/api/intake/extract',
  history: '/api/history',
  leaderboard: '/api/leaderboard',
  symbols: '/api/symbols',
} as const;

// ── /api/providers ───────────────────────────────────────────────────────────

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Where to get a free key. */
  keysUrl: string;
  /** One-line free-tier note. */
  note: string;
  /** Whether a key is already stored. */
  hasKey: boolean;
}
export type ProvidersResponse = ProviderInfo[];

// ── /api/keys ────────────────────────────────────────────────────────────────

export interface SetKeyRequest {
  provider: ProviderId;
  apiKey: string;
}
export interface SetKeyResponse {
  ok: boolean;
}

// ── /api/models?provider= ────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number | null;
  maxOutput: number | null;
  vision: boolean | null;
  tools: boolean | null;
  free: boolean | null;
}
export type ModelsResponse = ModelInfo[];

// ── /api/roles ───────────────────────────────────────────────────────────────

export type RolesResponse = RoleModelMap;
export type SetRolesRequest = RoleModelMap;

// ── /api/thesis ──────────────────────────────────────────────────────────────

export interface ThesisRequest {
  intent: string;
  /** Active subagent roles for this run. */
  activeSources: AIRole[];
}
export type ThesisResponse = Thesis;

// ── /api/thesis/human ────────────────────────────────────────────────────────

export interface HumanThesisRequest {
  intent: string;
  /** The user's written thesis body. */
  body: string;
  suggestedPair: AssetSymbol;
}
export type HumanThesisResponse = Thesis;

// ── /api/debate ──────────────────────────────────────────────────────────────

export interface DebateRequest {
  thesis: Thesis;
}
export type DebateResponse = DebateResult;

// ── /api/assistant ───────────────────────────────────────────────────────────

export interface AssistantRequest {
  messages: ChatMessage[];
  /** Optional market/position context. */
  context?: Record<string, unknown>;
}
/** Streamed; each chunk is a partial assistant message. */
export type AssistantChunk = { delta: string } | { done: true };

// ── /api/intake/extract ──────────────────────────────────────────────────────

export interface IntakeExtractRequest {
  /** A free-form Step-1 intake answer, e.g. "buy 10 sol and make $100 profit". */
  message: string;
}
/** The fields the model could pull from `message`; absent fields stay unset. */
export type IntakeExtractResponse = IntakeFields;

// ── /api/history ─────────────────────────────────────────────────────────────

export interface HistoryRecord {
  thesisId: string;
  source: 'ai' | 'human';
  judged: boolean;
  chosenOptionRef: string;
  txHash: `0x${string}` | null;
  pnlMUSD: number | null;
  modelsUsed: Partial<RoleModelMap>;
  createdAt: string;
}
export type HistoryResponse = HistoryRecord[];

// ── /api/leaderboard ─────────────────────────────────────────────────────────

export interface LeaderboardRow {
  role: AIRole;
  provider: ProviderId;
  model: string;
  trades: number;
  winRate: number;
  avgPnlMUSD: number;
}
export type LeaderboardResponse = LeaderboardRow[];

// ── /api/symbols ─────────────────────────────────────────────────────────────

export type SymbolsResponse = TokenInfo[];
