import React from "react";
import { cn } from "../../utils/cn.js";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  iconText?: string;
  subtitle?: string;
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBg = "bg-teal-50",
  iconText = "text-teal-600",
  subtitle,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {label}
        </span>
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center",
            iconBg,
            iconText,
          )}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-serif font-bold text-slate-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
};
