/**
 * extractContested - scan free-form debate text for the numeric claims the
 * supporter / discriminator / judge are arguing over, and return them as raw
 * de-duplicated tokens (signed percentages, prices, RSI/indicator readings,
 * integers carrying a unit). Order of first appearance is preserved.
 *
 * Pure, dependency-free. Used by ContestedStrip to surface the "contested"
 * numbers above the tribunal arguments.
 */

// Matched in priority order; first alternative that hits at a position wins.
const PATTERNS: RegExp[] = [
  // Signed / unsigned percentages: +38%, -12.5%, 7%
  /[+-]?\d+(?:\.\d+)?\s?%/,
  // Named indicator readings: RSI 28, MACD 1.4, EMA 200, ATR 0.9
  /\b(?:RSI|MACD|EMA|SMA|ATR|ADX|VWAP|MFI|OBV)\s?\d+(?:\.\d+)?\b/i,
  // Decimal prices / ratios: 1.305, 0.42, 64231.50
  /\b\d+\.\d+\b/,
  // Integers with an attached unit / currency: $1200, 4x, 30d, 200ms, 12h
  /(?:\$\d{1,3}(?:,?\d{3})*(?:\.\d+)?|\b\d[\d,]*(?:k|m|b|x|d|h|bps|ms|bp)\b)/i,
];

const MAX_TOKENS = 12;

export function extractContested(...texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of texts) {
    if (!raw) continue;
    // Walk the string, at each cursor try the patterns in priority order so a
    // "+38%" isn't first eaten as the bare integer "38".
    let i = 0;
    while (i < raw.length && out.length < MAX_TOKENS) {
      let matched: { token: string; len: number } | null = null;
      for (const base of PATTERNS) {
        const re = new RegExp(base.source, base.flags.includes("y") ? base.flags : base.flags + "y");
        re.lastIndex = i;
        const m = re.exec(raw);
        if (m && m.index === i) {
          matched = { token: m[0].replace(/\s+/g, " ").trim(), len: m[0].length };
          break;
        }
      }
      if (matched) {
        const key = matched.token.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(matched.token);
        }
        i += Math.max(matched.len, 1);
      } else {
        i += 1;
      }
    }
    if (out.length >= MAX_TOKENS) break;
  }

  return out;
}
