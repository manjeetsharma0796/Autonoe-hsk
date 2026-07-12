/** Static sample data for the Studio workspace (no API calls yet). */

export type Risk = "low" | "medium" | "high";
export type Direction = "long" | "short" | "hedge" | "hold";

export type DataSourceKey = "onchain" | "market" | "indicators" | "news";

export interface DataSource {
  key: DataSourceKey;
  label: string;
}

export const DATA_SOURCES: DataSource[] = [
  { key: "onchain", label: "On-chain" },
  { key: "market", label: "Market" },
  { key: "indicators", label: "Indicators" },
  { key: "news", label: "News" },
];

/** Sources enabled by default (News off, matching the mockup). */
export const DEFAULT_SOURCES: Record<DataSourceKey, boolean> = {
  onchain: true,
  market: true,
  indicators: true,
  news: false,
};

export const DEFAULT_INTENT =
  "WMNT looks oversold after the testnet incentive cliff - is there a scaled long worth taking against mUSD?";

export const DEFAULT_HUMAN_CASE =
  "WMNT has round-tripped to its pre-incentive range while on-chain TVL held flat - sellers look exhausted. I'd scale a long against mUSD, sized small, adding only on a reclaim of the 1.30 level. Invalidation: a daily close back under 1.18.";

export interface TraceStep {
  label: string;
  detail: string;
}

export const THESIS_TRACE: TraceStep[] = [
  {
    label: "subagent · on-chain",
    detail:
      "Net DEX inflow to WMNT positive over 72h; agent-wallet holders flat, not distributing. No abnormal contract approvals on the pair.",
  },
  {
    label: "subagent · market",
    detail:
      "mUSD/WMNT printed a higher low at 1.21 after the -7% incentive-cliff flush; 24h change +4.21%, volume reverting to the 14-day mean.",
  },
  {
    label: "subagent · indicators",
    detail:
      "RSI(14) lifted off 31; MACD histogram flipped positive intraday. Reclaim of 1.30 would confirm trend; 1.18 is structural invalidation.",
  },
  {
    label: "thesis · synthesis",
    detail:
      "Asymmetry favors a scaled long against mUSD across three risk tiers. News source disabled - no catalyst weighting applied.",
  },
];

export interface ThesisOption {
  id: string;
  risk: Risk;
  direction: Direction;
  directionLabel: string;
  asset: string;
  sizeLabel: string;
  sizeValue: string;
  rationale: string;
  predicted: string;
}

export const THESIS_OPTIONS: ThesisOption[] = [
  {
    id: "opt-1",
    risk: "low",
    direction: "long",
    directionLabel: "Long",
    asset: "WMNT",
    sizeValue: "250 mUSD",
    sizeLabel: "opt-1 · scaled entry",
    rationale:
      "Toe-in long against mUSD. Single tranche at market, hard stop under 1.18. Built to survive a re-test, not to maximize upside.",
    predicted: "+2.1% to +4.0%",
  },
  {
    id: "opt-2",
    risk: "medium",
    direction: "long",
    directionLabel: "Long",
    asset: "WMNT",
    sizeValue: "600 mUSD",
    sizeLabel: "opt-2 · two-tranche",
    rationale:
      "Half now, half on a confirmed reclaim of 1.30. Balances the oversold entry with momentum confirmation. The base case of the three sources.",
    predicted: "+6.4% to +11.0%",
  },
  {
    id: "opt-3",
    risk: "high",
    direction: "long",
    directionLabel: "Long",
    asset: "WMNT",
    sizeValue: "1,200 mUSD",
    sizeLabel: "opt-3 · full size",
    rationale:
      "Conviction long, full size at market on the oversold thesis. Largest drawdown exposure if 1.18 fails - only for a high risk appetite.",
    predicted: "+12.0% to +21.0%",
  },
];

export interface Judge {
  key: "sup" | "dis" | "jud";
  role: string;
  heading: string;
  argument: string;
  summary: string;
  trace: TraceStep[];
}

export const JUDGES: Judge[] = [
  {
    key: "sup",
    role: "Supporter",
    heading: "Argues for",
    argument:
      "The oversold reclaim is real: a higher low at 1.21, positive net DEX inflow and an RSI turn give a clean asymmetric long. The two-tranche entry caps risk while keeping upside into a 1.30 reclaim.",
    summary: " - 3 confluent buy signals",
    trace: [
      {
        label: "structure",
        detail: "Higher low printed; sellers failed to extend the cliff flush.",
      },
      { label: "flow", detail: "72h net inflow positive; holders not distributing." },
      {
        label: "risk/reward",
        detail: "Stop at 1.18 risks ~5% to capture +6 - 11% - favorable R.",
      },
    ],
  },
  {
    key: "dis",
    role: "Discriminator",
    heading: "Argues against",
    argument:
      "An incentive cliff is a structural seller, not noise. Thin testnet liquidity makes the 1.30 reclaim a low-conviction breakout prone to a fade. Full size here invites a sharp drawdown if 1.18 cracks.",
    summary: " - 2 material objections",
    trace: [
      {
        label: "liquidity",
        detail: "Thin book; 1.30 reclaim could be a liquidity grab, not a trend.",
      },
      {
        label: "catalyst gap",
        detail: "News source disabled - an unpriced cliff headline is a tail risk.",
      },
    ],
  },
  {
    key: "jud",
    role: "Judge",
    heading: "Delivers the verdict",
    argument:
      "The long has an edge but the Discriminator's liquidity caveat is valid. Verdict: favor the scaled medium-risk entry, trim the full-size tier, and require a confirmed 1.30 reclaim before adding. Confidence is moderate.",
    summary: " - weighed both, downsized tail risk",
    trace: [
      {
        label: "weighting",
        detail: "Supporter edge real; Discriminator liquidity risk priced in.",
      },
      { label: "sizing", detail: "Cut high-risk tier; gate adds on a confirmed reclaim." },
      {
        label: "confidence",
        detail: "0.62 - directional edge, execution-path uncertainty.",
      },
    ],
  },
];

export interface RefinedOption {
  id: string;
  title: string;
  sub: string;
  risk: Risk;
  riskLabel: string;
  predicted: string;
  caveats: string[];
  confidence: number;
}

export const REFINED_OPTIONS: RefinedOption[] = [
  {
    id: "ref-1",
    title: "Long WMNT",
    sub: "opt-1 · scaled entry",
    risk: "low",
    riskLabel: "Low",
    predicted: "+3.1%",
    caveats: [
      "Upside capped by single-tranche sizing.",
      "Slippage on thin testnet liquidity.",
    ],
    confidence: 0.74,
  },
  {
    id: "ref-2",
    title: "Long WMNT",
    sub: "opt-2 · two-tranche",
    risk: "medium",
    riskLabel: "Medium",
    predicted: "+7.5%",
    caveats: [
      "Second tranche gated on a confirmed 1.30 reclaim.",
      "Cliff-headline tail risk unpriced (News off).",
      "Invalidation: daily close under 1.18.",
    ],
    confidence: 0.62,
  },
  {
    id: "ref-3",
    title: "Long WMNT",
    sub: "opt-3 · full size",
    risk: "high",
    riskLabel: "High",
    predicted: "+14.0%",
    caveats: [
      "Panel trimmed sizing - drawdown exposure is steep.",
      "Liquidity-grab risk on the 1.30 reclaim.",
      "Only for a high risk appetite.",
    ],
    confidence: 0.41,
  },
];
