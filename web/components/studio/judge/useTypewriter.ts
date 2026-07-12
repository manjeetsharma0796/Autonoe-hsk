import { useEffect, useState } from "react";

export interface TypewriterOptions {
  /** Delay between revealed words, in ms. Defaults to 18. */
  wordMs?: number;
  /** When false, the full text is shown immediately. Defaults to true. */
  enabled?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Progressively reveals already-known `fullText` word-by-word, for a faux
 * "streaming" effect. Resets when `fullText` changes. If `enabled === false`
 * or the user prefers reduced motion, returns the full text immediately.
 */
export function useTypewriter(
  fullText: string,
  opts: TypewriterOptions = {},
): { shown: string; done: boolean } {
  const { wordMs = 18, enabled = true } = opts;
  const [count, setCount] = useState(0);

  // Split into [whitespace?word] tokens so spacing is preserved on join.
  const tokens = fullText.match(/\S+\s*/g) ?? [];
  const total = tokens.length;

  const instant = !enabled || prefersReducedMotion();

  useEffect(() => {
    if (instant || total === 0) {
      setCount(total);
      return;
    }
    setCount(0);
    // Cap the whole reveal at ~MAX_MS: short text types word-by-word, long
    // arguments reveal several words per tick so they never drag on.
    const MAX_MS = 2400;
    const ticks = Math.max(1, Math.min(total, Math.ceil(MAX_MS / wordMs)));
    const perTick = Math.ceil(total / ticks);
    const id = setInterval(() => {
      setCount((c) => {
        const next = c + perTick;
        if (next >= total) {
          clearInterval(id);
          return total;
        }
        return next;
      });
    }, wordMs);
    return () => clearInterval(id);
  }, [fullText, wordMs, instant, total]);

  const n = instant ? total : Math.min(count, total);
  return { shown: tokens.slice(0, n).join(""), done: n >= total };
}
