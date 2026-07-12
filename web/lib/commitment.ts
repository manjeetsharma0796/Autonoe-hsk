// Commit-reveal commitment for a trade.
//
// At execution we hash a CANONICAL payload (which AI models produced the call,
// the intent, and the executed params) into the on-chain `thesisHash`. Later,
// revealing the payload lets anyone recompute the hash and confirm it matches
// the on-chain value - proving which AI made the call, locked in BEFORE the
// outcome and un-editable after. Both the commit and the verify use the exact
// same functions here, so the hashes line up byte-for-byte.

import { keccak256, stringToHex } from "viem";
import type { Thesis } from "@autonoe/shared";

export interface Commitment {
  /** schema version, so the hash scheme can evolve without ambiguity */
  v: 1;
  thesisId: string;
  intent: string;
  asset: string;
  direction: string;
  sizeMUSD: number;
  optionRef: string;
  /** role → { provider, model } that produced the thesis */
  modelsUsed: Record<string, { provider: string; model: string }>;
}

/** Deterministic JSON: object keys sorted recursively, no whitespace. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

/** The exact string that gets hashed - shown in the "verify it yourself" panel. */
export function commitmentString(c: Commitment): string {
  return canonical(c);
}

/** keccak256 of the canonical commitment - this is the on-chain thesisHash. */
export function hashCommitment(c: Commitment): `0x${string}` {
  return keccak256(stringToHex(commitmentString(c)));
}

export interface ExecParams {
  optionRef: string;
  asset: string;
  direction: string;
  sizeMUSD: number;
}

/** Build the commitment from the thesis + the params actually executed. */
export function buildCommitment(thesis: Thesis, exec: ExecParams): Commitment {
  const modelsUsed: Record<string, { provider: string; model: string }> = {};
  for (const [role, choice] of Object.entries(thesis.modelsUsed ?? {})) {
    if (choice) modelsUsed[role] = { provider: choice.provider, model: choice.model };
  }
  return {
    v: 1,
    thesisId: thesis.id,
    intent: thesis.intent,
    asset: exec.asset,
    direction: exec.direction,
    sizeMUSD: exec.sizeMUSD,
    optionRef: exec.optionRef,
    modelsUsed,
  };
}
