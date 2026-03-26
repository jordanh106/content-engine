import React from "react";
import { Sparkles } from "lucide-react";
import type { VideoSummary } from "../../shared/types.js";
import { FormatBadge } from "./FormatBadge.js";
import { AudienceBadge } from "./AudienceBadge.js";
import { StatusBadge } from "./StatusBadge.js";
import { ProductionStyleBadge } from "./ProductionStyleBadge.js";

type VideoCardProps = {
  video: VideoSummary;
  onClick: () => void;
};

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-surface-elevated border border-themed rounded-2xl p-4 text-left hover:border-teal-200 hover:shadow-themed-sm transition-all w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-teal-700 font-mono">
          {video.code}
        </span>
        <StatusBadge status={video.status} />
      </div>
      <h3 className="text-sm font-serif font-semibold text-themed leading-snug mb-2">
        {video.title}
      </h3>
      <p className="text-xs text-themed-tertiary line-clamp-2 mb-3 leading-relaxed">
        {video.scriptPreview}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <FormatBadge format={video.format} />
        <ProductionStyleBadge style={video.productionStyle} />
        <AudienceBadge audience={video.audience} label={video.audienceLabel} />
        {video.remotionGraphicsRequired && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={11} />
            Remotion
          </span>
        )}
      </div>
    </button>
  );
};
