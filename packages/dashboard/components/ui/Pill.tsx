import React from "react";
import { clsx } from "clsx";

export type PillVariant = "info" | "success" | "warning" | "accent" | "dark" | "muted";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: PillVariant;
  icon?: React.ReactNode;
  as?: "div" | "span";
};

const variantStyles: Record<PillVariant, string> = {
  info: "bg-white border border-slate-200 text-slate-600",
  success: "bg-emerald-50 border border-emerald-200 text-emerald-700",
  warning: "bg-amber-50 border border-amber-200 text-amber-700",
  accent: "bg-teal-50 border border-teal-200 text-teal-700",
  dark: "bg-slate-900 text-white",
  muted: "bg-slate-100 text-slate-600",
};

/**
 * Pill primitive — non-interactive status / count / label chip.
 *
 * Same shape and typography as Button so they line up cleanly in toolbars and headers.
 * For interactive pills, use Button with size="sm" instead.
 */
export const Pill: React.FC<Props> = ({ variant = "info", icon, as = "div", className, children, ...rest }) => {
  const Tag = as as React.ElementType;
  return (
    <Tag
      {...rest}
      className={clsx(
        "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] inline-flex items-center gap-1.5",
        variantStyles[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Tag>
  );
};
