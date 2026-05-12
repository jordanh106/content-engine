import React from "react";
import { clsx } from "clsx";

type Props = {
  label?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "teal" | "amber";
  className?: string;
  onClick?: () => void;
  title?: string;
};

const toneStyles = {
  neutral: "bg-white border border-slate-200 text-slate-700",
  teal: "bg-teal-50 border border-teal-200 text-teal-700",
  amber: "bg-amber-50 border border-amber-200 text-amber-700",
};

/**
 * StatChip — for compact metric / status pills like "1044.62 CR" or "9 ON CANVAS".
 *
 * Number/value is emphasized; label sits as a subtle eyebrow. Designed for toolbar density
 * where a Pill with just a label would be too generic.
 */
export const StatChip: React.FC<Props> = ({ label, value, icon, tone = "neutral", className, onClick, title }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={clsx(
        "rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
        toneStyles[tone],
        onClick && "hover:border-teal-300 hover:text-teal-700 cursor-pointer",
        className,
      )}
    >
      {icon}
      <span className="tabular-nums">{value}</span>
      {label && <span className="text-slate-400 font-bold tracking-wider">{label}</span>}
    </Tag>
  );
};
