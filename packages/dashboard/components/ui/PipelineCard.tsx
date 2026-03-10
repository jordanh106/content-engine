import React from "react";
import type { PipelineVideo } from "../../shared/types.js";
import { FormatBadge } from "./FormatBadge.js";
import { AudienceBadge } from "./AudienceBadge.js";
import { ProductionStyleBadge } from "./ProductionStyleBadge.js";
import { cn } from "../../utils/cn.js";

type PipelineCardProps = {
  video: PipelineVideo;
  onClick: () => void;
  isDragging?: boolean;
  advanceButton?: React.ReactNode;
};

export const PipelineCard: React.FC<PipelineCardProps> = ({
  video,
  onClick,
  isDragging,
  advanceButton,
}) => {
  return (
    <div
      className={cn(
        "bg-white border rounded-xl p-3 text-left transition-all",
        isDragging
          ? "shadow-lg border-teal-300 ring-2 ring-teal-100 opacity-90"
          : "border-slate-200 hover:border-teal-200 hover:shadow-sm",
      )}
    >
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-teal-700 font-mono">
            {video.code}
          </span>
          {video.daysInStage > 0 && (
            <span
              className={cn(
                "text-[10px] font-bold",
                video.daysInStage > 7 ? "text-amber-500" : "text-slate-400",
              )}
            >
              {video.daysInStage}d
            </span>
          )}
        </div>
        <h3 className="text-xs font-serif font-semibold text-slate-900 leading-snug line-clamp-1 mb-2">
          {video.title}
        </h3>
        <div className="flex flex-wrap gap-1">
          <FormatBadge format={video.format} />
          <ProductionStyleBadge style={video.productionStyle} />
        </div>
      </button>
      {advanceButton}
      {/* Quality gate completion indicator */}
      {typeof video.qualityCompletion === "number" && video.qualityCompletion > 0 && (
        <div className="mt-2 -mx-3 -mb-3 h-1 rounded-b-xl overflow-hidden bg-slate-100">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-b-xl",
              video.qualityCompletion === 100 ? "bg-emerald-500" : "bg-teal-400",
            )}
            style={{ width: `${video.qualityCompletion}%` }}
          />
        </div>
      )}
    </div>
  );
};
