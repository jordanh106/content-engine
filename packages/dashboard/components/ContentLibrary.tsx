import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpDown } from "lucide-react";
import type { VideoSummary, FormatId, Audience } from "../shared/types.js";
import { VideoCard } from "./ui/VideoCard.js";
import { SearchInput } from "./ui/SearchInput.js";
import { FilterBar } from "./ui/FilterBar.js";
import { cn } from "../utils/cn.js";

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

    if (sortBy === "alpha") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "format") {
      result = [...result].sort((a, b) => a.format.localeCompare(b.format) || a.code.localeCompare(b.code));
    } else if (sortBy === "duration") {
      result = [...result].sort((a, b) => b.duration - a.duration);
    }

    return result;
  }, [videos, audienceFilter, formatFilter, search, remotionOnly, sortBy]);

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
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
          Content Library
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {videos.length} videos across {config?.audiences?.length || 0} audience segments
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} />
        <FilterBar
          audiences={config?.audiences || []}
          selectedAudience={audienceFilter}
          selectedFormat={formatFilter}
          remotionOnly={remotionOnly}
          onAudienceChange={setAudienceFilter}
          onFormatChange={setFormatFilter}
          onRemotionOnlyChange={setRemotionOnly}
        />
      </div>

      {/* Results count + Sort */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {filteredVideos.length} of {videos.length} videos
        </p>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={12} className="text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
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
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No videos match your filters
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([audienceId, group]) => (
            <section key={audienceId}>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
                {group.label} ({group.videos.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.videos.map((video) => (
                  <VideoCard
                    key={video.code}
                    video={video}
                    onClick={() => onSelectVideo(video.code)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
