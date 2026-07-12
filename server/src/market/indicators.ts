// Technical indicators computed from a close-price series. Pure functions -
// fully unit-tested, no I/O.

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i]!;
  return sum / period;
}

/** Exponential moving average series (same length as input). */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0]! : values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return emaSeries(values, period).at(-1) ?? null;
}

/** Wilder-style RSI over the last `period` deltas. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

export function macd(values: number[]): { macd: number; signal: number; hist: number } | null {
  if (values.length < 26) return null;
  const e12 = emaSeries(values, 12);
  const e26 = emaSeries(values, 26);
  const line = values.map((_, i) => e12[i]! - e26[i]!);
  const signalSeries = emaSeries(line, 9);
  const m = line.at(-1)!;
  const s = signalSeries.at(-1)!;
  return { macd: round(m), signal: round(s), hist: round(m - s) };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export interface IndicatorSnapshot {
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  macd: { macd: number; signal: number; hist: number } | null;
  aboveSma20: boolean | null;
}

export function snapshot(values: number[]): IndicatorSnapshot {
  const sma20 = sma(values, 20);
  const last = values.at(-1) ?? null;
  return {
    rsi14: rsi(values, 14),
    sma20,
    sma50: sma(values, 50),
    ema20: ema(values, 20),
    macd: macd(values),
    aboveSma20: last !== null && sma20 !== null ? last > sma20 : null,
  };
}
