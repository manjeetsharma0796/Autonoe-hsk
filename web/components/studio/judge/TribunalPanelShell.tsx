"use client";

import type { JSX, ReactNode } from "react";
import styles from "./TribunalPanelShell.module.css";

export type PanelState = "idle" | "speaking" | "waiting" | "done";
export type PanelAccent = "green" | "red" | "amber";

export interface TribunalPanelShellProps {
  accent: PanelAccent;
  state: PanelState;
  children: ReactNode;
  className?: string;
}

/** Maps an accent name to its design token. amber → --gold (medium-risk role). */
const ACCENT_VAR: Record<PanelAccent, string> = {
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--gold)",
};

export function TribunalPanelShell({
  accent,
  state,
  children,
  className,
}: TribunalPanelShellProps): JSX.Element {
  const classes = [
    styles.shell,
    state === "speaking" ? styles.speaking : "",
    state === "waiting" ? styles.waiting : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ ["--accent" as string]: ACCENT_VAR[accent] }}
      data-state={state}
    >
      {state === "waiting" && (
        <span className={styles.badge} aria-live="polite">
          … considering
        </span>
      )}
      {children}
    </div>
  );
}
