"use client";

import "./button.css";

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`ui-spin ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Loader({ label, size = 15 }: { label?: string; size?: number }) {
  return (
    <span className="ui-loader">
      <Spinner size={size} />
      {label && <span>{label}</span>}
    </span>
  );
}
