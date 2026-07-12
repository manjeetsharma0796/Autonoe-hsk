"use client";

/**
 * KeyQuickPanel - a top-anchored overlay panel containing the compact
 * ProviderKeyPanel. Opened from the global nav trigger in AppShell.
 * Closes on overlay click or Escape key.
 */

import { useEffect, useRef } from "react";
import type { ModelInfo, ProviderId } from "@autonoe/shared";
import { ProviderKeyPanel } from "./ProviderKeyPanel";

interface KeyQuickPanelProps {
  onClose: () => void;
  onModelsLoaded?: (providerId: ProviderId, models: ModelInfo[]) => void;
}

export function KeyQuickPanel({ onClose, onModelsLoaded }: KeyQuickPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap focus inside panel on mount
  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, input, a[href]"
    );
    first?.focus();
  }, []);

  return (
    <>
      {/* Overlay backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(3px)",
        }}
      />

      {/* Panel - top-anchored, centred */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="API Keys & Models"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 76,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 91,
          width: "min(620px, 92vw)",
          maxHeight: "calc(100vh - 100px)",
          overflowY: "auto",
          borderRadius: 18,
          boxShadow: "0 40px 100px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(245,165,36,0.1)",
          /* Animate in from top */
          animation: "kqp-drop 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 0 20px",
            background: "var(--panel)",
            borderRadius: "18px 18px 0 0",
            borderBottom: "1px solid var(--line2)",
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "var(--gold2)",
              }}
            >
              API Keys & Models
            </span>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={onClose}
            style={{ padding: "4px 12px", fontSize: 12 }}
            aria-label="Close API key panel"
          >
            Close
          </button>
        </div>

        {/* Panel body */}
        <div
          style={{
            background: "var(--panel)",
            borderRadius: "0 0 18px 18px",
            padding: "0 0 4px 0",
          }}
        >
          <ProviderKeyPanel onModelsLoaded={onModelsLoaded} compact />
        </div>
      </div>

      {/* Drop-in keyframe - injected inline so it works without a CSS module */}
      <style>{`
        @keyframes kqp-drop {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  );
}
