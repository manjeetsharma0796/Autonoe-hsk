"use client";

import { useEffect, useState } from "react";
import type { HistoryRecord, LeaderboardRow } from "@autonoe/shared";
import { getHistory, getLeaderboard } from "@/lib/api";
import { PnlChart } from "@/components/benchmark/PnlChart";
import { BenchmarkStats } from "@/components/benchmark/BenchmarkStats";
import { Leaderboard } from "@/components/benchmark/Leaderboard";
import { VerifyBadge } from "@/components/benchmark/VerifyBadge";

const MANTLESCAN_BASE = "https://sepolia.mantlescan.xyz/tx";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function pnlColor(pnl: number | null): string {
  if (pnl === null) return "";
  if (pnl > 0) return "var(--green, #3FE0A6)";
  if (pnl < 0) return "var(--red, #FF6B6B)";
  return "";
}

// ── Section divider ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 48,
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: ".02em",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ── History records table ────────────────────────────────────────────────────

function HistoryTable({ records }: { records: HistoryRecord[] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 0 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--body)",
          fontSize: 14,
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid rgba(255,255,255,.1)",
              textAlign: "left",
              color: "var(--muted)",
              fontSize: 11,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            <th style={{ padding: "8px 12px 8px 0" }}>Date</th>
            <th style={{ padding: "8px 12px" }}>Source</th>
            <th style={{ padding: "8px 12px" }}>Option</th>
            <th style={{ padding: "8px 12px" }}>Judged</th>
            <th style={{ padding: "8px 12px" }}>PnL</th>
            <th style={{ padding: "8px 12px" }}>Tx</th>
            <th style={{ padding: "8px 12px" }}>Verify</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr
              key={rec.thesisId}
              style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}
            >
              <td
                style={{
                  color: "var(--muted)",
                  fontSize: 12,
                  padding: "12px 12px 12px 0",
                }}
              >
                {formatDate(rec.createdAt)}
              </td>
              <td style={{ padding: "12px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    background:
                      rec.source === "ai"
                        ? "rgba(245,165,36,.18)"
                        : "rgba(139,92,246,.18)",
                    color:
                      rec.source === "ai"
                        ? "var(--gold2, #F5A524)"
                        : "#B79CFF",
                  }}
                >
                  {rec.source === "ai" ? "AI" : "Human"}
                </span>
              </td>
              <td
                style={{
                  fontFamily: "var(--mono, monospace)",
                  fontSize: 13,
                  padding: "12px",
                }}
              >
                {rec.chosenOptionRef}
              </td>
              <td style={{ padding: "12px" }}>
                {rec.judged ? (
                  <span style={{ color: "var(--green, #3FE0A6)", fontSize: 13 }}>
                    Judged
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}> - </span>
                )}
              </td>
              <td
                style={{
                  fontFamily: "var(--mono, monospace)",
                  fontSize: 13,
                  color: pnlColor(rec.pnlMUSD),
                  padding: "12px",
                }}
              >
                {rec.pnlMUSD !== null
                  ? `${rec.pnlMUSD >= 0 ? "+" : ""}${rec.pnlMUSD.toFixed(2)} mUSD`
                  : " - "}
              </td>
              <td style={{ padding: "12px" }}>
                {rec.txHash ? (
                  <a
                    href={`${MANTLESCAN_BASE}/${rec.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--gold2, #F5A524)",
                      fontFamily: "var(--mono, monospace)",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    {rec.txHash.slice(0, 8)}…{rec.txHash.slice(-6)} ↗
                  </a>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 12 }}> - </span>
                )}
              </td>
              <td style={{ padding: "12px" }}>
                {rec.txHash ? (
                  <VerifyBadge txHash={rec.txHash} />
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 12 }}> - </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then((r) => setRecords(r))
      .catch((e) =>
        setHistoryError(e instanceof Error ? e.message : "Unknown error"),
      )
      .finally(() => setHistoryLoading(false));

    getLeaderboard()
      .then((r) => setLeaderboard(r))
      .catch((e) =>
        setLeaderboardError(e instanceof Error ? e.message : "Unknown error"),
      )
      .finally(() => setLeaderboardLoading(false));
  }, []);

  const isEmpty = records !== null && records.length === 0;

  return (
    <main className="wrap" style={{ paddingTop: 140, minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <span className="tag">Benchmark</span>
      <h1 className="h2">History</h1>
      <p className="sub">
        On-chain DecisionLog records - every thesis judged, executed, and
        settled on Mantle Sepolia.
      </p>

      {/* ── Loading / error state for history ─────────────────────── */}
      {historyLoading && (
        <p style={{ color: "var(--muted)", marginTop: 32 }}>Loading history…</p>
      )}

      {historyError && !historyLoading && (
        <div
          style={{
            marginTop: 48,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--panel)",
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13,
              color: "var(--faint)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Benchmark offline
          </div>
          <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto", fontSize: 15 }}>
            Couldn&apos;t reach the DecisionLog backend. Start the API server, then
            reload - judged theses and on-chain PnL will appear here.
          </p>
          <p style={{ color: "var(--faint)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 14 }}>
            {historyError}
          </p>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {isEmpty && !historyLoading && (
        <div
          style={{
            marginTop: 48,
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 12,
            background: "var(--panel)",
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 13,
              color: "var(--faint)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            No data yet
          </div>
          <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto", fontSize: 15 }}>
            Execute an AI thesis in the Studio to populate the benchmark - PnL
            charts, win-rate stats and model rankings will appear here once
            trades are settled on-chain.
          </p>
        </div>
      )}

      {/* ── Benchmark dashboard (only when we have records) ────────── */}
      {records !== null && records.length > 0 && (
        <>
          {/* Stats strip */}
          <div style={{ marginTop: 40 }}>
            <BenchmarkStats records={records} />
          </div>

          {/* Cumulative PnL chart */}
          <div style={{ marginTop: 28 }}>
            <PnlChart records={records} />
          </div>
        </>
      )}

      {/* ── Model leaderboard ──────────────────────────────────────── */}
      <Leaderboard
        rows={leaderboard}
        loading={leaderboardLoading}
        error={leaderboardError}
      />

      {/* ── Records table ──────────────────────────────────────────── */}
      {records !== null && records.length > 0 && (
        <>
          <SectionLabel>Execution Log</SectionLabel>
          <div
            style={{
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 12,
              background: "var(--panel)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "0 20px 12px" }}>
              <HistoryTable records={records} />
            </div>
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid rgba(255,255,255,.06)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--faint)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--green)",
                  boxShadow: "0 0 8px var(--green)",
                  flexShrink: 0,
                }}
              />
              DecisionLog · Mantle Sepolia · {records.length} record
              {records.length !== 1 ? "s" : ""}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
