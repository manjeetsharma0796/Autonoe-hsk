// Sample/static terminal data ported from web/mockups/trade.html.
// No real API calls yet - testnet placeholder values.

export type Pair = {
  sym: string;
  badge: string;
  sub: string;
  /** Bybit spot ticker (e.g. "MNTUSDT") used to point the TradingView chart at the right feed. */
  bybitSymbol?: string;
  /** display price string */
  px: string;
  /** numeric price used for swap estimate (mUSD per 1 unit of asset) */
  pxNum: number;
  ch: string;
  dir: "up" | "down";
  /** mUSD -> asset conversion rate (asset per 1 mUSD) */
  rate: number;
};

export const PAIRS: Pair[] = [
  {
    sym: "WHSK",
    badge: "W",
    sub: "Wrapped HSK",
    bybitSymbol: "MNTUSDT",
    px: "1.2843",
    pxNum: 1.2843,
    ch: "4.21%",
    dir: "up",
    rate: 0.7787,
  },
  {
    sym: "BTC",
    badge: "₿",
    sub: "Test Bitcoin",
    bybitSymbol: "BTCUSDT",
    px: "64,210",
    pxNum: 64210,
    ch: "1.08%",
    dir: "down",
    rate: 0.00001557,
  },
  {
    sym: "ETH",
    badge: "Ξ",
    sub: "Test Ether",
    bybitSymbol: "ETHUSDT",
    px: "3,488",
    pxNum: 3488,
    ch: "2.74%",
    dir: "up",
    rate: 0.0002867,
  },
];

export const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D", "1W"] as const;

export const SLIPPAGES = ["0.1%", "0.5%", "1.0%"] as const;

export const STATS = [
  { k: "24h High", n: "1.3018", tone: "up" as const },
  { k: "24h Low", n: "1.2210", tone: "down" as const },
  { k: "24h Vol (mUSD)", n: "842,109", tone: undefined },
  { k: "Liquidity", n: "3.91M", tone: undefined },
];

export const BALANCES = [
  { sym: "mUSD", badge: "$", n: "12,500.00", sub: "≈ $12,500", tone: undefined },
  {
    sym: "WHSK",
    badge: "W",
    n: "318.40",
    sub: "+4.21% · ≈ $408.92",
    tone: "up" as const,
  },
  {
    sym: "BTC",
    badge: "₿",
    n: "0.0140",
    sub: "-1.08% · ≈ $898.94",
    tone: "down" as const,
  },
  {
    sym: "ETH",
    badge: "Ξ",
    n: "1.250",
    sub: "+2.74% · ≈ $4,360",
    tone: "up" as const,
  },
];

// Candle tuples: [open, close, high, low] in SVG y-units (lower y = higher px).
export const CANDLES: [number, number, number, number][] = [
  [210, 205, 218, 200],
  [205, 198, 210, 202],
  [200, 214, 196, 216],
  [214, 178, 220, 176],
  [178, 190, 174, 194],
  [190, 150, 196, 148],
  [150, 162, 146, 166],
  [162, 124, 168, 122],
  [124, 140, 120, 144],
  [140, 98, 146, 96],
  [98, 116, 94, 120],
  [116, 82, 122, 80],
  [82, 100, 78, 104],
  [100, 70, 106, 68],
  [70, 86, 66, 90],
  [86, 54, 92, 52],
  [54, 66, 50, 70],
];

export const THINKING_STEPS: { head: string; rest: string }[] = [
  {
    head: "Parsed intent",
    rest: " - directional swing, asset WHSK, base mUSD, ~4h horizon, bullish bias.",
  },
  {
    head: "On-chain pull",
    rest: " - WHSK/mUSD pool depth 3.91M, 24h vol 842k, net inflow positive over 3 sessions.",
  },
  {
    head: "Indicators",
    rest: " - 4H RSI 58 (room), price holding above 20/50 EMA cross, structure of higher lows intact.",
  },
  {
    head: "Risk frame",
    rest: " - invalidation 1.198 (-2.0%); R:R ≈ 1:3.2 at first target 1.36.",
  },
  {
    head: "Sizing",
    rest: " - 8% of mUSD balance → 1,000 mUSD, scaled in two clips to respect slippage band.",
  },
  {
    head: "Verdict draft",
    rest: " - Long, medium risk, predicted +6.4% - 11%. Ready for tribunal cross-examination.",
  },
];

export type ChatMsg = {
  who: "bot" | "me";
  // rendered as JSX in the component to allow inline emphasis
  key: string;
};

export function formatTo(amount: number, rate: number): string {
  return (amount * rate).toLocaleString(undefined, {
    maximumFractionDigits: rate < 0.01 ? 6 : 2,
  });
}
