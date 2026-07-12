'use client';

/**
 * TradingView Advanced Chart widget - full default UI (timeframes, indicators,
 * drawing tools). Renders real market data for the asset's USDT pair. Used on
 * /trade and the /studio verdict view.
 */
import { useEffect, useRef } from 'react';

const TV_SYMBOL: Record<string, string> = {
  WHSK: 'BYBIT:MNTUSDT', // WHSK wraps HSK; chart uses MNTUSDT as proxy feed
  BTC: 'BYBIT:BTCUSDT',
  ETH: 'BYBIT:ETHUSDT',
  SUI: 'BYBIT:SUIUSDT',
  SOL: 'BYBIT:SOLUSDT',
};

// Prices come from Bybit spot, so point the chart at Bybit too — Binance lacks
// most of the long-tail meme tokens that show up in the markets list.
function tvSymbol(asset: string, bybitSymbol?: string): string {
  if (bybitSymbol) return `BYBIT:${bybitSymbol.toUpperCase()}`;
  return TV_SYMBOL[asset] ?? `BYBIT:${asset.toUpperCase()}USDT`;
}

export interface TradingViewChartProps {
  asset: string;
  /** Exact Bybit spot ticker (e.g. "PEPEUSDT"). Preferred over the asset map when present. */
  bybitSymbol?: string;
  /** Pixel height (number) or any CSS height string ('100%', 'min(78vh,860px)'…). */
  height?: number | string;
  interval?: string; // '60', 'D', etc.
}

export function TradingViewChart({ asset, bybitSymbol, height = 460, interval = '60' }: TradingViewChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    host.appendChild(widget);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol(asset, bybitSymbol),
      interval,
      theme: 'dark',
      style: '1',
      timezone: 'Etc/UTC',
      locale: 'en',
      autosize: true,
      allow_symbol_change: true,
      withdateranges: true,
      hide_side_toolbar: false,
      details: false,
      backgroundColor: 'rgba(11, 14, 20, 1)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
    });
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
    };
  }, [asset, bybitSymbol, interval]);

  return (
    <div
      className="tradingview-widget-container"
      ref={ref}
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
