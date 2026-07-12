"use client";

import { useMemo } from "react";
import type { JSX } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartOptions, ChartData, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";
import type { OptionSeries, SeriesPoint } from "./series";
import styles from "./OutcomesChart.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

/**
 * "Option Outcomes vs Baseline" chart — Chart.js / react-chartjs-2.
 *
 * Responsive by construction (maintainAspectRatio:false inside a fixed-height
 * box), so the curves never stretch. Tooltip is index-mode: hovering anywhere
 * on a bar surfaces the bar's TIME plus every visible series' return %. Theme
 * colors are resolved from the app's CSS design tokens at render time so the
 * canvas matches the dark terminal palette.
 *
 * Data shapes from ./series:
 *   SeriesPoint  = { t: number; v: number }   // v = return % at bar t
 *   OptionSeries = { id; label; color; points: SeriesPoint[] }
 */

export interface OutcomesChartProps {
  baseline: SeriesPoint[];
  options: OptionSeries[];
  bars: number;
  symbolLabel?: string;
}

/** Read a CSS custom property off :root, with a fallback for SSR. */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve a "var(--x)" color string to its concrete value (else pass through). */
function resolveColor(c: string, fallback: string): string {
  const m = /var\(\s*(--[\w-]+)\s*\)/.exec(c);
  return m ? readVar(m[1], fallback) : c || fallback;
}

const SERIES_FALLBACK = ["#22c55e", "#ef4444", "#5b8def"];

/** Format a bar index into a synthetic "MM-DD HH:MM" 1h-bar label. */
function fmtBarTime(i: number, n: number): string {
  const now = Date.now();
  const ms = now - (n - 1 - i) * 3_600_000;
  const d = new Date(ms);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
}

export function OutcomesChart(props: OutcomesChartProps): JSX.Element {
  const { baseline, options, bars, symbolLabel } = props;
  const n = Math.max(2, bars);

  const theme = useMemo(
    () => ({
      ink: readVar("--ink", "#f4f7fb"),
      muted: readVar("--muted", "#aab8cd"),
      faint: readVar("--faint", "#8b97ad"),
      line: readVar("--line", "rgba(255,255,255,0.08)"),
      gold: readVar("--gold", "#f5a524"),
      panel: readVar("--panel2", "#121a2c"),
      mono: readVar("--mono", "ui-monospace, monospace"),
    }),
    [],
  );

  const labels = useMemo(
    () => Array.from({ length: n }, (_, i) => fmtBarTime(i, n)),
    [n],
  );

  const data = useMemo<ChartData<"line">>(() => {
    return {
      labels,
      datasets: [
        {
          label: "baseline",
          data: baseline.map((p) => p.v),
          borderColor: theme.faint,
          borderWidth: 1.4,
          borderDash: [6, 6],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4,
          order: 99,
        },
        ...options.map((s, idx) => {
          const color = resolveColor(s.color, SERIES_FALLBACK[idx] ?? theme.gold);
          return {
            label: s.label,
            data: s.points.map((p) => p.v),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBorderColor: theme.panel,
            pointHoverBorderWidth: 2,
            tension: 0.4,
            order: idx,
          };
        }),
      ],
    };
  }, [labels, baseline, options, theme]);

  const chartOptions = useMemo<ChartOptions<"line">>(() => {
    const tickFont = { family: theme.mono, size: 11 };
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 240 },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 2, left: 2 } },
      scales: {
        x: {
          grid: { color: theme.line, drawTicks: false },
          border: { color: theme.line },
          ticks: {
            color: theme.faint,
            font: tickFont,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
          },
        },
        y: {
          title: {
            display: true,
            text: "RETURN %",
            color: theme.faint,
            font: { family: theme.mono, size: 10 },
          },
          grid: { color: theme.line, drawTicks: false },
          border: { display: false },
          ticks: {
            color: theme.faint,
            font: tickFont,
            callback: (v) =>
              `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(0)}%`,
          },
        },
      },
      plugins: {
        legend: {
          position: "top",
          align: "start",
          labels: {
            color: theme.ink,
            font: { family: theme.mono, size: 12 },
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            boxHeight: 8,
            filter: (item) => item.text !== "baseline",
          },
        },
        tooltip: {
          backgroundColor: theme.panel,
          borderColor: theme.gold,
          borderWidth: 1,
          titleColor: theme.gold,
          bodyColor: theme.ink,
          titleFont: { family: theme.mono, size: 11, weight: "bold" },
          bodyFont: { family: theme.mono, size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          usePointStyle: true,
          callbacks: {
            // Time-rich title: bar index + the bar's datetime.
            title: (items: TooltipItem<"line">[]) => {
              const i = items[0]?.dataIndex ?? 0;
              return `Bar ${i + 1}/${n}  ·  ${labels[i]}`;
            },
            label: (ctx: TooltipItem<"line">) => {
              if (ctx.dataset.label === "baseline") return "";
              const y = ctx.parsed.y ?? 0;
              return `  ${ctx.dataset.label}: ${y >= 0 ? "+" : ""}${y.toFixed(2)}%`;
            },
          },
        },
      },
    };
  }, [theme, n, labels]);

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <Line
          data={data}
          options={chartOptions}
          aria-label={`Option outcomes versus baseline over ${n} bars on ${symbolLabel ?? "the asset"}`}
          role="img"
        />
      </div>
      <div className={styles.foot}>
        TIME · 1h BARS · {symbolLabel ?? "—"}
      </div>
    </div>
  );
}
