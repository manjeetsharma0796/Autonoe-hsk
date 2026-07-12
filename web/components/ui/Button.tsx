"use client";

import { forwardRef } from "react";
import "./button.css";

type Variant = "gold" | "ghost" | "violet" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "ghost",
      size = "md",
      block = false,
      loading = false,
      iconLeft,
      iconRight,
      className = "",
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`ui-btn v-${variant} s-${size} ${block ? "block" : ""} ${className}`.trim()}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <span className="ui-spin" aria-hidden /> : iconLeft}
        {children != null && <span>{children}</span>}
        {!loading && iconRight}
      </button>
    );
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "bare";
  size?: Size;
  /** Required for a11y - icon-only buttons need a label. */
  "aria-label": string;
  /** Optional toggled state styling. */
  tone?: "good" | "bad";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "bare", size = "md", tone, active = false, className = "", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`ui-iconbtn v-${variant} s-${size} ${active ? "on" : ""} ${tone ?? ""} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
