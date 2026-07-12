"use client";

/**
 * Win-rate + summary stats strip.
 * Shows: total trades, win-rate, total realised PnL, best + worst single trade.
 */

import type { HistoryRecord } from "@autonoe/shared";

function fmt(v: number, decimals = 2): string {
  return (v >= 0 ? "+" : "") + v.toFixed(decimals);
}

interface Stats {
  total: number;
  judged: number;
  winRate: number; // 0..100
  totalPnl: number;
  best: number | null;
  worst: number | null;
}

function computeStats(records: HistoryRecord[]): Stats {
  const withPnl = records.filter((r) => r.pnlMUSD !== null);
  const pnls = withPnl.map((r) => r.pnlMUSD as number);
  const wins = pnls.filter((v) => v > 0).length;
  const winRate = pnls.length > 0 ? (wins / pnls.length) * 100 : 0;
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const best = pnls.length > 0 ? Math.max(...pnls) : null;
  const worst = pnls.length > 0 ? Math.min(...pnls) : null;

  return {
    total: records.length,
    judged: records.filter((r) => r.judged).length,
    winRate,
    totalPnl,
    best,
    worst,
  };
}

interface StatCellProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}

function StatCell({ label, value, valueColor, sub }: StatCellProps) {
  return (
    <div
      style={{
        padding: "18px 20px",
        borderLeft: "1px solid rgba(255,255,255,.045)",
        flex: "1 1 0",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "var(--faint)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontWeight: 700,
          fontSize: "clamp(22px, 2.8vw, 30px)",
          marginTop: 10,
          color: valueColor ?? "var(--ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function BenchmarkStats({ records }: { records: HistoryRecord[] }) {
  const s = computeStats(records);

  const winRateColor =
    s.winRate > 60
      ? "var(--green)"
      : s.winRate > 40
        ? "var(--gold2)"
        : "var(--red)";

  const pnlColor =
    s.totalPnl > 0
      ? "var(--green)"
      : s.totalPnl < 0
        ? "var(--red)"
        : "var(--ink)";

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--panel)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* First cell has no left border */}
        <div
          style={{
            padding: "18px 20px",
            flex: "1 1 0",
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--faint)",
            }}
          >
            Total trades
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontWeight: 700,
              fontSize: "clamp(22px, 2.8vw, 30px)",
              marginTop: 10,
              color: "var(--ink)",
            }}
          >
            {s.total}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            {s.judged} judged on-chain
          </div>
        </div>

        <StatCell
          label="Win rate"
          value={s.total === 0 ? " - " : `${s.winRate.toFixed(1)}%`}
          valueColor={s.total === 0 ? "var(--faint)" : winRateColor}
          sub={
            s.total === 0
              ? "no data yet"
              : `${Math.round((s.winRate / 100) * s.judged)} wins / ${s.judged} settled`
          }
        />

        <StatCell
          label="Total PnL"
          value={s.total === 0 ? " - " : `${fmt(s.totalPnl)} mUSD`}
          valueColor={s.total === 0 ? "var(--faint)" : pnlColor}
          sub="cumulative realised"
        />

        <StatCell
          label="Best trade"
          value={s.best !== null ? `${fmt(s.best)} mUSD` : " - "}
          valueColor={s.best !== null && s.best > 0 ? "var(--green)" : "var(--faint)"}
        />

        <StatCell
          label="Worst trade"
          value={s.worst !== null ? `${fmt(s.worst)} mUSD` : " - "}
          valueColor={
            s.worst !== null && s.worst < 0 ? "var(--red)" : "var(--faint)"
          }
        />
      </div>
    </div>
  );
}
