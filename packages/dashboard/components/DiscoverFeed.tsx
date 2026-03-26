import React, { useState, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Link2,
  Loader2,
  Star,
  Bookmark,
  Archive,
  TrendingUp,
  Plus,
  Sparkles,
  X,
  Trash2,
  CheckSquare,
} from "lucide-react";
import { VideoGrid } from "./ui/VideoGrid.js";
import { BulkActionBar } from "./ui/BulkActionBar.js";
import { VideoBottomSheet } from "./ui/VideoBottomSheet.js";
import type { CardAction } from "./ui/VideoThumbnailCard.js";
import type { DashboardView, CreatorVideo, TrendingTopic } from "../shared/types.js";

const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

type DiscoverFeedProps = {
  onSelectVideo: (code: string) => void;
  onNavigate: (view: DashboardView) => void;
};

type FeedPage = {
  videos: CreatorVideo[];
  total: number;
  statusCounts: Record<string, number> | null;
  trending: TrendingTopic[] | null;
  hasMore: boolean;
  nextOffset: number | null;
};

const STATUS_TABS = [
  { key: "all", label: "All", icon: <Compass size={13} /> },
  { key: "starred", label: "Starred", icon: <Star size={13} /> },
  { key: "saved", label: "Saved", icon: <Bookmark size={13} /> },
  { key: "archived", label: "Archived", icon: <Archive size={13} /> },
] as const;

const SORT_OPTIONS = [
  { key: "dateAdded", label: "Date Added" },
  { key: "views", label: "Views" },
  { key: "outlier", label: "Outlier" },
  { key: "creator", label: "Creator" },
] as const;

const DATE_FILTERS = [
  { key: "all", label: "All time" },
  { key: "7", label: "7 days" },
  { key: "14", label: "14 days" },
  { key: "30", label: "30 days" },
  { key: "60", label: "60 days" },
  { key: "90", label: "90 days" },
] as const;

const TOPIC_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-orange-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-pink-500 to-fuchsia-600",
  "from-amber-500 to-orange-600",
];

export const DiscoverFeed: React.FC<DiscoverFeedProps> = ({ onSelectVideo, onNavigate }) => {
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState("all");
  const [sort, setSort] = useState("dateAdded");
  const [dateRange, setDateRange] = useState("all");
  const [urlInput, setUrlInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [bottomSheetVideo, setBottomSheetVideo] = useState<CreatorVideo | null>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedPage>({
    queryKey: ["discover-feed", activeStatus, sort, dateRange],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (activeStatus !== "all") params.set("status", activeStatus);
      params.set("sort", sort);
      if (dateRange !== "all") params.set("dateRange", dateRange);
      if (pageParam) params.set("offset", String(pageParam));
      params.set("limit", "30");
      return fetch(`/api/discover/feed?${params}`).then((r) => r.json());
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });

  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const r = await fetch("/api/discover/add-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to add video");
      }
      return r.json();
    },
    onSuccess: () => {
      setUrlInput("");
      queryClient.invalidateQueries({ queryKey: ["discover-feed"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/creator-videos/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discover-feed"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/creator-videos/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discover-feed"] });
    },
  });

  // Bulk action mutations
  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      const r = await fetch("/api/discover/batch-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectionMode(false);
      queryClient.invalidateQueries({ queryKey: ["discover-feed"] });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const r = await fetch("/api/discover/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setSelectionMode(false);
      queryClient.invalidateQueries({ queryKey: ["discover-feed"] });
    },
  });

  const handleVideoClick = (video: CreatorVideo) => {
    if (selectionMode) {
      toggleSelect(video.id);
      return;
    }
    if (isMobile) {
      setBottomSheetVideo(video);
      return;
    }
    if (video.videoUrl && video.videoUrl !== "unknown") {
      window.open(video.videoUrl, "_blank", "noopener");
    }
  };

  const handleVideoAction = (video: CreatorVideo, action: CardAction) => {
    if (action === "delete") {
      deleteMutation.mutate(video.id);
    } else {
      const statusMap: Record<string, string> = { star: "starred", save: "saved", archive: "archived" };
      statusMutation.mutate({ id: video.id, status: statusMap[action] || action });
    }
  };

  const handleSubmitUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    addUrlMutation.mutate(url);
  };

  const toggleSelect = useCallback((id: number, shiftKey = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedId !== null) {
        // Range select
        const allVideos = videos;
        const lastIdx = allVideos.findIndex((v) => v.id === lastSelectedId);
        const curIdx = allVideos.findIndex((v) => v.id === id);
        if (lastIdx >= 0 && curIdx >= 0) {
          const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
          for (let i = start; i <= end; i++) {
            next.add(allVideos[i].id);
          }
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
    if (!selectionMode) setSelectionMode(true);
  }, [lastSelectedId, selectionMode]);

  const handleBulkAction = (action: string) => {
    const ids = Array.from(selectedIds);
    if (action === "delete") {
      batchDeleteMutation.mutate(ids);
    } else {
      batchStatusMutation.mutate({ ids, status: action });
    }
  };

  const exitSelectionMode = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setLastSelectedId(null);
  };

  // Flatten paginated data
  const videos = data?.pages.flatMap((p) => p.videos) ?? [];
  const statusCounts = data?.pages[0]?.statusCounts ?? {};
  const trending = data?.pages[0]?.trending ?? [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Compass size={22} className="text-teal-600" />
          <h1 className="text-2xl font-bold text-slate-900 font-serif">Discover</h1>
        </div>
        <p className="text-sm text-slate-500">
          Video inspiration from creators you follow and across the web.
        </p>
      </div>

      {/* URL input card (hidden on mobile, replaced by FAB) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
              placeholder="Paste YouTube, TikTok, or Instagram URL..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 bg-slate-50"
            />
          </div>
          <button
            onClick={handleSubmitUrl}
            disabled={addUrlMutation.isPending || !urlInput.trim()}
            className="px-5 py-3 rounded-xl bg-teal-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0 shadow-sm"
          >
            {addUrlMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </div>
        {addUrlMutation.isError && (
          <p className="text-xs text-rose-500 mt-2">{(addUrlMutation.error as Error).message}</p>
        )}
        {addUrlMutation.isSuccess && (addUrlMutation.data as { duplicate: boolean }).duplicate && (
          <p className="text-xs text-amber-600 mt-2">Video already exists in your feed.</p>
        )}
      </div>

      {/* Status tabs + Sort/Filter bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === "all" ? statusCounts.all ?? 0 : statusCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveStatus(tab.key)}
                className={`
                  inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all
                  ${activeStatus === tab.key
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeStatus === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-200/60 text-slate-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort + Date filter */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-slate-400 font-semibold uppercase tracking-wider">Sort</span>
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  sort === opt.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200" />

          <span className="text-slate-400 font-semibold uppercase tracking-wider">Published</span>
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
            {DATE_FILTERS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDateRange(opt.key)}
                className={`px-2.5 py-1.5 rounded-md font-bold transition-colors ${
                  dateRange === opt.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Video grid */}
      <VideoGrid
        videos={videos}
        onVideoClick={handleVideoClick}
        onVideoAction={handleVideoAction}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        emptyState={
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Compass size={28} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No videos yet</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              Paste a YouTube or TikTok URL above, or scan creators from the Watchlist to start building your inspiration feed.
            </p>
            <button
              onClick={() => onNavigate("WATCHLIST")}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-teal-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-teal-700 shadow-sm"
            >
              Go to Watchlist
            </button>
          </div>
        }
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={videos.length}
          onAction={handleBulkAction}
          onSelectAll={() => {
            setSelectedIds(new Set(videos.map((v) => v.id)));
            if (!selectionMode) setSelectionMode(true);
          }}
          onDeselectAll={exitSelectionMode}
          isPending={batchStatusMutation.isPending || batchDeleteMutation.isPending}
        />
      )}

      {/* Trending Topics */}
      {trending.length > 0 && (
        <section className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-violet-500" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
              Trending Topics
            </h2>
            <span className="text-[10px] text-slate-400 font-medium">from weekly intelligence digest</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((topic, i) => {
              const gradient = TOPIC_GRADIENTS[i % TOPIC_GRADIENTS.length];
              return (
                <div
                  key={i}
                  onClick={() => onNavigate("IDEAS")}
                  className="relative overflow-hidden rounded-2xl p-4 cursor-pointer group hover:shadow-md transition-all"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <TrendingUp size={14} className="text-white/70" />
                      <span className="text-white/60 text-[9px] font-semibold uppercase tracking-wider">{topic.platforms.join(", ")}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm leading-tight">{topic.topic}</h3>
                    {topic.context && (
                      <p className="text-white/70 text-[10px] mt-1.5 leading-snug line-clamp-2">{topic.context}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Mobile FAB for adding URLs */}
      {!selectionMode && (
        <button
          onClick={() => setShowUrlModal(true)}
          className="md:hidden fixed bottom-24 right-4 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 flex items-center justify-center z-30 active:scale-95 transition-transform"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Mobile URL input modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 animate-fade-in" onClick={() => setShowUrlModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl p-5 animate-slide-up safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Add Video</h3>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { handleSubmitUrl(); setShowUrlModal(false); } }}
                  placeholder="Paste URL..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 bg-slate-50"
                />
              </div>
              <button
                onClick={() => { handleSubmitUrl(); setShowUrlModal(false); }}
                disabled={addUrlMutation.isPending || !urlInput.trim()}
                className="px-5 py-3 rounded-xl bg-teal-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
              >
                {addUrlMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet for video details */}
      {bottomSheetVideo && (
        <VideoBottomSheet
          video={bottomSheetVideo}
          onAction={(action) => handleVideoAction(bottomSheetVideo, action)}
          onClose={() => setBottomSheetVideo(null)}
        />
      )}
    </div>
  );
};
