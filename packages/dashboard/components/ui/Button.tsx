import React from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "tag";
export type ButtonTone = "teal" | "slate" | "amber" | "emerald" | "rose";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Use UPPERCASE TRACKING for tag-style chips. Default off (sentence case). */
  uppercase?: boolean;
  className?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
};

type ButtonAsButton = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { as?: "button" };
type ButtonAsAnchor = CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { as: "a" };
type Props = ButtonAsButton | ButtonAsAnchor;

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 min-h-[32px] text-xs gap-1.5",
  md: "px-4 py-2.5 min-h-[40px] text-sm gap-2",
  lg: "px-5 py-3 min-h-[48px] text-[15px] gap-2",
};

const iconSizePx: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

/* Variant × tone composite styles. Sentence case by default. */
const variantToneStyles: Record<string, string> = {
  // PRIMARY — solid, high emphasis, shadow-sm at rest
  "primary:teal":
    "bg-teal-600 text-white border border-teal-700/20 shadow-sm hover:bg-teal-700 hover:shadow active:bg-teal-800 disabled:bg-teal-600/40 disabled:border-transparent disabled:shadow-none",
  "primary:slate":
    "bg-slate-900 text-white border border-black/10 shadow-sm hover:bg-slate-800 hover:shadow active:bg-slate-950 disabled:bg-slate-900/40 disabled:border-transparent disabled:shadow-none",
  "primary:amber":
    "bg-amber-600 text-white border border-amber-700/20 shadow-sm hover:bg-amber-700 hover:shadow active:bg-amber-800 disabled:bg-amber-600/40 disabled:border-transparent disabled:shadow-none",
  "primary:emerald":
    "bg-emerald-600 text-white border border-emerald-700/20 shadow-sm hover:bg-emerald-700 hover:shadow disabled:bg-emerald-600/40 disabled:border-transparent disabled:shadow-none",
  "primary:rose":
    "bg-rose-600 text-white border border-rose-700/20 shadow-sm hover:bg-rose-700 hover:shadow disabled:bg-rose-600/40 disabled:border-transparent disabled:shadow-none",

  // SECONDARY — bordered, white background, medium emphasis
  "secondary:teal":
    "bg-white text-slate-700 border border-slate-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/40 active:bg-teal-50",
  "secondary:slate":
    "bg-white text-slate-700 border border-slate-200 hover:border-slate-400 hover:bg-slate-50",
  "secondary:amber":
    "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 hover:border-amber-300",
  "secondary:emerald":
    "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50",
  "secondary:rose":
    "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50",

  // GHOST — chromeless, lowest emphasis
  "ghost:teal":
    "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-teal-700",
  "ghost:slate":
    "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  "ghost:amber":
    "bg-transparent text-amber-600 hover:bg-amber-50",
  "ghost:emerald":
    "bg-transparent text-emerald-600 hover:bg-emerald-50",
  "ghost:rose":
    "bg-transparent text-rose-600 hover:bg-rose-50",

  // TAG — pill-shaped, low emphasis, for filter/category buttons
  "tag:teal":
    "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100",
  "tag:slate":
    "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200",
  "tag:amber":
    "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100",
  "tag:emerald":
    "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
  "tag:rose":
    "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
};

const baseClass =
  "inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed";

/* Slightly lighter weight for secondary/ghost so primary action stands out by weight too. */
const weightForVariant: Record<ButtonVariant, string> = {
  primary: "font-semibold",
  secondary: "font-medium",
  ghost: "font-medium",
  tag: "font-medium",
};

/* Tag variant is pill-shaped, not rounded-lg. */
const shapeForVariant: Record<ButtonVariant, string> = {
  primary: "rounded-lg",
  secondary: "rounded-lg",
  ghost: "rounded-lg",
  tag: "rounded-full",
};

/**
 * Button primitive — sentence-case, premium typography, proper sizing.
 *
 * Variants:
 *   - primary: solid, hero CTAs (slate-dark or teal)
 *   - secondary: bordered, default for most actions
 *   - ghost: chromeless, low emphasis
 *   - tag: pill-shaped, filter/category style
 *
 * Sizes:
 *   - sm: 32px tall, 12px text — list items, inline actions
 *   - md: 40px tall, 14px text — default, toolbars, cards
 *   - lg: 48px tall, 15px text — modal hero CTAs
 *
 * No uppercase / no tracking-widest by default. Buttons say what they do in sentence case.
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, Props>((props, ref) => {
  const {
    variant = "primary",
    tone = variant === "primary" ? "teal" : "slate",
    size = "md",
    loading,
    icon,
    iconRight,
    uppercase,
    fullWidth,
    className,
    children,
    as,
    ...rest
  } = props as CommonProps & { as?: "a" | "button" } & Record<string, unknown>;

  const key = `${variant}:${tone}`;
  const toneClasses = variantToneStyles[key] || variantToneStyles[`${variant}:teal`];
  const composed = clsx(
    baseClass,
    sizeStyles[size],
    weightForVariant[variant],
    shapeForVariant[variant],
    toneClasses,
    uppercase && "uppercase tracking-[0.08em]",
    fullWidth && "w-full",
    className,
  );

  const iconSize = iconSizePx[size];
  const renderedIcon = loading ? <Loader2 size={iconSize} className="animate-spin" /> : icon;

  // Clone icon nodes to apply the correct size if they didn't specify one
  const sizedIcon = React.isValidElement(renderedIcon) && (renderedIcon.props as { size?: number }).size == null
    ? React.cloneElement(renderedIcon as React.ReactElement<{ size?: number }>, { size: iconSize })
    : renderedIcon;
  const sizedIconRight = React.isValidElement(iconRight) && (iconRight.props as { size?: number }).size == null
    ? React.cloneElement(iconRight as React.ReactElement<{ size?: number }>, { size: iconSize })
    : iconRight;

  if (as === "a") {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={composed}
        aria-disabled={loading || undefined}
      >
        {sizedIcon}
        {children}
        {sizedIconRight}
      </a>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={composed}
      disabled={(rest as { disabled?: boolean }).disabled || loading}
    >
      {sizedIcon}
      {children}
      {sizedIconRight}
    </button>
  );
});

Button.displayName = "Button";
