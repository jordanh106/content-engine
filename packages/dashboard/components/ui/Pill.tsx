import React from "react";
import { clsx } from "clsx";

export type PillVariant = "info" | "success" | "warning" | "accent" | "dark" | "muted" | "danger";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: PillVariant;
  icon?: React.ReactNode;
  as?: "div" | "span";
  /** Make the label UPPERCASE TRACKING (status-pill style). Default off (sentence case). */
  uppercase?: boolean;
  /** Compact size for dense rows. */
  size?: "sm" | "md";
};

const variantStyles: Record<PillVariant, string> = {
  info: "bg-slate-50 border border-slate-200 text-slate-700",
  success: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  warning: "bg-amber-50 border border-amber-200 text-amber-700",
  accent: "bg-teal-50 border border-teal-200 text-teal-700",
  dark: "bg-slate-900 text-white",
  muted: "bg-slate-100 text-slate-600",
  danger: "bg-rose-50 border border-rose-200 text-rose-700",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

/**
 * Pill primitive — non-interactive status / count / category badge.
 *
 * Default style is SENTENCE CASE with font-medium (e.g. "Ready for assembly").
 * For traditional status-label style (e.g. "DRAFT", "PUBLISHED") pass `uppercase`.
 */
export const Pill: React.FC<Props> = ({ variant = "info", icon, as = "span", uppercase, size = "md", className, children, ...rest }) => {
  const Tag = as as React.ElementType;
  return (
    <Tag
      {...rest}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        sizeStyles[size],
        variantStyles[variant],
        uppercase && "uppercase tracking-[0.1em] font-semibold",
        className,
      )}
    >
      {icon}
      {children}
    </Tag>
  );
};
