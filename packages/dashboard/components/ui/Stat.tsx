import React from "react";
import { clsx } from "clsx";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Eyebrow } from "./Eyebrow.js";

type Size = "hero" | "large" | "medium" | "small";

type DeltaTone = "positive" | "negative" | "neutral";

type Props = {
  label: React.ReactNode;
  value: React.ReactNode;
  size?: Size;
  delta?: { value: React.ReactNode; tone?: DeltaTone };
  trailing?: React.ReactNode;
  className?: string;
};

const sizeClass: Record<Size, string> = {
  hero: "type-stat-hero",
  large: "type-stat-large",
  medium: "type-stat-medium",
  small: "type-stat-small",
};

const deltaToneClass: Record<DeltaTone, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-slate-500",
};

const deltaIcon: Record<DeltaTone, React.ReactNode> = {
  positive: <ArrowUpRight size={14} />,
  negative: <ArrowDownRight size={14} />,
  neutral: <Minus size={14} />,
};

/**
 * Stat — labelled metric with optional delta. Always tabular-nums.
 * Use for KPI cards, summary numbers, dashboard metrics.
 */
export const Stat: React.FC<Props> = ({ label, value, size = "large", delta, trailing, className }) => {
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="flex items-baseline gap-2">
        <span className={sizeClass[size]}>{value}</span>
        {trailing}
      </div>
      {delta && (
        <div className={clsx("flex items-center gap-1 text-xs font-semibold tabular-nums", deltaToneClass[delta.tone || "neutral"])}>
          {deltaIcon[delta.tone || "neutral"]}
          <span>{delta.value}</span>
        </div>
      )}
    </div>
  );
};
