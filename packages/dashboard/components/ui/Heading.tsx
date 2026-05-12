import React from "react";
import { clsx } from "clsx";

type Level = 1 | 2 | 3 | 4;

type Props = {
  level: Level;
  eyebrow?: React.ReactNode;
  eyebrowTone?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
  children: React.ReactNode;
  /** Render as the display style (Home greeting, modal hero) — overrides level styling. */
  display?: boolean;
};

const levelClass: Record<Level, string> = {
  1: "type-h1",
  2: "type-h2",
  3: "type-h3",
  4: "type-h4",
};

const eyebrowToneClass: Record<NonNullable<Props["eyebrowTone"]>, string> = {
  default: "",
  accent: "type-eyebrow-accent",
  success: "type-eyebrow-success",
  warning: "type-eyebrow-warning",
  danger: "type-eyebrow-danger",
};

/**
 * Heading primitive — the only accepted way to render page/section/card titles.
 *
 * Replaces ad-hoc `text-2xl font-serif font-bold ...` strewn across components.
 * If `eyebrow` is set, renders the eyebrow label above the heading with proper rhythm.
 */
export const Heading: React.FC<Props> = ({ level, eyebrow, eyebrowTone = "default", display, className, children }) => {
  const Tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements;
  const typeClass = display ? "type-display" : levelClass[level];

  return (
    <div className={className}>
      {eyebrow && (
        <p className={clsx("type-eyebrow mb-2", eyebrowToneClass[eyebrowTone])}>
          {eyebrow}
        </p>
      )}
      <Tag className={typeClass}>{children}</Tag>
    </div>
  );
};
