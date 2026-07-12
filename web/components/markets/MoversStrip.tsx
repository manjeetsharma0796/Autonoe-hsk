"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./markets.module.css";
import type { TokenInfo } from "../../lib/api";
import { formatPrice } from "../../lib/format";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface MoversStripProps {
  tokens: TokenInfo[];
}

function tokenSlug(symbol: string): string {
  return symbol === "WMNT" ? "mUSD-WMNT" : `mUSD-${symbol}`;
}

function tokenGlyph(symbol: string): string {
  if (symbol === "BTC") return "₿";
  if (symbol === "ETH") return "Ξ";
  if (symbol === "WMNT") return "W";
  return symbol.slice(0, 2);
}

function tokenBadgeClass(symbol: string): string {
  if (symbol === "WMNT") return "mnt";
  if (symbol === "BTC") return "btc";
  if (symbol === "ETH") return "eth";
  return "";
}

function Card({
  token,
  direction,
}: {
  token: TokenInfo;
  direction: "up" | "down";
}) {
  const slug = tokenSlug(token.symbol);
  const pct = token.change24hPct;
  const sign = pct >= 0 ? "+" : "";

  return (
    <Link
      href={`/trade?pair=${slug}`}
      className={styles.gcard}
    >
      <span className={`b ${tokenBadgeClass(token.symbol)}`}>
        {tokenGlyph(token.symbol)}
      </span>
      <div className="meta">
        <div className="sname">mUSD/{token.symbol}</div>
        <div className="sp">{formatPrice(token.price)} USDT</div>
      </div>
      <div className={`chg ${direction}`}>
        {sign}{pct.toFixed(2)}%
      </div>
    </Link>
  );
}

export function MoversStrip({ tokens }: MoversStripProps) {
  const root = useRef<HTMLDivElement>(null);

  // top 3 gainers / losers derived from live data
  const { gainers, losers } = useMemo(() => {
    const sorted = [...tokens].sort((a, b) => b.change24hPct - a.change24hPct);
    return {
      gainers: sorted.filter((t) => t.change24hPct > 0).slice(0, 3),
      losers: sorted.filter((t) => t.change24hPct < 0).slice(-3).reverse(),
    };
  }, [tokens]);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || gainers.length + losers.length === 0) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        gsap.set(el, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" });
    },
    { scope: root, dependencies: [gainers.length, losers.length] },
  );

  if (tokens.length === 0) return null;

  return (
    <div ref={root} className={styles.stripwrap}>
      {gainers.length > 0 && (
        <>
          <div className={`${styles.striphead} ${styles.gain}`}>
            <span className="swatch" /> Top gainers · 24h
          </div>
          <div className={styles.strip}>
            {gainers.map((t) => (
              <Card key={t.symbol} token={t} direction="up" />
            ))}
          </div>
        </>
      )}

      {losers.length > 0 && (
        <>
          <div
            className={`${styles.striphead} ${styles.lose}`}
            style={{ marginTop: 26 }}
          >
            <span className="swatch" /> Top losers · 24h
          </div>
          <div className={styles.strip}>
            {losers.map((t) => (
              <Card key={t.symbol} token={t} direction="down" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
