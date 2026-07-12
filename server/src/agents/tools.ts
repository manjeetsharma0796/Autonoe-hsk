// LangChain tools the thesis agent can call on demand (intent-driven). Each tool
// fetches real data and records a reasoning-trace entry. The active data-source
// toggles act as an allow-list of which tools the model may use. (News skipped.)

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { AIRole, AssetSymbol, ReasoningTrace } from '@autonoe/shared';
import { getKline, getTicker, closes, type Fetcher } from '../market/bybit.ts';
import { snapshot } from '../market/indicators.ts';

const Asset = z.object({ asset: z.enum(['WHSK', 'BTC', 'ETH', 'SUI', 'SOL']) });

export interface TraceRecorder {
  add(role: AIRole, name: string, summary: string, detail: string): void;
  traces(): ReasoningTrace[];
}

export function makeRecorder(): TraceRecorder {
  const byRole = new Map<AIRole, ReasoningTrace>();
  return {
    add(role, name, summary, detail) {
      const t = byRole.get(role) ?? { role, summary, steps: [] };
      t.steps.push({ label: name, detail });
      byRole.set(role, t);
    },
    traces: () => [...byRole.values()],
  };
}

/** Build the toolset, filtered to the active data sources. */
export function makeTools(rec: TraceRecorder, active: AIRole[], f?: Fetcher) {
  const allow = new Set(active);

  const tickerTool = tool(
    async ({ asset }: { asset: AssetSymbol }) => {
      const t = await getTicker(asset, f);
      const detail = `price ${t.price}, 24h ${t.change24hPct.toFixed(2)}%, vol ${t.volume24h}`;
      rec.add('subagent.market', `ticker:${asset}`, 'Live price from Bybit', detail);
      return `${asset} ${detail}`;
    },
    { name: 'get_ticker', description: 'Live spot price + 24h change/volume for an asset (Bybit).', schema: Asset },
  );

  const candlesTool = tool(
    async ({ asset }: { asset: AssetSymbol }) => {
      const candles = await getKline(asset, '60', 100, f);
      const cs = closes(candles);
      const first = cs[0] ?? 0;
      const last = cs.at(-1) ?? 0;
      const pct = first ? ((last - first) / first) * 100 : 0;
      const lo = Math.min(...cs);
      const hi = Math.max(...cs);
      const detail = `100x1h: last ${last}, window ${pct.toFixed(1)}%, range ${lo}–${hi}`;
      rec.add('subagent.market', `candles:${asset}`, 'Fetched 1h candles from Bybit', detail);
      return `${asset} ${detail}`;
    },
    { name: 'get_candles', description: 'Recent 1h OHLC summary for an asset (Bybit).', schema: Asset },
  );

  const indicatorsTool = tool(
    async ({ asset }: { asset: AssetSymbol }) => {
      const candles = await getKline(asset, '60', 100, f);
      const s = snapshot(closes(candles));
      const detail =
        `RSI14 ${s.rsi14}, SMA20 ${s.sma20?.toFixed(4)}, SMA50 ${s.sma50?.toFixed(4)}, ` +
        `aboveSMA20 ${s.aboveSma20}, MACD hist ${s.macd?.hist}`;
      rec.add('subagent.indicators', `indicators:${asset}`, 'Computed RSI/MA/MACD from real candles', detail);
      return `${asset} ${detail}`;
    },
    { name: 'get_indicators', description: 'RSI, SMA20/50, MACD computed from real candles.', schema: Asset },
  );

  const onchainTool = tool(
    async () => {
      // Mock until the chain lib (T-108) exposes AMM reserves on HashKey Chain.
      const detail = 'mUSD/WHSK mid 1.2843, depth ~42k mUSD, 24h vol +18% (AMM, placeholder)';
      rec.add('subagent.onchain', 'onchain:amm', 'Read on-chain AMM state (placeholder)', detail);
      return detail;
    },
    { name: 'get_onchain_market', description: 'On-chain AMM price/liquidity for mUSD pairs (HashKey Chain).', schema: z.object({}) },
  );

  const all = [
    { roles: ['subagent.market'], t: tickerTool },
    { roles: ['subagent.market'], t: candlesTool },
    { roles: ['subagent.indicators'], t: indicatorsTool },
    { roles: ['subagent.onchain'], t: onchainTool },
  ];

  const tools = all.filter((e) => e.roles.some((r) => allow.has(r as AIRole))).map((e) => e.t);
  type Invokable = { invoke: (arg: Record<string, unknown>) => Promise<unknown> };
  const byName = new Map<string, Invokable>(
    tools.map((t) => [t.name, t as unknown as Invokable] as const),
  );
  return { tools, byName };
}
