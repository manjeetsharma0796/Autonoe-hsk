"use client";

/**
 * Cumulative PnL-over-time SVG area chart.
 * Sorts HistoryRecord[] by createdAt, accumulates pnlMUSD (null → 0),
 * and renders a line/area chart with gain=green / loss=red colouring.
 * Renders at the measured pixel width (viewBox === container width) so text
 * is never horizontally stretched - no preserveAspectRatio="none".
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { HistoryRecord } from "@autonoe/shared";

const H = 200;
const PAD = { top: 16, right: 16, bottom: 36, left: 56 };
const GREEN = "#3FE0A6";
const RED = "#FF6B6B";

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Full date + timestamp for the hover tooltip, e.g. "Jun 15, 2:00 AM". */
function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Running cumulative PnL series, oldest → newest. */
function cumulative(records: HistoryRecord[]): { value: number; date: string }[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const out: { value: number; date: string }[] = [];
  let running = 0;
  for (const rec of sorted) {
    running += rec.pnlMUSD ?? 0;
    out.push({ value: running, date: rec.createdAt });
  }
  return out;
}

export function PnlChart({ records }: { records: HistoryRecord[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(320, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (records.length === 0) {
    return (
      <div
        ref={ref}
        style={{
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16,
          background: "var(--panel)",
          padding: "40px 24px",
          textAlign: "center",
          color: "var(--faint)",
          fontFamily: "var(--mono)",
          fontSize: 13,
          letterSpacing: ".06em",
        }}
      >
        No PnL data yet - execute an AI thesis to populate the benchmark.
      </div>
    );
  }

  const W = w;
  const INNER_W = W - PAD.left - PAD.right;
  const INNER_H = H - PAD.top - PAD.bottom;

  const cum = cumulative(records);
  const values = cum.map((p) => p.value);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const rangeV = maxV - minV || 1;

  const pts = cum.map((p, i) => ({
    x: PAD.left + (i / Math.max(cum.length - 1, 1)) * INNER_W,
    y: PAD.top + (1 - (p.value - minV) / rangeV) * INNER_H,
    value: p.value,
    date: p.date,
  }));

  const lastValue = pts.length > 0 ? pts[pts.length - 1].value : 0;
  const color = lastValue >= 0 ? GREEN : RED;
  const zeroY = PAD.top + (1 - (0 - minV) / rangeV) * INNER_H;

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath =
    pts.length > 0
      ? `M ${pts[0].x.toFixed(1)},${zeroY.toFixed(1)} L ${pts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" L ")} L ${pts[pts.length - 1].x.toFixed(1)},${zeroY.toFixed(1)} Z`
      : "";

  const ticks = [minV, (minV + maxV) / 2, maxV];
  const axisLabels = ticks.map((v) => ({
    y: PAD.top + (1 - (v - minV) / rangeV) * INNER_H,
    label: (v >= 0 ? "+" : "") + v.toFixed(1),
  }));

  // Up to 5 evenly spaced x labels, then drop consecutive duplicates (e.g. a
  // run of same-day trades) so the axis doesn't read "Jun 6 Jun 6 Jun 6 …".
  const rawX: { x: number; label: string }[] = [];
  if (pts.length === 1) {
    rawX.push({ x: pts[0].x, label: formatShortDate(pts[0].date) });
  } else {
    const step = Math.max(1, Math.floor((pts.length - 1) / 4));
    for (let i = 0; i < pts.length; i += step) {
      rawX.push({ x: pts[i].x, label: formatShortDate(pts[i].date) });
    }
    const last = pts[pts.length - 1];
    if (rawX[rawX.length - 1].x !== last.x) {
      rawX.push({ x: last.x, label: formatShortDate(last.date) });
    }
  }
  const xLabels = rawX.filter(
    (l, i) => i === 0 || i === rawX.length - 1 || l.label !== rawX[i - 1].label,
  );

  const gradientId = "pnl-area-grad";

  const handleMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || pts.length === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((svgX - PAD.left) / Math.max(INNER_W, 1)) * Math.max(pts.length - 1, 1));
    setHovered(Math.max(0, Math.min(pts.length - 1, i)));
  };

  return (
    <div
      ref={ref}
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 16,
        background: "var(--panel)",
        padding: "20px 0 0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          Cumulative PnL
        </span>
        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15, color }}>
          {lastValue >= 0 ? "+" : ""}
          {lastValue.toFixed(2)} mUSD
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: H, display: "block", cursor: "crosshair" }}
        aria-label="Cumulative PnL over time"
        onMouseMove={handleMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="rgba(255,255,255,.1)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {axisLabels.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={tick.y}
              x2={W - PAD.right}
              y2={tick.y}
              stroke="rgba(255,255,255,.04)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={tick.y + 4}
              textAnchor="end"
              fill="var(--faint)"
              fontSize="10"
              fontFamily="var(--mono)"
            >
              {tick.label}
            </text>
          </g>
        ))}

        <path d={fillPath} fill={`url(#${gradientId})`} />

        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.7" />
        ))}

        {xLabels.map((lbl, i) => (
          <text
            key={i}
            x={lbl.x}
            y={H - 6}
            textAnchor="middle"
            fill="var(--faint)"
            fontSize="10"
            fontFamily="var(--mono)"
          >
            {lbl.label}
          </text>
        ))}

        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={H - PAD.bottom}
          stroke="rgba(255,255,255,.06)"
          strokeWidth="1"
        />

        {hovered !== null && pts[hovered] && (() => {
          const p = pts[hovered];
          const boxW = 156;
          const boxH = 46;
          const tx = Math.min(Math.max(p.x - boxW / 2, 2), W - boxW - 2);
          const ty = Math.max(p.y - boxH - 12, 2);
          const valLine = `${p.value >= 0 ? "+" : ""}${p.value.toFixed(2)} mUSD`;
          return (
            <g>
              <line
                x1={p.x}
                y1={PAD.top}
                x2={p.x}
                y2={H - PAD.bottom}
                stroke="rgba(255,255,255,.22)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={p.x} cy={p.y} r="4.5" fill={color} stroke="#0b0e14" strokeWidth="1.5" />
              <rect
                x={tx}
                y={ty}
                width={boxW}
                height={boxH}
                rx="7"
                fill="rgba(12,17,28,.95)"
                stroke="rgba(255,255,255,.14)"
                strokeWidth="1"
              />
              <text x={tx + 11} y={ty + 18} fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">
                {formatDateTime(p.date)}
              </text>
              <text
                x={tx + 11}
                y={ty + 35}
                fontSize="13"
                fontWeight="700"
                fill={color}
                fontFamily="var(--mono)"
              >
                {valLine}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
