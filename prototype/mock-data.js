/* ============================================================
   Autonoe Agent Arena - Mock data
   Exposes window.MOCK for the static prototype. No network.
   ============================================================ */
(function () {
  "use strict";

  var MOCK = {};

  /* ---------- Disclosed backtest window ---------- */
  MOCK.window = {
    label: "2024-09-01 → 2024-11-30 UTC",
    symbol: "MNTUSDT 1h",
    venue: "Bybit",
    bars: 2184,
    note: "Fixed, disclosed, frozen out-of-sample window."
  };

  /* ---------- On-chain contracts (Mantle Sepolia) ---------- */
  MOCK.contracts = {
    chain: "Mantle Sepolia",
    chainId: 5003,
    explorerBase: "https://sepolia.mantlescan.xyz",
    DecisionLog:   "0x7Af3C1e94B0d2F8A6E5b19c4D3a7F2e1B8C0d934",
    AgentRegistry: "0x1bE5a02F7C3d489a6B0e1F8c2D4a7b93E5f06C81"
  };

  /* explorer(hashOrAddr) -> mantlescan URL (auto tx vs address) */
  MOCK.explorer = function (hashOrAddr) {
    if (!hashOrAddr) return MOCK.contracts.explorerBase;
    var s = String(hashOrAddr);
    var path = s.length > 50 ? "/tx/" : "/address/";
    return MOCK.contracts.explorerBase + path + s;
  };

  /* ---------- Naive baseline (buy & hold over window) ---------- */
  MOCK.baselineReturnPct = 6.4;

  /* ---------- Agents (leaderboard) ---------- */
  MOCK.agents = [
    {
      id: "agt_aurora",  name: "Aurora-Momentum", owner: "0x9C12aB7e4F08D6c5319eA2b0F7d84C6e1a3B5072",
      configHash: "0x4f8a1c93e207b6d5a0f3c8e91d24576baf0c39e8d71a4b62c95f08e3a1d7b640",
      version: 3, parentId: "agt_aurora_v2", isPrivate: false,
      netReturnPct: 24.8, baselineReturnPct: 6.4, winRatePct: 58.2, profitFactor: 2.31, trades: 91, grade: "excellent"
    },
    {
      id: "agt_obsidian", name: "Obsidian Vault", owner: "0x3aF7029bC15e8d4A6f02C71e9B3d5870aE16c4D2",
      configHash: "0x9e7d2a4c8b15f603e9a1d7c20b48f6539ace0817d2b4f6a9c0e3158d7b29a046",
      version: 2, parentId: "agt_obsidian_v1", isPrivate: true,
      netReturnPct: 19.6, baselineReturnPct: 6.4, winRatePct: 54.9, profitFactor: 1.94, trades: 73, grade: "excellent"
    },
    {
      id: "agt_helios",  name: "Helios Breakout", owner: "0x71B0e3c8A2f4D6519e07Ca3b8F25d09617aE4c83",
      configHash: "0x1c6b9f04a37e2d85c019b4f7a6230e8d5fb1409c7e2a6d83b50f19c4ae7d2360",
      version: 1, parentId: null, isPrivate: false,
      netReturnPct: 15.1, baselineReturnPct: 6.4, winRatePct: 51.3, profitFactor: 1.72, trades: 64, grade: "good"
    },
    {
      id: "agt_nereid",  name: "Nereid Mean-Rev", owner: "0x05D9a1F7c4B36e80A2f19d5C7e034b6810aF92e6",
      configHash: "0x83a0d5c2e9147b6f0a3e8c15d72b49608fae3017c6b2d495a8f0e31726d4c098",
      version: 2, parentId: "agt_nereid_v1", isPrivate: false,
      netReturnPct: 11.3, baselineReturnPct: 6.4, winRatePct: 49.8, profitFactor: 1.51, trades: 120, grade: "good"
    },
    {
      id: "agt_caelum",  name: "Caelum Carry", owner: "0xA8c0F371e95B2d640f17Ce8a3B0d9526718fE4a1",
      configHash: "0x6d1f9a04c83e72b5061d9c47a2f08b3e95ca7016d3b8f249e0a51c6738b2d490",
      version: 1, parentId: null, isPrivate: false,
      netReturnPct: 7.9, baselineReturnPct: 6.4, winRatePct: 47.1, profitFactor: 1.28, trades: 58, grade: "fair"
    },
    {
      id: "agt_styx",    name: "Styx Scalper", owner: "0x2e7B19a0C4f85D36018eA72c5B3f9460817dCe35",
      configHash: "0xa0c4e9176b3d82f5091a7c43e8b260f5d9ca38170e2b6d845f0931c7a26e4d80",
      version: 1, parentId: null, isPrivate: true,
      netReturnPct: 3.2, baselineReturnPct: 6.4, winRatePct: 44.6, profitFactor: 1.07, trades: 214, grade: "fair"
    },
    {
      id: "agt_erebus",  name: "Erebus Trend", owner: "0x6F0a91c7E3b25D840a17Cf83b9D0e25617aB4c90",
      configHash: "0x2b8d0f5a17c4e93601d8a7c25f4b09e63dca10874e2b6f5908a1d3c64b7e0d92",
      version: 1, parentId: null, isPrivate: false,
      netReturnPct: -2.7, baselineReturnPct: 6.4, winRatePct: 41.0, profitFactor: 0.88, trades: 77, grade: "poor"
    }
  ];

  /* ---------- Price candles for sparkline (~60 bars) ---------- */
  MOCK.candles = (function () {
    var out = [], price = 0.612, t0 = Date.UTC(2024, 8, 1, 0, 0, 0);
    var drift = [ 0.4,0.9,-0.3,0.6,1.1,0.2,-0.7,0.5,1.3,0.8,-0.4,0.3,
                  -0.9,0.2,1.0,1.4,0.5,-0.6,0.1,0.9,1.2,-0.2,0.7,1.1,
                  -1.0,-0.5,0.3,0.8,1.5,0.6,-0.3,0.4,1.0,-0.8,0.2,0.7,
                  1.3,0.9,-0.4,0.5,1.1,1.6,-0.7,0.3,0.8,1.2,-0.5,0.4,
                  0.9,1.4,0.7,-0.6,0.2,1.0,1.5,0.6,-0.3,0.8,1.1,0.9 ];
    for (var i = 0; i < drift.length; i++) {
      var open = price;
      var chg = drift[i] / 100 * (0.9 + (i % 5) * 0.05);
      var close = +(open * (1 + chg)).toFixed(4);
      var hi = +(Math.max(open, close) * (1 + 0.004 + (i % 3) * 0.001)).toFixed(4);
      var lo = +(Math.min(open, close) * (1 - 0.004 - (i % 4) * 0.001)).toFixed(4);
      out.push({ t: t0 + i * 3600 * 1000, open: +open.toFixed(4), high: hi, low: lo, close: close });
      price = close;
    }
    return out;
  })();

  /* ---------- Backtest equity curves (~60 points, normalized to 100) ---------- */
  MOCK.aiEquity = (function () {
    var steps = [0,0.6,1.4,1.1,2.3,3.0,2.6,3.8,5.1,4.7,5.9,6.8,
                 6.1,7.4,8.9,8.3,9.7,11.0,10.4,11.8,13.1,12.5,13.9,15.2,
                 14.4,13.6,15.0,16.4,17.9,17.1,18.5,17.7,19.2,18.3,19.8,21.0,
                 20.2,21.6,22.9,22.1,23.4,22.6,23.9,24.0,23.2,24.4,24.8,24.1,
                 24.9,24.3,25.0,24.6,24.8,24.2,24.7,24.9,24.5,24.8,24.7,24.8];
    return steps.map(function (p) { return +(100 * (1 + p / 100)).toFixed(3); });
  })();
  MOCK.baselineEquity = (function () {
    var steps = [0,0.3,0.7,0.5,1.0,1.4,1.1,1.6,2.1,1.8,2.4,2.9,
                 2.5,3.0,3.6,3.2,3.8,4.3,4.0,4.5,5.0,4.6,5.1,5.6,
                 5.2,4.8,5.3,5.8,6.3,5.9,6.4,6.0,6.5,6.1,6.6,7.0,
                 6.6,7.0,7.3,6.9,7.2,6.7,7.0,6.8,6.4,6.7,6.9,6.5,
                 6.8,6.5,6.7,6.4,6.6,6.3,6.5,6.6,6.4,6.5,6.4,6.4];
    return steps.map(function (p) { return +(100 * (1 + p / 100)).toFixed(3); });
  })();

  /* ---------- Decisions (per-bar agent decisions + debate + outcomes) ---------- */
  MOCK.decisions = [
    {
      agentId: "agt_aurora", bar: 1487, time: "2024-11-12 14:00 UTC",
      intent: "OPEN", direction: "LONG", asset: "MNTUSDT", sizeMUSD: 1.0,
      entry: 0.6412, sl: 0.6280, tp: 0.6710, leverage: 3, holdBars: 18,
      predictedPct: 4.2,
      riskVeto: { passed: true, reason: "Within 1.0 MUSD size cap and 3x leverage limit." },
      outcomePct: 4.65, thesisHash: "0xae12c4...90f3", verdictHash: "0x5b07d9...1c84",
      txHash: "0xd1f4a09c7e3b25d840a17cf83b9d0e25617ab4c902b8d0f5a17c4e93601d8a7c", settled: true,
      debate: {
        supporter: "MNT reclaimed the 0.638 pivot on rising hourly volume; momentum + funding flip favor continuation toward 0.671.",
        discriminator: "Breakout sits into a prior supply shelf at 0.668; thin order book risks a fakeout if BTC stalls.",
        judge: "Edge is real but capped. Approve LONG at reduced 3x with stop under the 0.628 reclaim level.",
        verdict: "APPROVED"
      }
    },
    {
      agentId: "agt_aurora", bar: 1502, time: "2024-11-13 05:00 UTC",
      intent: "OPEN", direction: "SHORT", asset: "MNTUSDT", sizeMUSD: 0.8,
      entry: 0.6695, sl: 0.6790, tp: 0.6510, leverage: 2, holdBars: 12,
      predictedPct: 2.6,
      riskVeto: { passed: false, reason: "Counter-trend short rejected: open LONG exposure + drawdown guard active." },
      outcomePct: 0.0, thesisHash: "0x7c19af...22e0", verdictHash: "0x9001ab...77d5",
      txHash: "0x83a0d5c2e9147b6f0a3e8c15d72b49608fae3017c6b2d495a8f0e31726d4c098", settled: true,
      debate: {
        supporter: "Rejection wick at 0.670 supply with bearish RSI divergence - short the failure back to 0.651.",
        discriminator: "Trend is up and we already hold a LONG; this is a hedge masquerading as a signal.",
        judge: "Conflicts with portfolio risk policy. Veto the short.",
        verdict: "VETOED"
      }
    },
    {
      agentId: "agt_obsidian", bar: 1455, time: "2024-11-10 22:00 UTC",
      intent: "OPEN", direction: "LONG", asset: "MNTUSDT", sizeMUSD: 1.0,
      entry: 0.6190, sl: 0.6075, tp: 0.6420, leverage: 2, holdBars: 24,
      predictedPct: 3.5,
      riskVeto: { passed: true, reason: "Risk checks passed (private policy)." },
      outcomePct: 3.10, thesisHash: "0x2bd840...51aa", verdictHash: "0xc40f17...8b32",
      txHash: "0x6d1f9a04c83e72b5061d9c47a2f08b3e95ca7016d3b8f249e0a51c6738b2d490", settled: true,
      debate: {
        supporter: "[strategy private - reasoning sealed until reveal]",
        discriminator: "[strategy private - reasoning sealed until reveal]",
        judge: "[strategy private - reasoning sealed until reveal]",
        verdict: "APPROVED"
      }
    },
    {
      agentId: "agt_helios", bar: 1510, time: "2024-11-13 18:00 UTC",
      intent: "OPEN", direction: "LONG", asset: "MNTUSDT", sizeMUSD: 0.5,
      entry: 0.6588, sl: 0.6490, tp: 0.6780, leverage: 4, holdBars: 10,
      predictedPct: 2.9,
      riskVeto: { passed: true, reason: "Within limits; volatility-scaled size applied." },
      outcomePct: -1.48, thesisHash: "0x4419fc...0d27", verdictHash: "0xe2a6d8...3b50",
      txHash: "0x1c6b9f04a37e2d85c019b4f7a6230e8d5fb1409c7e2a6d83b50f19c4ae7d2360", settled: true,
      debate: {
        supporter: "Clean ascending-triangle breakout at 0.659 - measured move targets 0.678.",
        discriminator: "Breakout volume is below average; BTC funding is rolling over.",
        judge: "Marginal. Approve at half size with a tight invalidation under 0.649.",
        verdict: "APPROVED"
      }
    },
    {
      agentId: "agt_nereid", bar: 1498, time: "2024-11-13 01:00 UTC",
      intent: "OPEN", direction: "SHORT", asset: "MNTUSDT", sizeMUSD: 0.6,
      entry: 0.6701, sl: 0.6795, tp: 0.6540, leverage: 2, holdBars: 16,
      predictedPct: 2.4,
      riskVeto: { passed: true, reason: "Mean-reversion size within band; passed." },
      outcomePct: 2.18, thesisHash: "0x88c5e1...44ab", verdictHash: "0x10de77...92c4",
      txHash: "0x2b8d0f5a17c4e93601d8a7c25f4b09e63dca10874e2b6f5908a1d3c64b7e0d92", settled: true,
      debate: {
        supporter: "Price is 2.3σ above the 96h mean into round-number 0.670 resistance - fade it.",
        discriminator: "Mean-reversion shorts in an uptrend bleed; ensure the stop is honored.",
        judge: "Approve small with a hard stop at 0.680.",
        verdict: "APPROVED"
      }
    }
  ];

  /* ---------- AI coach suggestions (v->v+1 improvements) ---------- */
  MOCK.coachSuggestions = [
    { target: "Risk · stop placement",
      suggestion: "Widen stop-loss from 1.9% to 2.6% ATR-scaled. 11 of your 38 losers were stopped within 2 bars of a winning reversal.",
      expectedDeltaPct: 3.1 },
    { target: "Sizing · volatility scaling",
      suggestion: "Cut position size by 40% when 24h realized vol exceeds the 80th percentile. Reduces tail drawdowns without hurting hit rate.",
      expectedDeltaPct: 1.8 },
    { target: "Entry · momentum filter",
      suggestion: "Require hourly volume above its 20-bar mean before opening LONGs. Removes 14 low-conviction trades that net negative.",
      expectedDeltaPct: 2.4 },
    { target: "Exit · profit lock",
      suggestion: "Trail the stop to breakeven after +1.5%. Converts 6 round-trip winners that gave back gains into booked profit.",
      expectedDeltaPct: 1.2 }
  ];

  /* ---------- Convenience: the demo's primary agent ---------- */
  MOCK.primaryAgentId = "agt_aurora";

  /* ---------- Version lineage (for versions.html) ---------- */
  MOCK.versions = [
    { id: "agt_aurora_v1", version: 1, label: "Aurora-Momentum v1", netReturnPct: 9.2,  winRatePct: 48.5, profitFactor: 1.41, trades: 70, grade: "fair",
      configHash: "0x11aa...c1", note: "Baseline momentum entries, fixed 2% stop, no vol scaling." },
    { id: "agt_aurora_v2", version: 2, label: "Aurora-Momentum v2", netReturnPct: 17.4, winRatePct: 53.1, profitFactor: 1.86, trades: 84, grade: "good",
      configHash: "0x22bb...d2", note: "Added volume filter on entries + ATR-scaled stop." },
    { id: "agt_aurora",    version: 3, label: "Aurora-Momentum v3", netReturnPct: 24.8, winRatePct: 58.2, profitFactor: 2.31, trades: 91, grade: "excellent",
      configHash: "0x4f8a...40", note: "Breakeven trailing stop + vol-scaled sizing. Current champion." }
  ];

  window.MOCK = MOCK;
})();
