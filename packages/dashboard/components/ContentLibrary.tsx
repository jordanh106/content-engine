import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpDown, Search } from "lucide-react";
import type { VideoSummary, FormatId, Audience, ProductionStyle } from "../shared/types.js";
import { PRODUCTION_STYLES, PRODUCTION_STYLE_INFO } from "../shared/types.js";
import { VideoCard } from "./ui/VideoCard.js";
import { SearchInput } from "./ui/SearchInput.js";
import { FilterBar } from "./ui/FilterBar.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ScrollReveal, StaggeredList } from "./ui/animations.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

type SortOption = "default" | "alpha" | "format" | "duration";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "By Audience" },
  { value: "alpha", label: "A-Z" },
  { value: "format", label: "By Format" },
  { value: "duration", label: "By Duration" },
];

type ContentLibraryProps = {
  onSelectVideo: (code: string) => void;
};

export const ContentLibrary: React.FC<ContentLibraryProps> = ({
  onSelectVideo,
}) => {
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<FormatId | null>(null);
  const [remotionOnly, setRemotionOnly] = useState(false);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const { data: videos = [], isLoading: videosLoading } = useQuery<VideoSummary[]>({
    queryKey: ["videos"],
    queryFn: () => fetch("/api/videos").then((r) => r.json()),
  });

  const { data: config } = useQuery<{ audiences: Audience[] }>({
    queryKey: ["config"],
    queryFn: () => fetch("/api/videos/config/industry").then((r) => r.json()),
  });

  const filteredVideos = useMemo(() => {
    let result = videos;

    if (audienceFilter) {
      result = result.filter((v) => v.audience === audienceFilter);
    }
    if (formatFilter) {
      result = result.filter((v) => v.format === formatFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)) ||
          v.scriptPreview.toLowerCase().includes(q),
      );
    }
    if (remotionOnly) {
      result = result.filter((v) => v.remotionGraphicsRequired);
    }
    if (styleFilter) {
      if (styleFilter === "none") {
        result = result.filter((v) => !v.productionStyle);
      } else {
        result = result.filter((v) => v.productionStyle === styleFilter);
      }
    }

    if (sortBy === "alpha") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "format") {
      result = [...result].sort((a, b) => a.format.localeCompare(b.format) || a.code.localeCompare(b.code));
    } else if (sortBy === "duration") {
      result = [...result].sort((a, b) => b.duration - a.duration);
    }

    return result;
  }, [videos, audienceFilter, formatFilter, search, remotionOnly, styleFilter, sortBy]);

  // Group by audience for section headers (or flat when sorting)
  const grouped = useMemo(() => {
    if (sortBy !== "default") {
      // Flat list when sorting by something other than audience
      return [["all", { label: `All Videos`, videos: filteredVideos }]] as [string, { label: string; videos: VideoSummary[] }][];
    }
    const groups: Record<string, { label: string; videos: VideoSummary[] }> = {};
    for (const v of filteredVideos) {
      if (!groups[v.audience]) {
        groups[v.audience] = { label: v.audienceLabel, videos: [] };
      }
      groups[v.audience].videos.push(v);
    }
    return Object.entries(groups);
  }, [filteredVideos, sortBy]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="type-h1">Content library</h1>
        <p className="type-body mt-2">
          {videos.length} videos across {config?.audiences?.length || 0} audience segments
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} />
        <FeatureHint id="format-codes" content={FEATURE_HINTS["format-codes"].content} side="bottom">
          <FilterBar
            audiences={config?.audiences || []}
            selectedAudience={audienceFilter}
            selectedFormat={formatFilter}
            remotionOnly={remotionOnly}
            onAudienceChange={setAudienceFilter}
            onFormatChange={setFormatFilter}
            onRemotionOnlyChange={setRemotionOnly}
          />
        </FeatureHint>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted self-center mr-1">Style:</span>
          <button
            onClick={() => setStyleFilter(null)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-colors",
              !styleFilter ? "bg-slate-900 text-white border-slate-900" : "bg-surface-elevated text-themed-secondary border-themed hover:border-themed",
            )}
          >
            All
          </button>
          {PRODUCTION_STYLES.map((s) => {
            const info = PRODUCTION_STYLE_INFO[s];
            const isActive = styleFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStyleFilter(isActive ? null : s)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-colors",
                  isActive ? cn(info.color.bg, info.color.text, info.color.border) : "bg-surface-elevated text-themed-secondary border-themed hover:border-themed",
                )}
              >
                {info.name}
              </button>
            );
          })}
          <button
            onClick={() => setStyleFilter(styleFilter === "none" ? null : "none")}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-dashed transition-colors",
              styleFilter === "none" ? "bg-surface-hover text-themed-secondary border-themed" : "bg-surface-elevated text-themed-muted border-themed hover:border-themed",
            )}
          >
            No Style
          </button>
        </div>
      </div>

      {/* Results count + Sort */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
          {filteredVideos.length} of {videos.length} videos
        </p>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={12} className="text-themed-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs font-medium text-themed-secondary bg-surface-elevated border border-themed rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video grid */}
      {videosLoading ? (
        <div className="space-y-8 animate-pulse">
          {[...Array(2)].map((_, g) => (
            <section key={g}>
              <div className="h-3 bg-surface-hover rounded w-32 mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-surface-elevated border border-themed rounded-2xl p-4 space-y-3">
                    <div className="h-4 bg-surface-hover rounded w-3/4" />
                    <div className="h-3 bg-surface-hover rounded w-full" />
                    <div className="h-3 bg-surface-hover rounded w-5/6" />
                    <div className="flex gap-1.5">
                      <div className="h-5 bg-surface-hover rounded-full w-8" />
                      <div className="h-5 bg-surface-hover rounded-full w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<Search size={24} className="text-themed-muted" />}
          headline="No videos match"
          description="Try adjusting your filters or search query to find what you're looking for."
          action={{ label: "Clear Filters", onClick: () => {
            setSearch("");
            setAudienceFilter(null);
            setFormatFilter(null);
            setRemotionOnly(false);
            setStyleFilter(null);
            setSortBy("default");
          }}}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([audienceId, group], groupIdx) => (
            <ScrollReveal key={audienceId} delay={groupIdx * 80} as="section">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-3 px-1">
                {group.label} ({group.videos.length})
              </h2>
              <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" stagger={40} {...(groupIdx === 0 ? { "data-tour": "video-card" } : {})}>
                {group.videos.map((video) => (
                  <VideoCard
                    key={video.code}
                    video={video}
                    onClick={() => onSelectVideo(video.code)}
                  />
                ))}
              </StaggeredList>
            </ScrollReveal>
          ))}
        </div>
      )}

      <ViewHelp {...VIEW_HELP.LIBRARY} />
    </div>
  );
};
