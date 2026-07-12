"use client";

import { useEffect, useState } from "react";
import type { AIRole } from "@autonoe/shared";
import { SUBAGENT_ROLES } from "@autonoe/shared";

export const ACTIVE_SOURCES_KEY = "autonoe.activeSources";

/** Returns the current active subagent set from localStorage. */
export function getActiveSources(): AIRole[] {
  if (typeof window === "undefined") return [...SUBAGENT_ROLES];
  try {
    const raw = window.localStorage.getItem(ACTIVE_SOURCES_KEY);
    if (!raw) return [...SUBAGENT_ROLES];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as AIRole[];
  } catch {
    // ignore
  }
  return [...SUBAGENT_ROLES];
}

const SOURCE_META: Record<(typeof SUBAGENT_ROLES)[number], { label: string; description: string }> = {
  "subagent.onchain": {
    label: "On-chain",
    description: "Live DEX / wallet data from Mantle Sepolia",
  },
  "subagent.market": {
    label: "Market",
    description: "Price feeds, order-book depth, funding rates",
  },
  "subagent.news": {
    label: "News",
    description: "Real-time headline sentiment across major feeds",
  },
  "subagent.indicators": {
    label: "Indicators",
    description: "RSI, MACD, Bollinger Bands and macro signals",
  },
};

export function DataSourcePanel() {
  const [enabled, setEnabled] = useState<Set<AIRole>>(() => new Set(SUBAGENT_ROLES));
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setEnabled(new Set(getActiveSources()));
    setMounted(true);
  }, []);

  function toggle(role: (typeof SUBAGENT_ROLES)[number]) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      try {
        window.localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "24px 26px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 700,
          fontSize: 16,
          color: "var(--ink)",
          marginBottom: 6,
          letterSpacing: "0.04em",
        }}
      >
        Data Sources
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
        Enable or disable subagent data sources. Active sources are passed to
        the thesis call as <code style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--gold2)" }}>activeSources</code>.
        Persisted to your browser.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SUBAGENT_ROLES.map((role) => {
          const meta = SOURCE_META[role];
          const isOn = enabled.has(role);

          return (
            <div
              key={role}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                background: "var(--bg2)",
                border: `1px solid ${isOn ? "rgba(245,165,36,0.22)" : "var(--line)"}`,
                borderRadius: 12,
                padding: "14px 18px",
                transition: "border-color 0.2s ease",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isOn ? "var(--ink)" : "var(--muted)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {meta.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>
                  {meta.description}
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-label={`Toggle ${meta.label} data source`}
                onClick={() => toggle(role)}
                disabled={!mounted}
                style={{
                  position: "relative",
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  border: "none",
                  cursor: mounted ? "pointer" : "default",
                  background: isOn
                    ? "linear-gradient(100deg, var(--gold), var(--gold2))"
                    : "rgba(255,255,255,0.08)",
                  transition: "background 0.22s ease",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: isOn ? "calc(100% - 21px)" : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "var(--ink)",
                    transition: "left 0.22s ease",
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      {mounted && (
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 14, fontFamily: "var(--mono)" }}>
          {enabled.size} of {SUBAGENT_ROLES.length} sources active
        </p>
      )}
    </div>
  );
}
