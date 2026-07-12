"use client";

import "./ai-answer.css";

function Spark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z" />
    </svg>
  );
}

export function FollowUps({
  items,
  onPick,
  title = "You may also like",
  disabled = false,
}: {
  items: string[];
  onPick: (q: string) => void;
  title?: string;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="followups">
      <div className="fu-title">{title}</div>
      <div className="fu-list">
        {items.map((q, i) => (
          <button
            key={i}
            type="button"
            className="fu-pill"
            onClick={() => onPick(q)}
            disabled={disabled}
          >
            <Spark />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
