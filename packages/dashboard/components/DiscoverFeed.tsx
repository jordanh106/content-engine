import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Link2,
  Loader2,
  Star,
  Bookmark,
  Archive,
  Inbox,
  TrendingUp,
  Plus,
  Check,
  Sparkles,
} from "lucide-react";
import { VideoGrid } from "./ui/VideoGrid.js";
import type { CardAction } from "./ui/VideoThumbnailCard.js";
import type { DashboardView, CreatorVideo, TrendingTopic } from "../shared/types.js";

type DiscoverFeedProps = {
  onSelectVideo: (code: string) => void;
  onNavigate: (view: DashboardView) => void;
};

type FeedResponse = {
  videos: CreatorVideo[];
  total: number;
  statusCounts: Record<string, number>;
  trending: TrendingTopic[];
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

// Gradient colors for trending topic cards
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

  // Build query params
  const params = new URLSearchParams();
  if (activeStatus !== "all") params.set("status", activeStatus);
  params.set("sort", sort);
  if (dateRange !== "all") params.set("dateRange", dateRange);

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: ["discover-feed", activeStatus, sort, dateRange],
    queryFn: () => fetch(`/api/discover/feed?${params}`).then((r) => r.json()),
  });

  // Quick-add URL mutation
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

  // Status update mutation
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

  // Delete mutation
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

  const handleVideoClick = (video: CreatorVideo) => {
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

  const videos = data?.videos ?? [];
  const statusCounts = data?.statusCounts ?? {};
  const trending = data?.trending ?? [];

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Compass size={20} className="text-teal-600" />
          <h1 className="text-xl font-bold text-slate-900 font-serif">Discover</h1>
        </div>
        <p className="text-sm text-slate-500">
          Video inspiration from creators you follow and across the web.
        </p>
      </div>

      {/* Paste URL input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
            placeholder="Paste YouTube, TikTok, or Instagram URL..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 bg-white"
          />
        </div>
        <button
          onClick={handleSubmitUrl}
          disabled={addUrlMutation.isPending || !urlInput.trim()}
          className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
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
        <p className="text-xs text-rose-500">{(addUrlMutation.error as Error).message}</p>
      )}
      {addUrlMutation.isSuccess && (addUrlMutation.data as { duplicate: boolean }).duplicate && (
        <p className="text-xs text-amber-600">Video already exists in your feed.</p>
      )}

      {/* Status tabs with counts */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all" ? statusCounts.all ?? 0 : statusCounts[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                ${activeStatus === tab.key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                }
              `}
            >
              {tab.icon}
              {tab.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeStatus === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort + Date filter row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="text-slate-400 font-medium">Sort:</span>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                sort === opt.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-slate-300">|</span>
        <span className="text-slate-400 font-medium">Published:</span>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {DATE_FILTERS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDateRange(opt.key)}
              className={`px-2 py-1 rounded-md font-bold transition-colors ${
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

      {/* Video grid */}
      <VideoGrid
        videos={videos}
        onVideoClick={handleVideoClick}
        onVideoAction={handleVideoAction}
        isLoading={isLoading}
        emptyState={
          <div className="text-center py-16 space-y-3">
            <Compass size={40} className="text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-600">No videos yet</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Paste a YouTube or TikTok URL above, or scan creators from the Watchlist to start discovering.
            </p>
            <button
              onClick={() => onNavigate("WATCHLIST")}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-teal-700"
            >
              Go to Watchlist
            </button>
          </div>
        }
      />

      {/* Trending Topics section (below video grid) */}
      {trending.length > 0 && (
        <section className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-violet-500" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
              Trending Topics
            </h2>
            <span className="text-[10px] text-slate-400">from weekly intelligence digest</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trending.map((topic, i) => {
              const gradient = TOPIC_GRADIENTS[i % TOPIC_GRADIENTS.length];
              return (
                <div
                  key={i}
                  onClick={() => onNavigate("IDEAS")}
                  className="relative overflow-hidden rounded-xl p-3.5 cursor-pointer group hover:shadow-md transition-all"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-1.5">
                      <TrendingUp size={14} className="text-white/70" />
                      <span className="text-white/60 text-[9px] font-medium">{topic.platforms.join(", ")}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm leading-tight">{topic.topic}</h3>
                    {topic.context && (
                      <p className="text-white/70 text-[10px] mt-1 leading-snug line-clamp-2">{topic.context}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
