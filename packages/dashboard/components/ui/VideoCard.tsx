import React from "react";
import type { VideoSummary } from "../../shared/types.js";
import { FormatBadge } from "./FormatBadge.js";
import { AudienceBadge } from "./AudienceBadge.js";
import { StatusBadge } from "./StatusBadge.js";

type VideoCardProps = {
  video: VideoSummary;
  onClick: () => void;
};

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-teal-200 hover:shadow-sm transition-all w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-bold text-teal-700 font-mono">
          {video.code}
        </span>
        <StatusBadge status={video.status} />
      </div>
      <h3 className="text-sm font-serif font-semibold text-slate-900 leading-snug mb-2">
        {video.title}
      </h3>
      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
        {video.scriptPreview}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <FormatBadge format={video.format} />
        <AudienceBadge audience={video.audience} label={video.audienceLabel} />
      </div>
    </button>
  );
};
