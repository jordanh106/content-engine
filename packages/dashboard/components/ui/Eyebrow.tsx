import React from "react";
import { clsx } from "clsx";

type Props = {
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  default: "",
  accent: "type-eyebrow-accent",
  success: "type-eyebrow-success",
  warning: "type-eyebrow-warning",
  danger: "type-eyebrow-danger",
};

/**
 * Eyebrow — the SINGLE small uppercase label. Replaces 8+ ad-hoc variants.
 * Use for section labels, metric labels, stat eyebrows. NEVER for buttons.
 */
export const Eyebrow: React.FC<Props> = ({ tone = "default", icon, className, children }) => {
  return (
    <span className={clsx("type-eyebrow inline-flex items-center gap-1.5", toneClass[tone], className)}>
      {icon}
      {children}
    </span>
  );
};
