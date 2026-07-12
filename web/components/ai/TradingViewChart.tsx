"use client";

/**
 * Embeds the TradingView Advanced Chart widget in an iframe.
 * No API key required — uses TradingView's public widgetembed endpoint.
 *
 * symbol: bare ticker, e.g. "SOL", "BTC"
 * exchange: defaults to "BYBIT" (matches our data source)
 * interval: candlestick interval in minutes as a string, or TV codes like "D", "W"
 */

import { useState } from "react";
import styles from "./tradingview.module.css";

export interface TradingViewSpec {
  symbol: string;
  exchange?: string;
  interval?: string;
  title?: string;
}

const INTERVAL_LABELS: Record<string, string> = {
  "1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
  "60": "1H", "120": "2H", "240": "4H", "D": "1D", "W": "1W",
};

// ── Mini Chart ─────────────────────────────────────────────────────────────────

export function TradingViewMini({ symbol, exchange = "BYBIT" }: { symbol: string; exchange?: string }) {
  const sym = symbol.trim().toUpperCase();
  const tvSym = sym.endsWith("USDT") ? sym : `${sym}USDT`;
  const config = JSON.stringify({
    symbol: `${exchange}:${tvSym}`,
    dateRange: "1M",
    colorTheme: "dark",
    trendLineColor: "rgba(41,98,255,1)",
    underLineColor: "rgba(41,98,255,0.3)",
    underLineBottomColor: "rgba(41,98,255,0)",
    isTransparent: true,
    autosize: true,
    largeChartUrl: "",
    locale: "en",
  });
  return (
    <figure className={styles.wrap} style={{ height: 180 }}>
      <div className={styles.head}>
        <span className={styles.logo}><svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#2962FF"/><path d="M4 13l3.5-5 3 3.5L13.5 7 17 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span className={styles.title}>{sym} · Mini Chart</span>
        <span className={styles.badge}>{exchange}</span>
        <span className={styles.live}>LIVE</span>
      </div>
      <iframe
        src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#${encodeURIComponent(config)}`}
        className={styles.frame}
        title={`TradingView mini chart for ${sym}`}
        allow="fullscreen"
        loading="lazy"
      />
    </figure>
  );
}

// ── Symbol Overview (multi-asset comparison strip) ─────────────────────────────

export function TradingViewSymbolOverview({ symbols, exchange = "BYBIT" }: { symbols: string[]; exchange?: string }) {
  const tvSymbols = symbols.map((s) => {
    const sym = s.trim().toUpperCase();
    const tv = sym.endsWith("USDT") ? sym : `${sym}USDT`;
    return [`${exchange}:${tv}|1D`, sym];
  });
  const config = JSON.stringify({
    symbols: tvSymbols,
    chartOnly: false,
    width: "100%",
    height: "100%",
    locale: "en",
    colorTheme: "dark",
    autosize: true,
    showVolume: false,
    showMA: false,
    hideDateRanges: false,
    hideMarketStatus: false,
    hideSymbolLogo: false,
    scalePosition: "right",
    scaleMode: "Normal",
    fontFamily: "Trebuchet MS, sans-serif",
    fontSize: "10",
    noTimeScale: false,
    valuesTracking: "1",
    changeMode: "price-and-percent",
    isTransparent: true,
  });
  return (
    <figure className={styles.wrap} style={{ height: 260 }}>
      <div className={styles.head}>
        <span className={styles.logo}><svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#2962FF"/><path d="M4 13l3.5-5 3 3.5L13.5 7 17 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span className={styles.title}>{symbols.map((s) => s.toUpperCase()).join(" vs ")} · Overview</span>
        <span className={styles.badge}>{exchange}</span>
        <span className={styles.live}>LIVE</span>
      </div>
      <iframe
        src={`https://s.tradingview.com/embed-widget/symbol-overview/?locale=en#${encodeURIComponent(config)}`}
        className={styles.frame}
        title={`TradingView symbol overview: ${symbols.join(", ")}`}
        allow="fullscreen"
        loading="lazy"
      />
    </figure>
  );
}

// ── Market Overview (crypto sector heatmap) ────────────────────────────────────

export function TradingViewMarket() {
  const config = JSON.stringify({
    colorTheme: "dark",
    dateRange: "12M",
    showChart: true,
    locale: "en",
    width: "100%",
    height: "100%",
    largeChartUrl: "",
    isTransparent: true,
    showSymbolLogo: false,
    showFloatingTooltip: false,
    plotLineColorGrowing: "rgba(41,98,255,1)",
    plotLineColorFalling: "rgba(41,98,255,1)",
    gridLineColor: "rgba(240,243,250,0)",
    scaleFontColor: "rgba(120,123,134,1)",
    belowLineFillColorGrowing: "rgba(41,98,255,0.12)",
    belowLineFillColorFalling: "rgba(41,98,255,0.02)",
    belowLineFillColorGrowingBottom: "rgba(41,98,255,0)",
    belowLineFillColorFallingBottom: "rgba(41,98,255,0)",
    symbolActiveColor: "rgba(41,98,255,0.12)",
    tabs: [
      {
        title: "Crypto",
        symbols: [
          { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
          { s: "BITSTAMP:ETHUSD", d: "Ethereum" },
          { s: "BITSTAMP:SOLUSD", d: "Solana" },
          { s: "BINANCE:BNBUSDT", d: "BNB" },
          { s: "BINANCE:XRPUSDT", d: "XRP" },
          { s: "BINANCE:SUIUSDT", d: "SUI" },
        ],
        originalTitle: "Crypto",
      },
    ],
  });
  return (
    <figure className={styles.wrap} style={{ height: 480 }}>
      <div className={styles.head}>
        <span className={styles.logo}><svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#2962FF"/><path d="M4 13l3.5-5 3 3.5L13.5 7 17 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span className={styles.title}>Crypto Market Overview</span>
        <span className={styles.live}>LIVE</span>
      </div>
      <iframe
        src={`https://s.tradingview.com/embed-widget/market-overview/?locale=en#${encodeURIComponent(config)}`}
        className={styles.frame}
        title="TradingView crypto market overview"
        allow="fullscreen"
        loading="lazy"
      />
    </figure>
  );
}

// ── Screener ───────────────────────────────────────────────────────────────────

export function TradingViewScreener() {
  const config = JSON.stringify({
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    defaultScreen: "top_gainers",
    market: "crypto",
    showToolbar: true,
    colorTheme: "dark",
    locale: "en",
    isTransparent: true,
  });
  return (
    <figure className={styles.wrap} style={{ height: 500 }}>
      <div className={styles.head}>
        <span className={styles.logo}><svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect width="18" height="18" rx="4" fill="#2962FF"/><path d="M4 13l3.5-5 3 3.5L13.5 7 17 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span className={styles.title}>Crypto Screener · Top Gainers</span>
        <span className={styles.live}>LIVE</span>
      </div>
      <iframe
        src={`https://s.tradingview.com/embed-widget/screener/?locale=en#${encodeURIComponent(config)}`}
        className={styles.frame}
        title="TradingView crypto screener"
        allow="fullscreen"
        loading="lazy"
      />
    </figure>
  );
}

// ── Advanced Chart ─────────────────────────────────────────────────────────────

export function TradingViewChart({ spec }: { spec: TradingViewSpec }) {
  const exchange = spec.exchange ?? "BYBIT";
  const symbol = spec.symbol.trim().toUpperCase();
  // Bybit uses SOLUSDT style; TradingView wants BYBIT:SOLUSDT
  const tvSymbol = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  const fullSymbol = `${exchange}:${tvSymbol}`;
  const interval = spec.interval ?? "60";
  const intervalLabel = INTERVAL_LABELS[interval] ?? interval;

  const src =
    `https://www.tradingview.com/widgetembed/?` +
    `symbol=${encodeURIComponent(fullSymbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&theme=dark` +
    `&style=1` +
    `&locale=en` +
    `&hide_top_toolbar=false` +
    `&hide_legend=false` +
    `&save_image=false` +
    `&calendar=false` +
    `&hide_volume=false`;

  const [expanded, setExpanded] = useState(false);

  return (
    <figure className={`${styles.wrap} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.head}>
        <span className={styles.logo}>
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect width="18" height="18" rx="4" fill="#2962FF" />
            <path d="M4 13l3.5-5 3 3.5L13.5 7 17 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.title}>
          {spec.title ?? `${symbol} · ${intervalLabel}`}
        </span>
        <span className={styles.badge}>{exchange}</span>
        <span className={styles.live}>LIVE</span>
        <button
          type="button"
          className={styles.expand}
          aria-label={expanded ? "Collapse chart" : "Expand chart"}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "↙" : "↗"}
        </button>
      </div>
      <iframe
        src={src}
        className={styles.frame}
        title={`TradingView chart for ${symbol}`}
        allow="fullscreen"
        loading="lazy"
      />
    </figure>
  );
}
