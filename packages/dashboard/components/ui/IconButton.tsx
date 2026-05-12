import React from "react";
import { clsx } from "clsx";

type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactNode;
  label: string;
  size?: Size;
  variant?: "secondary" | "ghost";
  tone?: "slate" | "teal" | "rose";
};

const sizePx: Record<Size, { box: string; icon: number }> = {
  sm: { box: "w-8 h-8", icon: 14 },
  md: { box: "w-9 h-9", icon: 16 },
  lg: { box: "w-11 h-11", icon: 18 },
};

const variantToneStyles: Record<string, string> = {
  "secondary:slate": "bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50",
  "secondary:teal": "bg-white text-slate-600 border border-slate-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/40",
  "secondary:rose": "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  "ghost:slate": "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  "ghost:teal": "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-teal-700",
  "ghost:rose": "bg-transparent text-rose-500 hover:bg-rose-50",
};

/**
 * IconButton — square utility button (no label, icon only).
 * Always has accessible `label` via title + aria-label.
 *
 * Use for toolbar overflow (⋯), close (X), expand, settings, etc.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ icon, label, size = "md", variant = "secondary", tone = "slate", className, ...rest }, ref) => {
    const styles = variantToneStyles[`${variant}:${tone}`] || variantToneStyles["secondary:slate"];
    const sz = sizePx[size];

    const sizedIcon = React.isValidElement(icon) && (icon.props as { size?: number }).size == null
      ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: sz.icon })
      : icon;

    return (
      <button
        ref={ref}
        title={label}
        aria-label={label}
        {...rest}
        className={clsx(
          "inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
          sz.box,
          styles,
          className,
        )}
      >
        {sizedIcon}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
