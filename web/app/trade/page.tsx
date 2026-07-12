"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/components/trade/trade.css";
import { PAIRS, type Pair } from "@/components/trade/data";
import { ChartPanel } from "@/components/trade/ChartPanel";
import { SwapBox } from "@/components/trade/SwapBox";
import { Balances } from "@/components/trade/Balances";
import { AiRail } from "@/components/trade/AiRail";
import { useSymbols } from "@/lib/useSymbols";
import type { TokenInfo } from "@/lib/useSymbols";
import { getSymbols } from "@/lib/api";
import { formatPrice } from "@/lib/format";

/** Map a live TokenInfo to the Pair shape used by trade components. */
function tokenToPair(t: TokenInfo): Pair {
  // Badge: first letter, with special characters for well-known tokens.
  const BADGES: Record<string, string> = { BTC: "₿", ETH: "Ξ", WMNT: "W" };
  const SUBS: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ether",
    WMNT: "Wrapped Mantle",
    SOL: "Solana",
    SUI: "Sui",
  };
  const ch = Math.abs(t.change24hPct);
  return {
    sym: t.symbol,
    badge: BADGES[t.symbol] ?? t.symbol[0],
    sub: SUBS[t.symbol] ?? t.symbol,
    bybitSymbol: t.bybitSymbol,
    px: formatPrice(t.price),
    pxNum: t.price,
    ch: `${ch.toFixed(2)}%`,
    dir: t.change24hPct >= 0 ? "up" : "down",
    // rate: how many tokens you get per 1 mUSD (approximated as 1/price since mUSD ≈ $1)
    rate: t.price > 0 ? 1 / t.price : 0,
  };
}

/** Parse the `?pair=mUSD-SYM` slug → bare symbol. Defaults to WMNT. */
function symFromSlug(slug: string | null): string {
  if (!slug) return "WMNT";
  const m = slug.match(/^mUSD-(.+)$/i);
  return (m ? m[1] : slug).toUpperCase();
}

function TradeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlSym = symFromSlug(params.get("pair"));

  const { tokens, loading } = useSymbols(80);
  const [pairSym, setPairSym] = useState(urlSym);
  // A token deep-linked or searched for that isn't in the loaded top-80.
  const [extraPair, setExtraPair] = useState<Pair | null>(null);

  // Follow the URL param (handles back/forward and external links).
  useEffect(() => {
    setPairSym(urlSym);
  }, [urlSym]);

  // Derive live pairs; while loading use the static fallback so UI is never empty.
  const livePairs: Pair[] = useMemo(() => {
    if (tokens.length === 0) return PAIRS;
    return tokens.slice(0, 80).map(tokenToPair);
  }, [tokens]);

  // If the selected symbol isn't in the loaded list, fetch it so deep-links to
  // long-tail tokens (and picker searches) resolve to the right asset.
  useEffect(() => {
    if (!pairSym) return;
    if (livePairs.some((p) => p.sym === pairSym)) {
      setExtraPair(null);
      return;
    }
    if (extraPair?.sym === pairSym) return;
    let cancelled = false;
    getSymbols(pairSym, 20)
      .then((data) => {
        const hit = data.find((t) => t.symbol === pairSym) ?? data[0];
        if (!cancelled && hit) setExtraPair(tokenToPair(hit));
      })
      .catch(() => {
        // leave the fallback in place
      });
    return () => {
      cancelled = true;
    };
  }, [pairSym, livePairs, extraPair]);

  // Resolve the active pair: prefer the loaded list, then a fetched extra, then
  // a sensible fallback (never the highest-volume meme coin by accident).
  const pair =
    livePairs.find((p) => p.sym === pairSym) ??
    (extraPair && extraPair.sym === pairSym ? extraPair : null) ??
    livePairs[0] ??
    PAIRS[0];

  // The selector list — include the fetched extra pair at the top if present.
  const pairsForSelector = useMemo(() => {
    if (extraPair && !livePairs.some((p) => p.sym === extraPair.sym)) {
      return [extraPair, ...livePairs];
    }
    return livePairs;
  }, [extraPair, livePairs]);

  const selectPair = useCallback(
    (sym: string) => {
      setPairSym(sym);
      router.replace(`/trade?pair=mUSD-${sym}`, { scroll: false });
    },
    [router],
  );

  return (
    <main className="trade-root">
      <div className="terminal wrap-wide">
        <div className="crumbs">
          <span className="tag">Terminal</span>
          <span className="ttl">Trade</span>
          <span className="spacer" />
          <span className="badge">
            {loading ? (
              <span className="ping" />
            ) : (
              <span className="ping" style={{ background: "#3FE0A6" }} />
            )}{" "}
            Mantle Sepolia · testnet
          </span>
        </div>

        <div className="grid">
          {/* LEFT: chart + swap + balances */}
          <div className="left">
            <ChartPanel
              pair={pair}
              pairs={pairsForSelector}
              onSelectPair={selectPair}
            />
            <SwapBox pair={pair} />
            <Balances />
          </div>

          {/* RIGHT: AI rail */}
          <AiRail />
        </div>

        <footer className="tfoot">
          <div className="brand">
            <span className="dot" /> AUTONOE
          </div>
          <div>
            Built for the Mantle Turing Test 2026 · testnet · not financial advice
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<main className="trade-root" />}>
      <TradeInner />
    </Suspense>
  );
}
