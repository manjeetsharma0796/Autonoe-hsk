"use client";

/**
 * One-tap commit-reveal verification for a trade row.
 * Click "Verify" → fetch the revealed commitment → recompute keccak256 in the
 * browser → compare to the on-chain thesisHash. Green ✓ with the model that
 * made the call, or a red mismatch. "details" reveals the hashes for skeptics.
 */

import { useState } from "react";
import { verifyTrade } from "@/lib/api";
import { hashCommitment, type Commitment } from "@/lib/commitment";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "verified"; models: string[]; recomputed: string; onChainHash: string }
  | { kind: "mismatch"; recomputed: string; onChainHash: string }
  | { kind: "none" }
  | { kind: "error"; msg: string };

const short = (h: string) => (h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

export function VerifyBadge({ txHash }: { txHash: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);

  async function run() {
    setState({ kind: "loading" });
    try {
      const r = await verifyTrade(txHash);
      if (!r.commitment) {
        setState({ kind: "none" });
        return;
      }
      const commitment = r.commitment as Commitment;
      const recomputed = hashCommitment(commitment);
      const matches =
        !!r.onChainHash &&
        r.onChain &&
        recomputed.toLowerCase() === r.onChainHash.toLowerCase();
      const models = Object.values(commitment.modelsUsed ?? {}).map((m) => m.model);
      if (matches) {
        setState({ kind: "verified", models, recomputed, onChainHash: r.onChainHash! });
      } else {
        setState({ kind: "mismatch", recomputed, onChainHash: r.onChainHash ?? "—" });
      }
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "verify failed" });
    }
  }

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        onClick={run}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 7,
          border: "1px solid rgba(245,165,36,.35)",
          background: "transparent",
          color: "var(--gold2, #F5A524)",
          fontFamily: "var(--mono)",
          fontSize: 11.5,
          cursor: "pointer",
        }}
      >
        Verify
      </button>
    );
  }

  if (state.kind === "loading") {
    return <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)" }}>Verifying…</span>;
  }

  if (state.kind === "none") {
    return (
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }} title="Executed before commit-reveal was enabled">
        legacy · no commit
      </span>
    );
  }

  if (state.kind === "error") {
    return <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red, #FF6B6B)" }}>{state.msg}</span>;
  }

  const verified = state.kind === "verified";
  const color = verified ? "var(--green, #3FE0A6)" : "var(--red, #FF6B6B)";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
        <span aria-hidden="true">{verified ? "✓" : "✗"}</span>
        {verified ? "Verified on-chain" : "Hash mismatch"}
      </span>
      {verified && state.models.length > 0 && (
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
          by {state.models.join(", ")}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", padding: 0, color: "var(--faint)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline" }}
      >
        {open ? "hide" : "verify it yourself"}
      </button>
      {open && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--faint)", lineHeight: 1.7, marginTop: 2 }}>
          <div>on-chain: {short(state.onChainHash)}</div>
          <div>keccak256(payload): {short(state.recomputed)}</div>
          <div style={{ color }}>{verified ? "hashes match" : "hashes differ"}</div>
        </div>
      )}
    </div>
  );
}
