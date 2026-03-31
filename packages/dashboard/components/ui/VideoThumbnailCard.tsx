import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eye, Play, MoreHorizontal, Star, Bookmark, Archive, Trash2, Check, Loader2 } from "lucide-react";
import { MetricBadge } from "./MetricBadge.js";

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

function getEmbedUrl(videoUrl: string | null, platform: string): string | null {
  if (!videoUrl || videoUrl === "unknown") return null;

  if (platform === "YouTube") {
    let id: string | null = null;
    try {
      const url = new URL(videoUrl);
      if (url.hostname.includes("youtu.be")) {
        id = url.pathname.slice(1);
      } else {
        id = url.searchParams.get("v");
      }
    } catch { /* invalid URL */ }
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${id}`;
  }

  if (platform === "TikTok") {
    const match = videoUrl.match(/\/video\/(\d+)/);
    if (match) return `https://www.tiktok.com/player/v1/${match[1]}?autoplay=1&mute=1`;
  }

  // Instagram: no clean player embed available — hover opens in new tab instead
  return null;
}

const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

export type CardAction = "star" | "save" | "archive" | "delete";

export type VideoThumbnailCardProps = {
  thumbnailUrl: string | null;
  videoUrl?: string | null;
  title: string;
  subtitle: string;
  platform: string;
  views?: number;
  likes?: number;
  saves?: number;
  outlierScore?: number;
  durationSeconds?: number;
  createdAt?: string;
  status?: string;
  onClick: () => void;
  onAction?: (action: CardAction) => void;
  size?: "sm" | "md";
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (shiftKey?: boolean) => void;
};

const ACTION_ITEMS: { action: CardAction; label: string; icon: React.ReactNode; color: string }[] = [
  { action: "star", label: "Star", icon: <Star size={13} />, color: "text-amber-600 hover:bg-amber-50" },
  { action: "save", label: "Save", icon: <Bookmark size={13} />, color: "text-teal-600 hover:bg-teal-50" },
  { action: "archive", label: "Archive", icon: <Archive size={13} />, color: "text-themed-tertiary hover:bg-slate-50" },
  { action: "delete", label: "Delete", icon: <Trash2 size={13} />, color: "text-rose-500 hover:bg-rose-50" },
];

export const VideoThumbnailCard: React.FC<VideoThumbnailCardProps> = ({
  thumbnailUrl,
  videoUrl,
  title,
  subtitle,
  platform,
  views,
  likes,
  saves,
  outlierScore,
  durationSeconds,
  createdAt,
  status,
  onClick,
  onAction,
  size = "md",
  selectable,
  selected,
  onSelect,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasThumbnail = thumbnailUrl && !imgError;
  const isSm = size === "sm";

  // Swipe state
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; decided: boolean }>({ x: 0, y: 0, decided: false });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Hover preview handlers (desktop only)
  const handleMouseEnter = useCallback(() => {
    if (isTouchDevice || isSm || !videoUrl || selectable) return;
    hoverTimerRef.current = setTimeout(() => {
      setShowPreview(true);
      setPreviewLoaded(false);
    }, 500);
  }, [isSm, videoUrl, selectable]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowPreview(false);
    setPreviewLoaded(false);
  }, []);

  // Touch handlers for swipe + long-press
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (selectable || isSm) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, decided: false };

    // Long-press to enter selection mode
    if (onSelect) {
      longPressTimerRef.current = setTimeout(() => {
        onSelect(false);
      }, 400);
    }
  }, [selectable, isSm, onSelect]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (selectable || isSm) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Cancel long-press on any movement
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Decide direction: if vertical > horizontal, cancel swipe
    if (!touchStartRef.current.decided) {
      if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
        touchStartRef.current.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) return; // Vertical scroll
        setIsSwiping(true);
      }
      return;
    }

    if (!isSwiping && Math.abs(dy) > Math.abs(dx)) return;
    if (isSwiping) {
      setSwipeDelta(dx);
    }
  }, [selectable, isSm, isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isSwiping && onAction) {
      if (swipeDelta > 80) {
        onAction("star");
      } else if (swipeDelta < -80) {
        onAction("archive");
      }
    }
    setSwipeDelta(0);
    setIsSwiping(false);
    touchStartRef.current = { x: 0, y: 0, decided: false };
  }, [isSwiping, swipeDelta, onAction]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable && onSelect) {
      e.preventDefault();
      onSelect(e.shiftKey);
      return;
    }
    onClick();
  };

  const embedUrl = showPreview ? getEmbedUrl(videoUrl ?? null, platform) : null;

  return (
    <div className="relative">
      {/* Swipe action backgrounds (revealed as card slides) */}
      {isSwiping && (
        <>
          {/* Right swipe = Star (amber) */}
          {swipeDelta > 0 && (
            <div className="absolute inset-0 rounded-2xl bg-amber-100 flex items-center pl-6">
              <Star size={20} className={`text-amber-500 transition-transform ${swipeDelta > 80 ? "scale-125" : ""}`} />
            </div>
          )}
          {/* Left swipe = Archive (slate) */}
          {swipeDelta < 0 && (
            <div className="absolute inset-0 rounded-2xl bg-slate-200 flex items-center justify-end pr-6">
              <Archive size={20} className={`text-themed-tertiary transition-transform ${swipeDelta < -80 ? "scale-125" : ""}`} />
            </div>
          )}
        </>
      )}

      <div
        className={`
          group transition-all duration-200
          bg-surface-elevated rounded-2xl
          border shadow-themed-sm
          ${selected ? "border-teal-400 ring-2 ring-teal-400/30 shadow-themed-md" : "border-themed hover:shadow-themed-md hover:border-themed"}
          ${isSm ? "w-52 flex-shrink-0" : "w-full"}
          ${selectable ? "cursor-pointer" : ""}
        `}
        style={isSwiping ? { transform: `translateX(${swipeDelta}px)`, transition: "none" } : { transition: "transform 0.2s ease-out" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Thumbnail area with blurred backdrop for mixed aspect ratios */}
        <div
          className={`relative ${isSm ? "aspect-video" : "aspect-[9/16]"} overflow-hidden rounded-t-2xl bg-black/90 cursor-pointer`}
          onClick={handleCardClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Skeleton */}
          {!imgLoaded && !imgError && hasThumbnail && (
            <div className="absolute inset-0 bg-slate-200 animate-pulse" />
          )}

          {hasThumbnail && (
            <>
              {/* Blurred background fill */}
              <img
                src={thumbnailUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50"
              />
              {/* Actual image */}
              <img
                src={thumbnailUrl}
                alt={title}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className="absolute inset-0 w-full h-full object-contain z-[1]"
              />
            </>
          )}

          {/* Placeholder when no thumbnail — platform-branded */}
          {!hasThumbnail && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${
              platform === "TikTok" ? "bg-gradient-to-br from-slate-800 to-slate-900" :
              platform === "Instagram" ? "bg-gradient-to-br from-purple-900 to-pink-900" :
              platform === "YouTube" ? "bg-gradient-to-br from-red-900 to-slate-900" :
              "bg-gradient-to-br from-slate-700 to-slate-800"
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                platform === "TikTok" ? "bg-white/10" :
                platform === "Instagram" ? "bg-white/10" :
                platform === "YouTube" ? "bg-white/10" :
                "bg-white/10"
              }`}>
                <Play size={isSm ? 16 : 20} className="text-white/70" />
              </div>
              <span className="text-white/60 font-medium text-center px-4 leading-tight text-[10px] line-clamp-2">
                {title.slice(0, 60)}
              </span>
              <span className={`mt-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                platform === "TikTok" ? "bg-white/10 text-white/50" :
                platform === "Instagram" ? "bg-white/10 text-white/50" :
                "bg-white/10 text-white/50"
              }`}>
                {platform}
              </span>
            </div>
          )}

          {/* Hover preview iframe (desktop only) */}
          {showPreview && embedUrl && (
            <>
              {!previewLoaded && (
                <div className="absolute inset-0 z-[6] flex items-center justify-center bg-black/40">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full z-[5]"
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
                frameBorder="0"
                onLoad={() => setPreviewLoaded(true)}
              />
            </>
          )}

          {/* "Watch on Instagram" fallback for posts without embed */}
          {showPreview && !embedUrl && (platform === "Instagram" || platform === "instagram") && (
            <a
              href={videoUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 z-[5] flex items-center justify-center bg-black/50"
            >
              <span className="text-white text-[11px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 rounded-full">
                Watch on Instagram
              </span>
            </a>
          )}

          {/* Duration badge (bottom-right) */}
          {durationSeconds !== undefined && durationSeconds > 0 && !showPreview && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-[11px] font-semibold z-10">
              {formatDuration(durationSeconds)}
            </span>
          )}

          {/* Outlier score badge (top-right) */}
          {outlierScore !== undefined && outlierScore > 0 && !selectable && (
            <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black z-10 ${
              outlierScore >= 3 ? "bg-emerald-500 text-white" :
              outlierScore >= 1.5 ? "bg-amber-400 text-amber-900" :
              "bg-white/80 text-themed-secondary backdrop-blur-sm"
            }`}>
              {outlierScore.toFixed(1)}x
            </span>
          )}

          {/* Selection checkbox (top-left, replaces status indicator in selection mode) */}
          {selectable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(e.shiftKey);
              }}
              className={`absolute top-2 left-2 w-7 h-7 rounded-full z-10 flex items-center justify-center transition-all ${
                selected
                  ? "bg-teal-500 text-white shadow-md"
                  : "bg-white/80 text-themed-muted backdrop-blur-sm hover:bg-white hover:text-themed-secondary"
              }`}
            >
              {selected ? <Check size={14} strokeWidth={3} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
            </button>
          )}

          {/* Status indicator (top-left, if not inbox and not in selection mode) */}
          {!selectable && status && status !== "inbox" && (
            <span className={`absolute top-2 left-2 p-1.5 rounded-full z-10 shadow-sm ${
              status === "starred" ? "bg-amber-400 text-white" :
              status === "saved" ? "bg-teal-500 text-white" :
              "bg-slate-500 text-white"
            }`}>
              {status === "starred" ? <Star size={10} /> :
               status === "saved" ? <Bookmark size={10} /> :
               <Archive size={10} />}
            </span>
          )}

          {/* Hook text overlay at bottom */}
          {!isSm && !showPreview && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-3 z-[3] pointer-events-none">
              <p className="text-white text-[12px] font-bold leading-snug line-clamp-3 drop-shadow-lg">
                {title}
              </p>
            </div>
          )}
          {isSm && (
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent z-[2] pointer-events-none" />
          )}
        </div>

        {/* Info section */}
        <div className={`${isSm ? "p-2.5" : "p-3.5"}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-themed leading-snug line-clamp-2 ${isSm ? "text-[11px]" : "text-[13px]"}`}>
                {title}
              </h3>
              <div className={`flex items-center gap-1.5 mt-1 ${isSm ? "text-[9px]" : "text-[11px]"}`}>
                <span className="text-themed-tertiary truncate">{subtitle}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${PLATFORM_COLORS[platform] ?? "bg-surface-hover text-themed-secondary"}`}>
                  {platform}
                </span>
                {createdAt && (
                  <span className="text-themed-muted text-[9px] ml-auto shrink-0">{timeAgo(createdAt)}</span>
                )}
              </div>
              {/* Color-coded metric badges */}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {views !== undefined && views > 0 && <MetricBadge type="views" value={views} />}
                {likes !== undefined && likes > 0 && <MetricBadge type="engagement" value={likes} />}
                {saves !== undefined && saves > 0 && <MetricBadge type="saves" value={saves} />}
              </div>
            </div>

            {/* Action menu button */}
            {onAction && !isSm && !selectable && (
              <div ref={menuRef} className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-hover transition-all text-themed-muted hover:text-themed-secondary"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-36 bg-surface-elevated border border-themed rounded-xl shadow-xl py-1.5 z-30">
                    {ACTION_ITEMS.map((item) => (
                      <button
                        key={item.action}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onAction(item.action);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ${item.color}`}
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
        </div>
      </div>
    </div>
  );
};
