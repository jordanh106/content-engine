import React from "react";
import { cn } from "../../utils/cn.js";

type DurationBarProps = {
  totalDuration: number;
  targetRange: [number, number] | null;
  formatName: string;
};

export const DurationBar: React.FC<DurationBarProps> = ({
  totalDuration,
  targetRange,
  formatName,
}) => {
  if (!targetRange) return null;

  const [min, max] = targetRange;
  // Scale bar to 120% of max to show overflow
  const scaleMax = Math.max(max * 1.2, totalDuration);
  const fillPercent = Math.min((totalDuration / scaleMax) * 100, 100);
  const minMarkerPercent = (min / scaleMax) * 100;
  const maxMarkerPercent = (max / scaleMax) * 100;

  const status =
    totalDuration < min ? "under" : totalDuration > max ? "over" : "good";

  return (
    <div className="px-4 py-2 border-b border-slate-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          Duration
        </span>
        <span
          className={cn(
            "text-[10px] font-bold tabular-nums",
            status === "good"
              ? "text-teal-600"
              : status === "over"
                ? "text-rose-600"
                : "text-amber-600",
          )}
        >
          {totalDuration}s / {min}-{max}s
        </span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        {/* Fill bar */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            status === "good"
              ? "bg-teal-500"
              : status === "over"
                ? "bg-rose-500"
                : "bg-amber-500",
          )}
          style={{ width: `${fillPercent}%` }}
        />
        {/* Min marker */}
        <div
          className="absolute inset-y-0 w-px bg-slate-400 opacity-50"
          style={{ left: `${minMarkerPercent}%` }}
        />
        {/* Max marker */}
        <div
          className="absolute inset-y-0 w-px bg-slate-400 opacity-50"
          style={{ left: `${maxMarkerPercent}%` }}
        />
      </div>
    </div>
  );
};
