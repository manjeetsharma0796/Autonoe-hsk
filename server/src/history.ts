// T-207 - Backs /api/history and /api/leaderboard with real data by joining
// on-chain DecisionLog records with off-chain TradeMeta from SQLite.

import { getPublicClient, isDeployed, readHistory } from '@autonoe/chain';
import type { AIRole, ProviderId } from '@autonoe/shared';
import type { HistoryRecord, LeaderboardRow } from '@autonoe/shared';
import { listTrades } from './store.ts';

type Decisions = Awaited<ReturnType<typeof readHistory>>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read the on-chain DecisionLog with a couple of retries on transient RPC
 * rate-limits / 5xx. The DecisionLog is read one `getDecision(id)` call per
 * record, so a burst against the free public RPC can be throttled - retrying
 * with backoff turns a transient 429/503 into data instead of a 500.
 */
async function readWithRetry(): Promise<Decisions> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readHistory(getPublicClient());
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      const transient =
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('timeout');
      if (!transient || attempt === 2) break;
      await sleep(400 * (attempt + 1)); // 400ms, then 800ms
    }
  }
  throw lastErr;
}

// Short-TTL cache + in-flight de-dup for the (expensive) on-chain read. A single
// History page load fetches /api/history AND /api/leaderboard *in parallel*, and
// getLeaderboard() calls getHistory() again - 2x per load, 4x under React
// StrictMode in dev. Without this, those concurrent bursts of sequential
// eth_calls trip the public RPC's rate limit. The cache serves repeat loads; the
// in-flight promise collapses concurrent loads into a single chain read.
let cache: { at: number; data: HistoryRecord[]; hashes: Set<string> } | null = null;
let inflight: Promise<HistoryRecord[]> | null = null;
const TTL_MS = 8_000;

/** Force the next getHistory() to re-read the chain (e.g. just after a trade). */
export function invalidateHistoryCache(): void {
  cache = null;
}

async function loadHistory(): Promise<{ records: HistoryRecord[]; hashes: Set<string> }> {
  const decisions = await readWithRetry();
  const hashes = new Set(decisions.map((d) => d.thesisHash.toLowerCase()));

  // Build a lookup map: lowercase thesisHash → TradeMeta
  const trades = listTrades();
  const metaByHash = new Map(
    trades.map((t) => [t.thesisHash.toLowerCase(), t]),
  );

  const records: HistoryRecord[] = decisions.map((d) => {
    const meta = metaByHash.get(d.thesisHash.toLowerCase());
    return {
      thesisId: meta?.thesisId ?? d.thesisHash,
      source: meta?.source ?? 'ai',
      judged: meta?.judged ?? false,
      chosenOptionRef: meta?.chosenOptionRef ?? d.optionRef,
      txHash: meta?.txHash ?? null,
      pnlMUSD: Number(d.pnl) / 1e6,
      modelsUsed: meta?.modelsUsed ?? {},
      createdAt: new Date(d.timestamp * 1000).toISOString(),
    };
  });

  // Sort newest-first
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { records, hashes };
}

/** Whether a thesisHash actually exists in the on-chain DecisionLog. */
export async function isOnChain(hash: string): Promise<boolean> {
  if (!isDeployed()) return false;
  await getHistory(); // populates the cache (incl. the hash set)
  return cache?.hashes.has(hash.toLowerCase()) ?? false;
}

/**
 * Return all decisions from the on-chain DecisionLog, enriched with
 * off-chain trade metadata. Returns [] if contracts are not yet deployed.
 * Cached for a few seconds, with concurrent callers sharing one read.
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  if (!isDeployed()) return [];
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight; // concurrent callers join the in-flight read

  inflight = loadHistory()
    .then(({ records, hashes }) => {
      cache = { at: Date.now(), data: records, hashes };
      return records;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Aggregate per-(role, provider, model) statistics across all history records
 * that carry modelsUsed attribution. Returns [] if nothing to aggregate.
 * Sorted by avgPnlMUSD descending.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const history = await getHistory();

  interface Accumulator {
    trades: number;
    wins: number;
    sumPnl: number;
  }

  // Composite key: `${role}|${provider}|${model}`
  const acc = new Map<string, Accumulator>();

  for (const record of history) {
    if (!record.modelsUsed || Object.keys(record.modelsUsed).length === 0) continue;
    const pnl = record.pnlMUSD ?? 0;

    for (const [role, choice] of Object.entries(record.modelsUsed) as [
      AIRole,
      { provider: ProviderId; model: string },
    ][]) {
      if (!choice) continue;
      const key = `${role}|${choice.provider}|${choice.model}`;
      const entry = acc.get(key) ?? { trades: 0, wins: 0, sumPnl: 0 };
      entry.trades += 1;
      if (pnl > 0) entry.wins += 1;
      entry.sumPnl += pnl;
      acc.set(key, entry);
    }
  }

  if (acc.size === 0) return [];

  const rows: LeaderboardRow[] = [];
  for (const [key, { trades, wins, sumPnl }] of acc) {
    const [role, provider, model] = key.split('|') as [AIRole, ProviderId, string];
    rows.push({
      role,
      provider,
      model,
      trades,
      winRate: wins / trades,
      avgPnlMUSD: sumPnl / trades,
    });
  }

  rows.sort((a, b) => b.avgPnlMUSD - a.avgPnlMUSD);
  return rows;
}
