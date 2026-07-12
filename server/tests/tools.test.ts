import { test, expect } from 'bun:test';
import { makeRecorder, makeTools } from '../src/agents/tools.ts';
import type { Fetcher } from '../src/market/bybit.ts';

const fakeFetch: Fetcher = async (url) => ({
  ok: true,
  status: 200,
  json: async () =>
    url.includes('kline')
      ? { result: { list: Array.from({ length: 30 }, (_, i) => [String(29 - i), '100', '110', '90', String(100 + (29 - i)), '5', '0']) } }
      : { result: { list: [{ lastPrice: '1.2843', price24hPcnt: '0.0421', volume24h: '1000' }] } },
});

test('makeTools respects the active-source allow-list', () => {
  const rec = makeRecorder();
  const market = makeTools(rec, ['subagent.market'], fakeFetch);
  expect(market.tools.map((t) => t.name).sort()).toEqual(['get_candles', 'get_ticker']);

  const indicators = makeTools(rec, ['subagent.indicators'], fakeFetch);
  expect(indicators.tools.map((t) => t.name)).toEqual(['get_indicators']);

  const none = makeTools(rec, [], fakeFetch);
  expect(none.tools).toHaveLength(0);
});

test('get_indicators runs and records a reasoning trace', async () => {
  const rec = makeRecorder();
  const { byName } = makeTools(rec, ['subagent.indicators'], fakeFetch);
  const out = String(await byName.get('get_indicators')!.invoke({ asset: 'WHSK' }));
  expect(out).toContain('RSI14');
  const traces = rec.traces();
  expect(traces).toHaveLength(1);
  expect(traces[0]!.role).toBe('subagent.indicators');
  expect(traces[0]!.steps[0]!.label).toBe('indicators:WHSK');
});
