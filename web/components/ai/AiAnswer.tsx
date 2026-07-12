"use client";

import { useState } from "react";
import { Markdown } from "./Markdown";
import { IconButton } from "@/components/ui/Button";
import "./ai-answer.css";

function Ic({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const COPY = "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1";
const CHECK = "M20 6L9 17l-5-5";
const UP = "M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7";
const DOWN = "M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17";
const REFRESH = "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15";

export function AiAnswer({
  text,
  streaming = false,
  onRegenerate,
}: {
  text: string;
  streaming?: boolean;
  onRegenerate?: () => void;
}) {
  const [rating, setRating] = useState<null | "up" | "down">(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  }

  return (
    <div className="ai-answer">
      <Markdown text={text} />
      {streaming && <span className="ai-cursor">▋</span>}

      {!streaming && text.trim() && (
        <div className="ai-actions">
          <IconButton size="sm" aria-label={copied ? "Copied" : "Copy answer"} onClick={copy} title={copied ? "Copied" : "Copy"}>
            <Ic d={copied ? CHECK : COPY} />
          </IconButton>
          <IconButton
            size="sm"
            tone="good"
            active={rating === "up"}
            aria-label="Good answer"
            aria-pressed={rating === "up"}
            onClick={() => setRating((r) => (r === "up" ? null : "up"))}
          >
            <Ic d={UP} />
          </IconButton>
          <IconButton
            size="sm"
            tone="bad"
            active={rating === "down"}
            aria-label="Bad answer"
            aria-pressed={rating === "down"}
            onClick={() => setRating((r) => (r === "down" ? null : "down"))}
          >
            <Ic d={DOWN} />
          </IconButton>
          {onRegenerate && (
            <IconButton size="sm" aria-label="Regenerate" onClick={onRegenerate} title="Regenerate">
              <Ic d={REFRESH} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}
