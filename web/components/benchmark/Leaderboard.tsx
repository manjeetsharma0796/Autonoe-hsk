"use client";

/**
 * Model leaderboard section.
 * Renders LeaderboardRow[] grouped by role, sorted descending by avgPnlMUSD
 * (the API already returns them in that order).
 */

import type { AIRole, LeaderboardRow } from "@autonoe/shared";

// Human-readable role labels
const ROLE_LABELS: Record<AIRole, string> = {
  thesis: "Thesis Generator",
  "subagent.onchain": "On-chain Subagent",
  "subagent.market": "Market Subagent",
  "subagent.news": "News Subagent",
  "subagent.indicators": "Indicators Subagent",
  assistant: "Assistant",
  supporter: "Supporter",
  discriminator: "Discriminator",
  judge: "Judge",
};

function roleLabel(role: AIRole): string {
  return ROLE_LABELS[role] ?? role;
}

function pnlColor(v: number): string {
  if (v > 0) return "var(--green)";
  if (v < 0) return "var(--red)";
  return "var(--muted)";
}

function winRateColor(v: number): string {
  if (v > 60) return "var(--green)";
  if (v > 40) return "var(--gold2)";
  return "var(--red)";
}

// Provider pill colours
const PROVIDER_COLORS: Record<string, { bg: string; fg: string }> = {
  groq: { bg: "rgba(245,165,36,.15)", fg: "var(--gold2)" },
  mistral: { bg: "rgba(139,92,246,.15)", fg: "var(--violet2)" },
  nvidia: { bg: "rgba(63,224,166,.12)", fg: "var(--green)" },
  openrouter: { bg: "rgba(255,107,107,.12)", fg: "var(--red)" },
  gemini: { bg: "rgba(100,160,255,.12)", fg: "#7EB8FF" },
};

function providerColors(provider: string): { bg: string; fg: string } {
  return PROVIDER_COLORS[provider] ?? { bg: "rgba(255,255,255,.06)", fg: "var(--muted)" };
}

interface GroupedRows {
  role: AIRole;
  rows: LeaderboardRow[];
}

function groupByRole(rows: LeaderboardRow[]): GroupedRows[] {
  const map = new Map<AIRole, LeaderboardRow[]>();
  for (const row of rows) {
    if (!map.has(row.role)) map.set(row.role, []);
    map.get(row.role)!.push(row);
  }
  return Array.from(map.entries()).map(([role, rows]) => ({ role, rows }));
}

const TH_STYLE: React.CSSProperties = {
  padding: "10px 14px 10px 0",
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--faint)",
  fontWeight: 400,
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  whiteSpace: "nowrap",
};

const TD_STYLE: React.CSSProperties = {
  padding: "13px 14px 13px 0",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,.04)",
  verticalAlign: "middle",
};

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--body)",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, width: 28 }}>#</th>
            <th style={TH_STYLE}>Provider / Model</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>Trades</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>Win rate</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>Avg PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const pc = providerColors(row.provider);
            return (
              <tr key={`${row.role}-${row.provider}-${row.model}`}>
                <td
                  style={{
                    ...TD_STYLE,
                    fontFamily: "var(--mono)",
                    color: idx === 0 ? "var(--gold2)" : "var(--faint)",
                    fontWeight: idx === 0 ? 700 : 400,
                    fontSize: 12,
                  }}
                >
                  {idx + 1}
                </td>
                <td style={TD_STYLE}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 9px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        background: pc.bg,
                        color: pc.fg,
                        letterSpacing: ".06em",
                        flexShrink: 0,
                      }}
                    >
                      {row.provider}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        color: "var(--muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 260,
                      }}
                    >
                      {row.model}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    ...TD_STYLE,
                    fontFamily: "var(--mono)",
                    textAlign: "right",
                    color: "var(--ink)",
                  }}
                >
                  {row.trades}
                </td>
                <td
                  style={{
                    ...TD_STYLE,
                    fontFamily: "var(--mono)",
                    textAlign: "right",
                    color: winRateColor(row.winRate),
                    fontWeight: 600,
                  }}
                >
                  {row.winRate.toFixed(1)}%
                </td>
                <td
                  style={{
                    ...TD_STYLE,
                    fontFamily: "var(--mono)",
                    textAlign: "right",
                    color: pnlColor(row.avgPnlMUSD),
                    fontWeight: 600,
                  }}
                >
                  {row.avgPnlMUSD >= 0 ? "+" : ""}
                  {row.avgPnlMUSD.toFixed(2)} mUSD
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Leaderboard({
  rows,
  loading,
  error,
}: {
  rows: LeaderboardRow[] | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={{ marginTop: 48 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 20,
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
          Model Leaderboard
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          by role · ranked by avg PnL
        </span>
      </div>

      {loading && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading leaderboard…</p>
      )}

      {error && (
        <p style={{ color: "var(--faint)", fontFamily: "var(--mono)", fontSize: 12.5 }}>
          Leaderboard unavailable - start the API server and reload.
        </p>
      )}

      {rows !== null && rows.length === 0 && !loading && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
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
              letterSpacing: ".06em",
            }}
          >
            No model-attributed trades yet.
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "var(--muted)",
              maxWidth: 420,
              margin: "10px auto 0",
            }}
          >
            Execute an AI thesis to start populating the leaderboard - each role's
            model will be tracked and ranked here.
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {groupByRole(rows).map(({ role, rows: groupRows }) => (
            <div
              key={role}
              style={{
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 16,
                background: "var(--panel)",
                overflow: "hidden",
              }}
            >
              {/* Role header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(255,255,255,.015)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "var(--gold)",
                    boxShadow: "0 0 8px var(--gold)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--gold2)",
                  }}
                >
                  {roleLabel(role)}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--faint)",
                  }}
                >
                  {groupRows.length} model{groupRows.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ padding: "0 20px 8px" }}>
                <LeaderboardTable rows={groupRows} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
