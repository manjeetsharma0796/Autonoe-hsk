"use client";

import type { JSX } from "react";

import css from "./RoundHeader.module.css";

export type TribunalStatus = "idle" | "opening" | "debating" | "ruling" | "done";

export interface RoundHeaderProps {
  round: number;
  intent: string;
  status: TribunalStatus;
}

const CAPTION: Record<TribunalStatus, string> = {
  idle: "ready",
  opening: "opening statements…",
  debating: "debating - taking turns…",
  ruling: "judge ruling…",
  done: "verdict ready",
};

export function RoundHeader({
  round,
  intent,
  status,
}: RoundHeaderProps): JSX.Element {
  const live = status === "opening" || status === "debating" || status === "ruling";
  const stateClass = status === "done" ? css.done : live ? css.live : "";

  return (
    <div className={`${css.head} ${stateClass}`.trim()}>
      <span className={css.round}>{`Round ${round}`}</span>
      <span className={css.intent} title={intent}>
        {intent}
      </span>
      <span className={css.status} role="status" aria-live="polite">
        <span className={css.dot} aria-hidden="true" />
        {CAPTION[status]}
      </span>
    </div>
  );
}
