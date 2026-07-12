"use client";

/**
 * Lightweight, dependency-free SVG charts for inline AI output.
 * Rendered from fenced ```chart / ```heatmap blocks the model emits.
 */
import React from "react";
import {
  TradingViewChart,
  TradingViewMini,
  TradingViewSymbolOverview,
  TradingViewMarket,
  TradingViewScreener,
  type TradingViewSpec,
} from "./TradingViewChart";

type BarPoint = { label: string; value: number };
type ChartSpec = {
  type?: "bar" | "line";
  title?: string;
  unit?: string;
  data: BarPoint[] | number[];
};

function toPoints(data: BarPoint[] | number[]): BarPoint[] {
  if (!Array.isArray(data)) return [];
  if (typeof data[0] === "number") {
    return (data as number[]).map((v, i) => ({ label: String(i + 1), value: v }));
  }
  return (data as BarPoint[]).filter((d) => d && typeof d.value === "number");
}

export function MiniChart({ spec }: { spec: ChartSpec }) {
  const pts = toPoints(spec.data);
  if (!pts.length) return null;
  const type = spec.type === "line" ? "line" : "bar";
  const unit = spec.unit ?? "";
  const W = 520;
  const H = 200;
  const padL = 40;
  const padB = 28;
  const padT = 12;
  const plotW = W - padL - 12;
  const plotH = H - padB - padT;
  const max = Math.max(...pts.map((p) => p.value), 0);
  const min = Math.min(...pts.map((p) => p.value), 0);
  const range = max - min || 1;
  const y = (v: number) => padT + plotH - ((v - min) / range) * plotH;
  const zeroY = y(0);

  return (
    <figure className="md-chart">
      {spec.title && <figcaption className="md-chart-title">{spec.title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={spec.title || "chart"}>
        {/* zero / baseline */}
        <line x1={padL} y1={zeroY} x2={W - 12} y2={zeroY} stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        {[max, (max + min) / 2, min].map((v, i) => (
          <text key={i} x={padL - 6} y={y(v) + 3} textAnchor="end" className="md-chart-axis">
            {v.toFixed(0)}
            {unit}
          </text>
        ))}

        {type === "bar"
          ? pts.map((p, i) => {
              const bw = plotW / pts.length;
              const x = padL + i * bw + bw * 0.18;
              const w = bw * 0.64;
              const top = Math.min(y(p.value), zeroY);
              const h = Math.abs(zeroY - y(p.value));
              const up = p.value >= 0;
              return (
                <g key={i}>
                  <rect x={x} y={top} width={w} height={Math.max(h, 1)} rx="2" fill={up ? "var(--green)" : "var(--red)"} opacity="0.85" />
                  <text x={x + w / 2} y={H - 10} textAnchor="middle" className="md-chart-axis">
                    {p.label}
                  </text>
                </g>
              );
            })
          : (() => {
              const bw = plotW / Math.max(pts.length - 1, 1);
              const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${padL + i * bw} ${y(p.value)}`).join(" ");
              const area = `${path} L ${padL + (pts.length - 1) * bw} ${zeroY} L ${padL} ${zeroY} Z`;
              return (
                <g>
                  <path d={area} fill="url(#mc-grad)" opacity="0.5" />
                  <path d={path} fill="none" stroke="var(--gold2)" strokeWidth="2" />
                  <defs>
                    <linearGradient id="mc-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {pts.map((p, i) => (
                    <text key={i} x={padL + i * bw} y={H - 10} textAnchor="middle" className="md-chart-axis">
                      {p.label}
                    </text>
                  ))}
                </g>
              );
            })()}
      </svg>
    </figure>
  );
}

type HeatSpec = {
  title?: string;
  x: string[];
  y: string[];
  values: number[][];
};

function heatColor(t: number): string {
  // t in 0..1: deep red (0) → neutral grey (0.5) → bright green (1)
  if (t < 0.5) {
    const k = t / 0.5; // 0→1
    // red at 0, blends to a dark grey/neutral at 0.5
    const r = Math.round(220 - 60 * k);
    const g = Math.round(60 + 60 * k);
    const b = Math.round(60 + 60 * k);
    return `rgba(${r},${g},${b},${0.25 + 0.55 * (1 - k)})`;
  }
  const k = (t - 0.5) / 0.5; // 0→1
  // neutral at 0.5, bright green at 1
  const r = Math.round(40 - 20 * k);
  const g = Math.round(160 + 64 * k);
  const b = Math.round(120 - 20 * k);
  return `rgba(${r},${g},${b},${0.2 + 0.6 * k})`;
}

export function Heatmap({ spec }: { spec: HeatSpec }) {
  if (!spec?.values?.length || !spec.x?.length) return null;
  const flat = spec.values.flat().filter((v) => typeof v === "number");
  const max = Math.max(...flat);
  const min = Math.min(...flat);
  const range = max - min || 1;

  // Build 5-step legend ticks
  const legendSteps = 5;
  const legendTicks = Array.from({ length: legendSteps }, (_, i) => {
    const t = i / (legendSteps - 1);
    return { t, val: (min + t * range).toFixed(2) };
  });

  return (
    <figure className="md-heatmap">
      {spec.title && <figcaption className="md-chart-title">{spec.title}</figcaption>}
      <div
        className="md-heat-grid"
        style={{ gridTemplateColumns: `minmax(64px,auto) repeat(${spec.x.length}, minmax(52px, 1fr))` }}
      >
        <div className="md-heat-corner" />
        {spec.x.map((c) => (
          <div key={c} className="md-heat-colh">
            {c}
          </div>
        ))}
        {spec.y.map((rlabel, r) => (
          <React.Fragment key={rlabel}>
            <div className="md-heat-rowh">{rlabel}</div>
            {spec.x.map((_, c) => {
              const v = spec.values[r]?.[c];
              const t = typeof v === "number" ? (v - min) / range : 0;
              const formatted = typeof v === "number" ? (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) : "";
              return (
                <div
                  key={c}
                  className="md-heat-cell"
                  style={{ background: heatColor(t) }}
                  title={`${rlabel} / ${spec.x[c]}: ${v}`}
                >
                  {formatted}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {/* Color scale legend */}
      <div className="md-heat-legend">
        <div className="md-heat-legend-bar" />
        <div className="md-heat-legend-ticks">
          {legendTicks.map(({ t, val }) => (
            <span key={t} style={{ left: `${t * 100}%` }}>{val}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}

type FlowPoint = { label: string; inflow: number; outflow: number };
type FlowSpec = {
  title?: string;
  unit?: string;
  data: FlowPoint[];
};

export function FlowChart({ spec }: { spec: FlowSpec }) {
  if (!spec?.data?.length) return null;
  const pts = spec.data.filter((d) => d && typeof d.inflow === "number" && typeof d.outflow === "number");
  if (!pts.length) return null;
  const unit = spec.unit ?? "";
  const W = 520;
  const H = 200;
  const padL = 48;
  const padB = 28;
  const padT = 12;
  const plotW = W - padL - 12;
  const plotH = H - padB - padT;
  const allVals = pts.flatMap((p) => [p.inflow, p.outflow]);
  const max = Math.max(...allVals, 0);
  const min = Math.min(...allVals, 0);
  const range = max - min || 1;
  const barW = plotW / pts.length;
  const halfBar = barW * 0.3;
  const y = (v: number) => padT + plotH - ((v - min) / range) * plotH;
  const zeroY = y(0);

  return (
    <figure className="md-chart">
      {spec.title && <figcaption className="md-chart-title">{spec.title}</figcaption>}
      <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 11, fontFamily: "var(--mono)", color: "var(--faint)" }}>
        <span style={{ color: "var(--green)" }}>▬ Inflow</span>
        <span style={{ color: "var(--red)" }}>▬ Outflow</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={spec.title || "flow chart"}>
        <line x1={padL} y1={zeroY} x2={W - 12} y2={zeroY} stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        {[max, (max + min) / 2, min].map((v, i) => (
          <text key={i} x={padL - 6} y={y(v) + 3} textAnchor="end" className="md-chart-axis">
            {v.toFixed(0)}{unit}
          </text>
        ))}
        {pts.map((p, i) => {
          const cx = padL + i * barW + barW / 2;
          const inTop = Math.min(y(p.inflow), zeroY);
          const inH = Math.abs(zeroY - y(p.inflow));
          const outTop = Math.min(y(p.outflow), zeroY);
          const outH = Math.abs(zeroY - y(p.outflow));
          return (
            <g key={i}>
              <rect x={cx - halfBar - 1} y={inTop} width={halfBar} height={Math.max(inH, 1)} rx="2" fill="var(--green)" opacity="0.8" />
              <rect x={cx + 1} y={outTop} width={halfBar} height={Math.max(outH, 1)} rx="2" fill="var(--red)" opacity="0.8" />
              <text x={cx} y={H - 10} textAnchor="middle" className="md-chart-axis">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Parse a fenced block body into a chart/heatmap/tradingview node, or null if invalid. */
export function renderFenced(lang: string, body: string, key: string): React.ReactNode | null {
  // TradingView: body is JSON spec OR bare ticker symbol for convenience
  if (lang === "tradingview" || lang === "tv") {
    let spec: TradingViewSpec;
    try {
      spec = JSON.parse(body.trim()) as TradingViewSpec;
    } catch {
      // Accept bare ticker: ```tradingview\nSOL\n```
      const sym = body.trim().toUpperCase();
      if (!sym) return null;
      spec = { symbol: sym };
    }
    return <TradingViewChart key={key} spec={spec} />;
  }

  let spec: unknown;
  try {
    spec = JSON.parse(body);
  } catch {
    return null;
  }
  if (lang === "heatmap") return <Heatmap key={key} spec={spec as HeatSpec} />;
  if (lang === "inflow" || lang === "outflow" || lang === "flow") {
    return <FlowChart key={key} spec={spec as FlowSpec} />;
  }
  if (lang === "chart" || lang === "bar" || lang === "line") {
    const s = spec as ChartSpec;
    if (lang !== "chart" && !s.type) s.type = lang as "bar" | "line";
    return <MiniChart key={key} spec={s} />;
  }
  if (lang === "tv-mini") {
    const s = spec as { symbol?: string; exchange?: string };
    const sym = s.symbol ?? body.trim().toUpperCase();
    if (!sym) return null;
    return <TradingViewMini key={key} symbol={sym} exchange={s.exchange} />;
  }
  if (lang === "tv-overview") {
    const s = spec as { symbols?: string[]; exchange?: string };
    const syms = s.symbols ?? [];
    if (!syms.length) return null;
    return <TradingViewSymbolOverview key={key} symbols={syms} exchange={s.exchange} />;
  }
  if (lang === "tv-market") {
    return <TradingViewMarket key={key} />;
  }
  if (lang === "tv-screener") {
    return <TradingViewScreener key={key} />;
  }
  return null;
}
