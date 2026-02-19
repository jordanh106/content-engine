import React from "react";
import type { PipelineVideo } from "../../shared/types.js";
import { FormatBadge } from "./FormatBadge.js";
import { AudienceBadge } from "./AudienceBadge.js";
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
          <AudienceBadge audience={video.audience} label={video.audienceLabel} />
        </div>
      </button>
      {advanceButton}
    </div>
  );
};
