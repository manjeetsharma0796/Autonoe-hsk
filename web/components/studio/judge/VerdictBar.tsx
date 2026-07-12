"use client";

import type { JSX } from "react";
import type { RefinedOption } from "@autonoe/shared";
import styles from "./VerdictBar.module.css";

export interface VerdictBarProps {
  best: RefinedOption;
  directionLabel?: string;
}

const RISK_LABEL: Record<RefinedOption["risk"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export function VerdictBar({ best, directionLabel }: VerdictBarProps): JSX.Element {
  const pct = best.predictedOutputPct;
  const predLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  const confPct = Math.round(best.confidence * 100);

  return (
    <section
      className={styles.verdict}
      role="status"
      aria-label={`Verdict: preferred option ${best.optionRef}, ${confPct} percent confidence`}
    >
      <span className={styles.edge} aria-hidden="true" />

      <div className={styles.meta}>
        <span className={styles.vk}>Verdict · preferred option</span>
        <h4 className={styles.heading}>
          <span className={styles.ref}>{best.optionRef}</span>
          {directionLabel ? <span>{directionLabel}</span> : null}
          <span className={styles.conf}>{confPct}% confidence</span>
        </h4>
      </div>

      <div className={styles.spacer} />

      <div className={styles.pills}>
        <span className={`${styles.pill} ${styles.pillRet}`}>
          Predicted {predLabel}
        </span>
        <span className={`${styles.pill} ${styles.pillRisk}`}>
          {RISK_LABEL[best.risk]}
        </span>
        <span className={`${styles.pill} ${styles.pillConf}`}>
          Confidence {confPct}%
        </span>
      </div>
    </section>
  );
}
