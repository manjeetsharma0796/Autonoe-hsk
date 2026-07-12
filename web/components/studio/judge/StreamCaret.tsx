"use client";

import type { CSSProperties, JSX } from "react";
import styles from "./StreamCaret.module.css";

export interface StreamCaretProps {
  color?: string;
}

/**
 * StreamCaret - a tiny blinking block-cursor (~7x14px) marking the live
 * streaming boundary. Blinks at 1s steps; falls back to a solid block under
 * prefers-reduced-motion (handled globally in globals.css). Defaults to
 * `currentColor` so it inherits the surrounding text color.
 */
export function StreamCaret({ color = "currentColor" }: StreamCaretProps): JSX.Element {
  const style = { color } as CSSProperties;
  return <span aria-hidden="true" className={styles.caret} style={style} />;
}
