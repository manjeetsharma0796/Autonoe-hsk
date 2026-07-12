import type { ReasoningTrace } from '@autonoe/shared';
import styles from './studio.module.css';
import { ChevronIcon } from './icons';

/** A single collapsible step row (used inside ThinkingTrace). */
export interface TraceStep {
  label: string;
  detail: string;
}

interface ThinkingTraceProps {
  /**
   * One-line headline shown while collapsed.
   * Pass either:
   *   - a `ReasoningTrace` (from the API) - its `.summary` and `.steps` are used, or
   *   - a plain `summary` string + `steps` array (legacy / static data).
   */
  trace?: ReasoningTrace;
  summary?: string;
  steps?: TraceStep[];
}

/**
 * Collapsible "Show thinking" reasoning trace (native <details>).
 *
 * T-403: This is the ONE canonical trace component.  Pass `trace` (a
 * `ReasoningTrace` from @autonoe/shared) for live API data, or the legacy
 * `summary`+`steps` pair for static/sample usage in the same component.
 * Reused for: thesis reasoning, subagent traces, judge arguments.
 */
export function ThinkingTrace({ trace, summary, steps }: ThinkingTraceProps) {
  const resolvedSummary = trace?.summary ?? summary ?? '';
  const resolvedSteps: TraceStep[] =
    trace?.steps ?? steps ?? [];

  if (!resolvedSummary && resolvedSteps.length === 0) return null;

  return (
    <details className={styles.think}>
      <summary>
        <ChevronIcon className={styles.chev} />
        <span>Show thinking</span>
        <span className={styles.sumline}>{resolvedSummary}</span>
      </summary>
      <div className={styles.trace}>
        {resolvedSteps.map((step, i) => (
          <div className={styles.tstep} key={i}>
            <div className={styles.tl}>{step.label}</div>
            <div className={styles.td}>{step.detail}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
