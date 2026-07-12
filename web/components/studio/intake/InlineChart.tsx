"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { getCandles } from "@/lib/api";
import styles from "./IntakeChat.module.css";

const W = 600;
const H = 148;
const PAD_L = 58;   // room for "$1234.5" Y-axis labels
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 24;

function assetSeed(a: string): number {
  let s = 0;
  for (const c of a) s += c.charCodeAt(0);
  return s % 7;
}

function mockSeries(label: string): number[] {
  const seed = assetSeed(label);
  const pts: number[] = [];
  let v = 50;
  for (let i = 0; i < 48; i++) {
    v += Math.sin(i / 5 + seed) * 3.2 + Math.sin(i / 13 + seed * 1.7) * 2 + (seed - 3) * 0.35;
    pts.push(v);
  }
  return pts;
}

function fmtPrice(v: number): string {
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 1000) return `$${v.toFixed(0)}`;
  if (v >= 100) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}

let gradN = 0;

export function InlineChart({ assetLabel }: { assetLabel: string }) {
  const [pts, setPts] = useState<number[] | null>(null);
  const [gradId] = useState(() => `icg-${gradN++}`);
  const [hover, setHover] = useState<{ x: number; y: number; price: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Capture "now" once so all timestamps are consistent for this chart instance.
  const nowRef = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    const bybitSymbol = `${assetLabel.toUpperCase()}USDT`;
    getCandles(bybitSymbol, "60", 48)
      .then((candles) => {
        if (!alive) return;
        setPts(candles && candles.length >= 8 ? candles.map((c) => c.close) : mockSeries(assetLabel));
      })
      .catch(() => { if (alive) setPts(mockSeries(assetLabel)); });
    return () => { alive = false; };
  }, [assetLabel]);

  // Derive all chart geometry — must run every render (before any early return)
  // so hook call order is stable.
  const derived = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    const N = pts.length;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const rng = max - min || 1;
    const up = pts[N - 1] >= pts[0];
    const col = up ? "var(--green)" : "var(--red)";
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const sx = (i: number) => PAD_L + (i / (N - 1)) * plotW;
    const sy = (v: number) => PAD_T + (1 - (v - min) / rng) * plotH;
    const line = pts.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
    const area = `${line} L${sx(N - 1).toFixed(1)} ${H - PAD_B} L${sx(0).toFixed(1)} ${H - PAD_B} Z`;
    const delta = ((pts[N - 1] - pts[0]) / pts[0]) * 100;
    const yTicks = [0, 1, 2, 3].map((i) => ({ v: min + (i / 3) * rng, y: sy(min + (i / 3) * rng) }));
    const now = nowRef.current;
    const hourMs = 60 * 60 * 1000;
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const step = Math.floor(N / 4);
    const xTicks = [0, step, step * 2, step * 3, N - 1].map((i) => {
      const hoursBack = N - 1 - i;
      const d = new Date(now - hoursBack * hourMs);
      const label = i === N - 1 ? "now" : i === 0 ? fmt.format(d) : fmtTime.format(d);
      return { i, x: sx(i), label };
    });
    return { N, min, max, rng, up, col, plotW, plotH, sx, sy, line, area, delta, yTicks, xTicks };
  }, [pts]);

  if (!pts || !derived) {
    return (
      <div className={styles.inlinechart}>
        <div className={styles.icLoad}>pulling {assetLabel} from Bybit…</div>
      </div>
    );
  }

  const { N, up, col, plotW, sx, sy, line, area, delta, yTicks, xTicks } = derived;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * W;
    const relX = rawX - PAD_L;
    const idx = Math.max(0, Math.min(N - 1, Math.round((relX / plotW) * (N - 1))));
    setHover({ x: sx(idx), y: sy(pts[idx]), price: pts[idx], idx });
  };

  return (
    <div className={styles.inlinechart}>
      <div className={styles.icHead}>
        <span className={styles.icTitle}>
          {assetLabel} <span className={styles.icTf}>· 48h · Bybit 1h</span>
        </span>
        <span className={`${styles.icDelta} ${up ? styles.up : styles.down}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(2)}%
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${assetLabel} 48-hour price chart, ${delta.toFixed(2)}% change`}
          style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={col} stopOpacity="0.28" />
              <stop offset="1" stopColor={col} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + price labels */}
          {yTicks.map(({ v, y }, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" className={styles.icAxis}>
                {fmtPrice(v)}
              </text>
            </g>
          ))}

          {/* Area fill + line */}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* X-axis labels */}
          {xTicks.map(({ i, x, label }) => (
            <text key={i} x={x} y={H - 6} textAnchor={i === 0 ? "start" : i === N - 1 ? "end" : "middle"} className={styles.icAxis}>
              {label}
            </text>
          ))}

          {/* Hover crosshair */}
          {hover && (
            <g>
              <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={H - PAD_B} stroke={col} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              <circle cx={hover.x} cy={hover.y} r="4" fill={col} />
              <circle cx={hover.x} cy={hover.y} r="8" fill={col} opacity="0.15" />
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && (() => {
          const hoursBack = N - 1 - hover.idx;
          const ts = nowRef.current - hoursBack * 60 * 60 * 1000;
          const d = new Date(ts);
          const label = hoursBack === 0
            ? "now"
            : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
          // Keep tooltip inside chart bounds
          const svgEl = svgRef.current;
          const svgW = svgEl?.clientWidth ?? W;
          const tipW = 130;
          const rawLeft = (hover.x / W) * svgW;
          const left = Math.min(Math.max(rawLeft - tipW / 2, 0), svgW - tipW);
          return (
            <div
              className={styles.icTooltip}
              style={{ left }}
              aria-hidden="true"
            >
              <span className={styles.icTtPrice}>{fmtPrice(hover.price)}</span>
              <span className={styles.icTtTime}>{label}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
