import React, { useRef, useState, useCallback } from "react";
import { Star, Bookmark, Archive, ExternalLink, Eye, X } from "lucide-react";
import type { CreatorVideo } from "../../shared/types.js";
import type { CardAction } from "./VideoThumbnailCard.js";

type VideoBottomSheetProps = {
  video: CreatorVideo;
  onAction: (action: CardAction) => void;
  onClose: () => void;
};

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-slate-900 text-white",
  Instagram: "bg-rose-600 text-white",
  YouTube: "bg-red-600 text-white",
};

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const VideoBottomSheet: React.FC<VideoBottomSheetProps> = ({ video, onAction, onClose }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragStartRef.current = e.touches[0].clientY;
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (dragStartRef.current === null) return;
    const dy = e.touches[0].clientY - dragStartRef.current;
    if (dy > 0) setDragY(dy); // Only allow downward drag
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
    dragStartRef.current = null;
  }, [dragY, onClose]);

  const outlierScore = video.outlierScoreX100 ? video.outlierScoreX100 / 100 : null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl max-h-[75vh] overflow-y-auto animate-slide-up"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400"
        >
          <X size={18} />
        </button>

        {/* Thumbnail */}
        {video.thumbnailUrl && (
          <div className="relative aspect-video bg-black/90 mx-4 rounded-2xl overflow-hidden mt-1">
            <img
              src={video.thumbnailUrl}
              loading="lazy"
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50"
            />
            <img
              src={video.thumbnailUrl}
              loading="lazy"
              alt={video.videoTitle || "Video"}
              className="absolute inset-0 w-full h-full object-contain z-[1]"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">
              {video.videoTitle || "Untitled video"}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-slate-500">{video.creatorHandle}</span>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold ${PLATFORM_COLORS[video.platform] ?? "bg-slate-200 text-slate-700"}`}>
                {video.platform}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {typeof video.views === "number" && video.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {formatViews(video.views)} views
              </span>
            )}
            {outlierScore !== null && outlierScore > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                outlierScore >= 3 ? "bg-emerald-100 text-emerald-700" :
                outlierScore >= 1.5 ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {outlierScore.toFixed(1)}x outlier
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { onAction("star"); onClose(); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                video.status === "starred"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-600"
              }`}
            >
              <Star size={18} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Star</span>
            </button>
            <button
              onClick={() => { onAction("save"); onClose(); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                video.status === "saved"
                  ? "bg-teal-100 text-teal-700"
                  : "bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600"
              }`}
            >
              <Bookmark size={18} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Save</span>
            </button>
            <button
              onClick={() => { onAction("archive"); onClose(); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                video.status === "archived"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Archive size={18} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Archive</span>
            </button>
          </div>

          {/* Open in app */}
          {video.videoUrl && video.videoUrl !== "unknown" && (
            <button
              onClick={() => {
                window.open(video.videoUrl!, "_blank", "noopener");
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-teal-700 shadow-sm"
            >
              <ExternalLink size={14} />
              Open in {video.platform}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
