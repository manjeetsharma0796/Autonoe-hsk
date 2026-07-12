import { test, expect } from 'bun:test';
import { sma, ema, rsi, macd, snapshot } from '../src/market/indicators.ts';
import { getKline, getTicker, type Fetcher } from '../src/market/bybit.ts';

const upSeries = Array.from({ length: 30 }, (_, i) => 100 + i); // strictly increasing

test('sma averages the last N values', () => {
  expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
  expect(sma(upSeries, 5)).toBe((125 + 126 + 127 + 128 + 129) / 5);
  expect(sma([1, 2], 5)).toBeNull();
});

test('ema of a constant series is the constant', () => {
  expect(ema([5, 5, 5, 5, 5, 5], 3)).toBe(5);
});

test('rsi is 100 for a only-gains series and within 0..100', () => {
  expect(rsi(upSeries, 14)).toBe(100);
  const mixed = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
  const r = rsi(mixed, 14)!;
  expect(r).toBeGreaterThanOrEqual(0);
  expect(r).toBeLessThanOrEqual(100);
});

test('macd is defined for >=26 points and positive on an uptrend', () => {
  const m = macd(upSeries)!;
  expect(m).not.toBeNull();
  expect(m.macd).toBeGreaterThan(0);
  expect(typeof m.hist).toBe('number');
});

test('snapshot reports above-SMA20 on an uptrend', () => {
  const s = snapshot(upSeries);
  expect(s.aboveSma20).toBe(true);
  expect(s.rsi14).toBe(100);
});

// ── Bybit parsing with an injected fetcher (no network) ──────────────────────

const fakeFetch: Fetcher = async (url) => ({
  ok: true,
  status: 200,
  json: async () =>
    url.includes('kline')
      ? {
          result: {
            // newest-first, as Bybit returns
            list: [
              ['2', '102', '110', '95', '108', '5', '0'],
              ['1', '101', '109', '94', '106', '6', '0'],
              ['0', '100', '108', '93', '104', '7', '0'],
            ],
          },
        }
      : { result: { list: [{ lastPrice: '1.2843', price24hPcnt: '0.0421', volume24h: '1000' }] } },
});

test('getKline returns candles oldest→newest', async () => {
  const candles = await getKline('WMNT', '60', 3, fakeFetch);
  expect(candles).toHaveLength(3);
  expect(candles[0]!.close).toBe(104); // oldest first after reverse
  expect(candles.at(-1)!.close).toBe(108);
});

test('getTicker parses price + 24h percent', async () => {
  const t = await getTicker('BTC', fakeFetch);
  expect(t.price).toBe(1.2843);
  expect(t.change24hPct).toBeCloseTo(4.21, 5);
});
