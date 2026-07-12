"use client";

import { useState, useCallback } from "react";
import type { Candle } from "@/lib/api";

// ── constants ──────────────────────────────────────────────────────────────────

const GREEN = "#3FE0A6";
const RED = "#FF6B6B";
const GOLD = "#F5A524";
const GOLD2 = "#FFCC66";
const VIOLET2 = "#A78BFA";

const PAD_L = 8;
const PAD_R = 56; // space for y-axis labels
const PAD_T = 12;
const PAD_B = 28; // space for x-axis labels

// ── types ─────────────────────────────────────────────────────────────────────

export interface PredictionBand {
  entryPrice: number;
  lowPct: number;
  highPct: number;
  targetPct?: number;
}

export interface PredictionChartProps {
  candles: Candle[];
  band?: PredictionBand;
  /** SVG viewBox width. Default 880. */
  width?: number;
  /** SVG viewBox height. Default 320. */
  height?: number;
  /** Show hover tooltip. Default true. */
  tooltip?: boolean;
  className?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── component ─────────────────────────────────────────────────────────────────

export function PredictionChart({
  candles,
  band,
  width = 880,
  height = 320,
  tooltip = true,
  className,
}: PredictionChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const chartW = width - PAD_L - PAD_R;
  const chartH = height - PAD_T - PAD_B;

  // Determine price range from candles + band bounds
  const allPrices: number[] = [];
  for (const c of candles) {
    allPrices.push(c.high, c.low);
  }
  if (band) {
    const lo = band.entryPrice * (1 + band.lowPct / 100);
    const hi = band.entryPrice * (1 + band.highPct / 100);
    allPrices.push(lo, hi, band.entryPrice);
    if (band.targetPct !== undefined) {
      allPrices.push(band.entryPrice * (1 + band.targetPct / 100));
    }
  }

  if (allPrices.length === 0) {
    return (
      <div className={className} style={{ position: "relative", color: "var(--faint)", fontSize: 13, padding: "20px 0" }}>
        No candle data
      </div>
    );
  }

  const priceMin = Math.min(...allPrices);
  const priceMax = Math.max(...allPrices);
  const priceRange = priceMax - priceMin || 1;
  // Add 8% padding top/bottom so candles don't sit on the edge
  const padded = priceRange * 0.08;
  const yMin = priceMin - padded;
  const yMax = priceMax + padded;
  const yRange = yMax - yMin;

  const toY = (price: number) => PAD_T + ((yMax - price) / yRange) * chartH;
  const toX = (i: number) => {
    if (candles.length <= 1) return PAD_L + chartW / 2;
    return PAD_L + (i / (candles.length - 1)) * chartW;
  };

  // Candle body width
  const bw = Math.max(2, Math.min(14, chartW / Math.max(candles.length, 1) * 0.6));

  // Y-axis grid lines (4 lines)
  const gridLines = 4;
  const gridPrices: number[] = [];
  for (let i = 0; i <= gridLines; i++) {
    gridPrices.push(yMin + (yRange * i) / gridLines);
  }

  // X-axis time labels (show ~5 labels)
  const xLabelCount = Math.min(5, candles.length);
  const xLabelIndices: number[] = [];
  for (let i = 0; i < xLabelCount; i++) {
    xLabelIndices.push(Math.round((i / (xLabelCount - 1)) * (candles.length - 1)));
  }

  // Band geometry
  let bandEl: React.ReactNode = null;
  if (band && candles.length > 0) {
    const loPrice = band.entryPrice * (1 + band.lowPct / 100);
    const hiPrice = band.entryPrice * (1 + band.highPct / 100);
    const yBandTop = toY(Math.max(loPrice, hiPrice));
    const yBandBot = toY(Math.min(loPrice, hiPrice));
    const yEntry = toY(band.entryPrice);
    const yTarget =
      band.targetPct !== undefined
        ? toY(band.entryPrice * (1 + band.targetPct / 100))
        : null;

    const bandX = PAD_L;
    const bandW = chartW;

    bandEl = (
      <g>
        {/* Shaded return band */}
        <rect
          x={bandX}
          y={yBandTop}
          width={bandW}
          height={Math.max(1, yBandBot - yBandTop)}
          fill={GOLD}
          fillOpacity={0.08}
        />
        <line
          x1={bandX}
          x2={bandX + bandW}
          y1={yBandTop}
          y2={yBandTop}
          stroke={GOLD}
          strokeWidth={0.8}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />
        <line
          x1={bandX}
          x2={bandX + bandW}
          y1={yBandBot}
          y2={yBandBot}
          stroke={GOLD}
          strokeWidth={0.8}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />
        {/* Entry price line */}
        <line
          x1={bandX}
          x2={bandX + bandW}
          y1={yEntry}
          y2={yEntry}
          stroke={GOLD2}
          strokeWidth={1.2}
          strokeDasharray="3 5"
          strokeOpacity={0.75}
        />
        <text
          x={bandX + bandW + 3}
          y={yEntry + 4}
          fontSize={9}
          fill={GOLD2}
          fillOpacity={0.9}
          fontFamily="var(--mono, monospace)"
        >
          entry
        </text>
        {/* Optional target marker */}
        {yTarget !== null && (
          <>
            <line
              x1={bandX}
              x2={bandX + bandW}
              y1={yTarget}
              y2={yTarget}
              stroke={VIOLET2}
              strokeWidth={1}
              strokeDasharray="2 4"
              strokeOpacity={0.8}
            />
            <text
              x={bandX + bandW + 3}
              y={yTarget + 4}
              fontSize={9}
              fill={VIOLET2}
              fillOpacity={0.9}
              fontFamily="var(--mono, monospace)"
            >
              tgt
            </text>
          </>
        )}
      </g>
    );
  }

  // Hover state
  const hoveredCandle = hovered !== null ? candles[hovered] : null;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!tooltip || candles.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * width;
      const chartX = svgX - PAD_L;
      const idx = Math.round((chartX / chartW) * (candles.length - 1));
      setHovered(Math.max(0, Math.min(candles.length - 1, idx)));
    },
    [tooltip, candles.length, width, chartW],
  );

  const handleMouseLeave = useCallback(() => setHovered(null), []);

  // Tooltip position
  let tipX = 0;
  let tipY = 0;
  if (hovered !== null) {
    tipX = toX(hovered);
    tipY = PAD_T;
  }

  return (
    <div className={className} style={{ position: "relative", lineHeight: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        role="img"
        aria-label="Candlestick price chart"
        onMouseMove={tooltip ? handleMouseMove : undefined}
        onMouseLeave={tooltip ? handleMouseLeave : undefined}
      >
        <defs>
          <clipPath id="pc-clip">
            <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        <g>
          {gridPrices.map((p, i) => {
            const y = toY(p);
            return (
              <g key={i}>
                <line
                  x1={PAD_L}
                  x2={PAD_L + chartW}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_L + chartW + 4}
                  y={y + 4}
                  fontSize={9}
                  fill="var(--faint, rgba(255,255,255,0.35))"
                  fontFamily="var(--mono, monospace)"
                >
                  {fmt(p)}
                </text>
              </g>
            );
          })}
        </g>

        {/* X-axis time labels */}
        <g>
          {xLabelIndices.map((idx) => {
            const c = candles[idx];
            if (!c) return null;
            const x = toX(idx);
            const label =
              c.time > 1e12
                ? fmtTime(c.time) || fmtDate(c.time)
                : fmtDate(c.time * 1000);
            return (
              <text
                key={idx}
                x={x}
                y={height - 6}
                fontSize={9}
                fill="var(--faint, rgba(255,255,255,0.35))"
                fontFamily="var(--mono, monospace)"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </g>

        {/* Band (behind candles) */}
        <g clipPath="url(#pc-clip)">{bandEl}</g>

        {/* Candles */}
        <g clipPath="url(#pc-clip)">
          {candles.map((c, i) => {
            const up = c.close >= c.open;
            const col = up ? GREEN : RED;
            const x = toX(i);
            const yOpen = toY(c.open);
            const yClose = toY(c.close);
            const yHigh = toY(c.high);
            const yLow = toY(c.low);
            const top = Math.min(yOpen, yClose);
            const bot = Math.max(yOpen, yClose);
            const isHovered = hovered === i;

            return (
              <g key={i} opacity={isHovered ? 1 : 0.88}>
                {/* Wick */}
                <line
                  x1={x}
                  x2={x}
                  y1={yHigh}
                  y2={yLow}
                  stroke={col}
                  strokeWidth={1.2}
                  strokeOpacity={0.8}
                />
                {/* Body */}
                <rect
                  x={x - bw / 2}
                  y={top}
                  width={bw}
                  height={Math.max(1.5, bot - top)}
                  rx={1}
                  fill={col}
                  fillOpacity={isHovered ? 1 : 0.85}
                />
              </g>
            );
          })}
        </g>

        {/* Hover crosshair */}
        {hovered !== null && (
          <g>
            <line
              x1={toX(hovered)}
              x2={toX(hovered)}
              y1={PAD_T}
              y2={PAD_T + chartH}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </g>
        )}

        {/* Hover tooltip */}
        {hoveredCandle !== null && hovered !== null && (
          <g>
            {(() => {
              const tx = Math.min(tipX + 8, width - 130);
              const ty = tipY + 4;
              const up = hoveredCandle.close >= hoveredCandle.open;
              const col = up ? GREEN : RED;
              const lines = [
                `O ${fmt(hoveredCandle.open)}`,
                `H ${fmt(hoveredCandle.high)}`,
                `L ${fmt(hoveredCandle.low)}`,
                `C ${fmt(hoveredCandle.close)}`,
              ];
              return (
                <>
                  <rect
                    x={tx}
                    y={ty}
                    width={118}
                    height={68}
                    rx={6}
                    fill="rgba(12,17,28,0.88)"
                    stroke={col}
                    strokeWidth={0.8}
                    strokeOpacity={0.5}
                  />
                  {lines.map((l, li) => (
                    <text
                      key={li}
                      x={tx + 8}
                      y={ty + 16 + li * 13}
                      fontSize={10}
                      fill="var(--ink, #f0f0f0)"
                      fontFamily="var(--mono, monospace)"
                    >
                      {l}
                    </text>
                  ))}
                </>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
