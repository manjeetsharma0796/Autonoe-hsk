"use client";

import type { JSX } from "react";
import styles from "./ContestedStrip.module.css";

export { extractContested } from "./contested";

export interface ContestedStripProps {
  /** Raw numeric claim tokens (from extractContested), e.g. ["+38%", "1.305", "RSI 28"]. */
  tokens: string[];
}

/**
 * ContestedStrip - a compact row surfacing the numeric figures the tribunal is
 * arguing over. Renders a "⚡ Contested:" label followed by amber monospace
 * chips. Returns null when there's nothing contested.
 */
export function ContestedStrip(props: ContestedStripProps): JSX.Element | null {
  const { tokens } = props;
  if (!tokens || tokens.length === 0) return null;

  return (
    <div className={styles.strip} role="group" aria-label="Contested figures">
      <span className={styles.label}>
        <span className={styles.spark} aria-hidden="true">
          ⚡
        </span>
        Contested:
      </span>
      {tokens.map((token, i) => (
        <span key={`${token}-${i}`} className={styles.chip}>
          {token}
        </span>
      ))}
    </div>
  );
}
