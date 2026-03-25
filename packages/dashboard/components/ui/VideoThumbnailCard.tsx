import React, { useState, useRef, useEffect } from "react";
import { Eye, Clock, Play, MoreHorizontal, Star, Bookmark, Archive, Trash2 } from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-slate-900 text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  YouTube: "bg-red-600 text-white",
  multi: "bg-teal-600 text-white",
};

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export type CardAction = "star" | "save" | "archive" | "delete";

export type VideoThumbnailCardProps = {
  thumbnailUrl: string | null;
  videoUrl: string | null;
  title: string;
  subtitle: string;
  platform: string;
  views?: number;
  outlierScore?: number;
  durationSeconds?: number;
  createdAt?: string;
  status?: string;
  onClick: () => void;
  onAction?: (action: CardAction) => void;
  size?: "sm" | "md";
};

const ACTION_ITEMS: { action: CardAction; label: string; icon: React.ReactNode; color: string }[] = [
  { action: "star", label: "Star", icon: <Star size={13} />, color: "text-amber-600" },
  { action: "save", label: "Save", icon: <Bookmark size={13} />, color: "text-teal-600" },
  { action: "archive", label: "Archive", icon: <Archive size={13} />, color: "text-slate-500" },
  { action: "delete", label: "Delete", icon: <Trash2 size={13} />, color: "text-rose-500" },
];

export const VideoThumbnailCard: React.FC<VideoThumbnailCardProps> = ({
  thumbnailUrl,
  title,
  subtitle,
  platform,
  views,
  outlierScore,
  durationSeconds,
  createdAt,
  status,
  onClick,
  onAction,
  size = "md",
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasThumbnail = thumbnailUrl && !imgError;
  const isSm = size === "sm";

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className={`
        cursor-pointer group transition-all duration-200
        hover:shadow-lg
        ${isSm ? "w-48 flex-shrink-0" : "w-full"}
      `}
    >
      {/* Thumbnail (16:9) */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-200" onClick={onClick}>
        {/* Skeleton */}
        {!imgLoaded && !imgError && hasThumbnail && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}

        {/* Thumbnail image -- object-top so vertical images show faces, not center-crop */}
        {hasThumbnail && (
          <img
            src={thumbnailUrl}
            alt={title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}

        {/* Placeholder when no thumbnail */}
        {!hasThumbnail && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300">
            <Play size={isSm ? 20 : 32} className="text-slate-400 mb-1" />
            <span className="text-slate-500 font-medium text-center px-3 leading-tight text-[10px]">
              {title.slice(0, 40)}
            </span>
          </div>
        )}

        {/* Duration badge (bottom-right) */}
        {durationSeconds !== undefined && durationSeconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white px-1.5 py-0.5 rounded text-[11px] font-semibold z-10">
            {formatDuration(durationSeconds)}
          </span>
        )}

        {/* Outlier score badge (top-right) */}
        {outlierScore !== undefined && outlierScore > 0 && (
          <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-black z-10 ${
            outlierScore >= 3 ? "bg-emerald-500 text-white" :
            outlierScore >= 1.5 ? "bg-amber-400 text-amber-900" :
            "bg-slate-500/80 text-white"
          }`}>
            {outlierScore.toFixed(1)}x
          </span>
        )}

        {/* Status indicator (top-left, if not inbox) */}
        {status && status !== "inbox" && (
          <span className={`absolute top-1.5 left-1.5 p-1 rounded-full z-10 ${
            status === "starred" ? "bg-amber-400 text-amber-900" :
            status === "saved" ? "bg-teal-500 text-white" :
            "bg-slate-400 text-white"
          }`}>
            {status === "starred" ? <Star size={10} /> :
             status === "saved" ? <Bookmark size={10} /> :
             <Archive size={10} />}
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-xl" />
      </div>

      {/* Info section below thumbnail */}
      <div className={`mt-2 ${isSm ? "px-0.5" : ""}`}>
        <div className="flex items-start gap-1.5">
          <h3 className={`flex-1 font-semibold text-slate-800 leading-tight line-clamp-2 ${isSm ? "text-[11px]" : "text-sm"}`}>
            {title}
          </h3>

          {/* Action menu button (visible on hover) */}
          {onAction && !isSm && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600"
              >
                <MoreHorizontal size={16} />
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                  {ACTION_ITEMS.map((item) => (
                    <button
                      key={item.action}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onAction(item.action);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50 transition-colors ${item.color}`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1.5 mt-1 ${isSm ? "text-[9px]" : "text-[11px]"}`}>
          <span className="text-slate-500 truncate">{subtitle}</span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${PLATFORM_COLORS[platform] ?? "bg-slate-200 text-slate-700"}`}>
            {platform}
          </span>
        </div>
        <div className={`flex items-center gap-2 mt-0.5 text-slate-400 ${isSm ? "text-[9px]" : "text-[10px]"}`}>
          {views !== undefined && views > 0 && (
            <span className="flex items-center gap-0.5">
              <Eye size={10} />
              {formatViews(views)} views
            </span>
          )}
          {createdAt && (
            <span>{timeAgo(createdAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
