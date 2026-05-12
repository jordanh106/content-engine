import React from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonTone = "teal" | "slate-dark" | "amber" | "emerald" | "rose";
export type ButtonSize = "sm" | "md";

type CommonProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

type ButtonAsButton = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button" };
type ButtonAsAnchor = CommonProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & { as: "a" };
type Props = ButtonAsButton | ButtonAsAnchor;

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[10px] gap-1.5",
  md: "px-4 py-2 text-[10px] gap-1.5",
};

const variantToneStyles: Record<string, string> = {
  "primary:teal": "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-600/50",
  "primary:slate-dark": "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-900/50",
  "primary:amber": "bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-600/50",
  "primary:emerald": "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50",
  "primary:rose": "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/50",
  "secondary:teal": "bg-white border border-slate-200 text-slate-700 hover:border-teal-300 hover:text-teal-700",
  "secondary:slate-dark": "bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900",
  "secondary:amber": "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100",
  "secondary:emerald": "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  "secondary:rose": "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100",
  "ghost:teal": "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-teal-700",
  "ghost:slate-dark": "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  "ghost:amber": "bg-transparent text-amber-600 hover:bg-amber-50",
  "ghost:emerald": "bg-transparent text-emerald-600 hover:bg-emerald-50",
  "ghost:rose": "bg-transparent text-rose-600 hover:bg-rose-50",
};

const baseClass =
  "rounded-full font-black uppercase tracking-widest inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Premium-polish Button primitive. Polymorphic — renders as `<button>` by default, `<a>` when as="a".
 *
 * Use `variant` for emphasis (primary | secondary | ghost) and `tone` for color family.
 * Defaults: primary teal. Shape, font, tracking are fixed across all variants.
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, Props>((props, ref) => {
  const { variant = "primary", tone = "teal", size = "md", icon, iconRight, className, children, as, ...rest } = props as CommonProps & { as?: "a" | "button" } & Record<string, unknown>;
  const key = `${variant}:${tone}`;
  const toneClasses = variantToneStyles[key] || variantToneStyles[`${variant}:teal`];
  const composed = clsx(baseClass, sizeStyles[size], toneClasses, className);

  if (as === "a") {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={composed}
      >
        {icon}
        {children}
        {iconRight}
      </a>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={composed}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

Button.displayName = "Button";
