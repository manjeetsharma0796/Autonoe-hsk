"use client";

import Link from "next/link";
import s from "./landing.module.css";
import { useReveal } from "./useReveal";
import { useSymbols } from "@/lib/useSymbols";

// Static fallback shown while live data loads (preserves SSR paint).
const STATIC_MARKETS = [
  {
    badge: "W",
    name: "WMNT",
    desc: "Wrapped Mantle",
    price: "-",
    change: "-",
    dir: "up" as const,
    points: "0,26 28,22 56,24 84,16 112,18 140,9 168,12 200,5",
  },
  {
    badge: "₿",
    name: "BTC",
    desc: "Bitcoin",
    price: "-",
    change: "-",
    dir: "down" as const,
    points: "0,8 28,12 56,10 84,16 112,14 140,20 168,18 200,24",
  },
  {
    badge: "Ξ",
    name: "ETH",
    desc: "Ether",
    price: "-",
    change: "-",
    dir: "up" as const,
    points: "0,20 28,18 56,21 84,13 112,15 140,12 168,8 200,10",
  },
];

const BADGES: Record<string, string> = { BTC: "₿", ETH: "Ξ", WMNT: "W" };
const DESCS: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ether",
  WMNT: "Wrapped Mantle",
  SOL: "Solana",
  SUI: "Sui",
};

/**
 * Generate a rough SVG sparkline from a 24h change pct.
 * Real sparklines would need candle data; this produces a directional wiggle
 * consistent with the observed change direction.
 */
function mockSparkline(changePct: number): string {
  const up = changePct >= 0;
  // 8 points across 200px wide, 0–34 y range (lower y = higher price)
  const base = up ? 26 : 8;
  const end = up ? 5 : 24;
  const pts = Array.from({ length: 8 }, (_, i) => {
    const x = Math.round((i / 7) * 200);
    const frac = i / 7;
    const trend = base + (end - base) * frac;
    // add small noise
    const noise = (Math.sin(i * 2.3) * 4);
    const y = Math.max(2, Math.min(32, Math.round(trend + noise)));
    return `${x},${y}`;
  });
  return pts.join(" ");
}

export function MarketsPreview() {
  const root = useReveal(s.reveal);
  // Show top 5 by volume; WMNT (onchain) should appear if in range
  const { tokens, loading } = useSymbols(5);

  const markets = loading || tokens.length === 0
    ? STATIC_MARKETS
    : tokens.map((t) => {
        const ch = t.change24hPct;
        const dir = ch >= 0 ? ("up" as const) : ("down" as const);
        return {
          badge: BADGES[t.symbol] ?? t.symbol[0],
          name: t.symbol,
          desc: DESCS[t.symbol] ?? t.symbol,
          price: t.price.toLocaleString(undefined, {
            maximumFractionDigits: t.price < 10 ? 4 : 2,
          }),
          change: `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`,
          dir,
          points: mockSparkline(ch),
        };
      });

  return (
    <section ref={root} id="markets" className={`${s.section} wrap`}>
      <div className={s.reveal}>
        <span className="tag">Markets</span>
        <h2 className="h2">Trade against mUSD.</h2>
        <p className="sub">
          One synthetic dollar, every pair. Pick a market and the terminal - and
          the tribunal - are one click away.
        </p>
      </div>

      <div className={`${s.mk} ${s.reveal}`}>
        <div className={`${s.mrow} ${s.mhead}`}>
          <div>Market</div>
          <div>Price (mUSD)</div>
          <div>24h</div>
          <div>Last 7d</div>
        </div>

        {markets.map((m) => (
          <Link
            href="/trade"
            className={`${s.mrow} ${s.mlink}`}
            key={m.name}
          >
            <div className={s.sym}>
              <span className={s.symB}>{m.badge}</span>
              <div>
                {m.name} <small>{m.desc}</small>
              </div>
            </div>
            <div className={s.px}>{m.price}</div>
            <div className={`${s.px} ${m.dir === "up" ? s.up : s.down}`}>
              {m.change}
            </div>
            <svg
              className={s.spark}
              viewBox="0 0 200 34"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke={m.dir === "up" ? "#3FE0A6" : "#FF6B6B"}
                strokeWidth="2"
                points={m.points}
              />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
