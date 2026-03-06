import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquareText,
  Sparkles,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import type { SavedCaption, FormatId, ProductionStatus } from "../shared/types.js";
import { FORMATS } from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP } from "../shared/help-content.js";

const FORMAT_COLORS: Record<string, string> = {
  A: "bg-teal-100 text-teal-700",
  B: "bg-emerald-100 text-emerald-700",
  C: "bg-sky-100 text-sky-700",
  D: "bg-rose-100 text-rose-700",
  E: "bg-violet-100 text-violet-700",
  F: "bg-orange-100 text-orange-700",
  G: "bg-pink-100 text-pink-700",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: "Instagram",
  tiktok: "TikTok",
  youtube_shorts: "YT Shorts",
  youtube_long: "YT Long",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram_reels: "bg-pink-50 text-pink-700 border-pink-200",
  tiktok: "bg-slate-50 text-slate-700 border-slate-300",
  youtube_shorts: "bg-red-50 text-red-700 border-red-200",
  youtube_long: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
  posted: "bg-teal-100 text-teal-700",
};

type VideoSummary = {
  code: string;
  title: string;
  format: FormatId;
  status: ProductionStatus;
  scriptPreview: string;
};

type CaptionsResponse = {
  captions: SavedCaption[];
};

type PipelineVideo = {
  code: string;
  title: string;
  format: FormatId;
  audience: string;
  audienceLabel: string;
  daysInStage: number;
};

type PipelineResponse = {
  stages: Record<ProductionStatus, PipelineVideo[]>;
};

export const CaptionStudio: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Fetch pipeline to get videos in ASSEMBLED/SCHEDULED/PUBLISHED
  const { data: pipelineData } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
  });

  // Build video list from pipeline stages that need captions
  const captionableVideos: VideoSummary[] = React.useMemo(() => {
    if (!pipelineData?.stages) return [];
    const stages: ProductionStatus[] = ["ASSEMBLED", "SCHEDULED", "PUBLISHED"];
    const videos: VideoSummary[] = [];
    for (const stage of stages) {
      for (const v of pipelineData.stages[stage] || []) {
        videos.push({
          code: v.code,
          title: v.title,
          format: v.format,
          status: stage,
          scriptPreview: "",
        });
      }
    }
    return videos;
  }, [pipelineData]);

  // Fetch captions for selected video
  const { data: captionsData } = useQuery<CaptionsResponse>({
    queryKey: ["captions", selectedVideo],
    queryFn: () => fetch(`/api/captions/${selectedVideo}`).then((r) => r.json()),
    enabled: !!selectedVideo,
  });

  // Fetch video detail for script
  const { data: videoDetail } = useQuery({
    queryKey: ["video-detail", selectedVideo],
    queryFn: () => fetch(`/api/videos/${selectedVideo}`).then((r) => r.json()),
    enabled: !!selectedVideo,
  });

  // Caption coverage per video
  const { data: allCaptionCounts } = useQuery<Record<string, number>>({
    queryKey: ["caption-counts"],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const v of captionableVideos) {
        const res = await fetch(`/api/captions/${v.code}`);
        const data = await res.json();
        const platforms = new Set((data.captions || []).map((c: SavedCaption) => c.platform));
        counts[v.code] = platforms.size;
      }
      return counts;
    },
    enabled: captionableVideos.length > 0,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (videoCode: string) => {
      const r = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: `Server error: ${r.status}` }));
        throw new Error(d.error || "Generation failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
      queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/captions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
      queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: number; caption: string }) => {
      const r = await fetch(`/api/captions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      return r.json();
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
    },
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/captions/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
    },
  });

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (caption: SavedCaption) => {
    setEditingId(caption.id);
    setEditText(caption.caption);
  };

  const captions = captionsData?.captions || [];
  const platforms = ["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"];

  // Group captions by platform
  const captionsByPlatform = platforms.map((p) => ({
    platform: p,
    captions: captions.filter((c) => c.platform === p),
  }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-slate-900">Caption Studio</h1>
            <ViewHelp {...VIEW_HELP.CAPTIONS} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Generate and manage social media captions for your videos
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video Selector */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Videos Ready for Captions
            </p>

            {/* Status filter */}
            <div className="flex gap-1 mb-3">
              {["all", "ASSEMBLED", "SCHEDULED", "PUBLISHED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                    statusFilter === s
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                >
                  {s === "all" ? "All" : s.slice(0, 4)}
                </button>
              ))}
            </div>

            {/* Video list */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {captionableVideos.length === 0 && (
                <EmptyState
                  icon={<MessageSquareText size={24} className="text-slate-400" />}
                  headline="No videos ready for captions"
                  description="Move videos to ASSEMBLED, SCHEDULED, or PUBLISHED stage in the pipeline first."
                  compact
                />
              )}
              {captionableVideos
                .filter((v) => statusFilter === "all" || v.status === statusFilter)
                .map((v) => {
                  const count = allCaptionCounts?.[v.code] || 0;
                  return (
                    <button
                      key={v.code}
                      onClick={() => setSelectedVideo(v.code)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-colors",
                        selectedVideo === v.code
                          ? "border-teal-300 bg-teal-50"
                          : "border-slate-200 hover:border-slate-300 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-500">{v.code}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", FORMAT_COLORS[v.format] || "bg-slate-100")}>
                          {v.format}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{v.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {v.status}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          count >= 4 ? "bg-emerald-100 text-emerald-700" :
                          count > 0 ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500",
                        )}>
                          {count}/4
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Caption Workspace */}
        <div data-tour="caption-workspace" className="flex-1 min-w-0">
          {!selectedVideo ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <MessageSquareText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-lg font-serif font-bold text-slate-600 mb-2">Select a Video</p>
              <p className="text-sm text-slate-400">
                Choose a video from the list to generate and manage captions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video context */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-500">{selectedVideo}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", FORMAT_COLORS[videoDetail?.format] || "bg-slate-100")}>
                      {videoDetail?.format ? `${videoDetail.format} - ${FORMATS[videoDetail.format as FormatId]?.name || ""}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedVideo) generateMutation.mutate(selectedVideo);
                    }}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {generateMutation.isPending ? "Generating..." : "Generate All"}
                  </button>
                </div>
                <p className="text-sm font-medium text-slate-800 mt-2">{videoDetail?.title || ""}</p>

                {/* Collapsible script */}
                {videoDetail?.script && (
                  <div className="mt-3">
                    <button
                      onClick={() => setScriptExpanded(!scriptExpanded)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600"
                    >
                      {scriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Video Script
                    </button>
                    {scriptExpanded && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {videoDetail.script}
                      </div>
                    )}
                  </div>
                )}

                {generateMutation.isError && (
                  <p className="text-sm text-red-600 mt-2">{generateMutation.error.message}</p>
                )}
              </div>

              {/* Platform sections */}
              {captionsByPlatform.map(({ platform, captions: platCaptions }) => (
                <div key={platform} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", PLATFORM_COLORS[platform])}>
                        {PLATFORM_LABELS[platform] || platform}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {platCaptions.length} variant{platCaptions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {platCaptions.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No captions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {platCaptions.map((cap) => (
                        <div key={cap.id} className="border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400">v{cap.variant}</span>
                              <button
                                onClick={() => {
                                  const next = cap.status === "draft" ? "approved" : cap.status === "approved" ? "posted" : "draft";
                                  statusMutation.mutate({ id: cap.id, status: next });
                                }}
                                className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors", STATUS_COLORS[cap.status])}
                              >
                                {cap.status}
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(cap)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleCopy(cap.id, cap.caption)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-600"
                                title="Copy"
                              >
                                {copiedId === cap.id ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(cap.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {editingId === cap.id ? (
                            <div>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                                rows={4}
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => editMutation.mutate({ id: cap.id, caption: editText })}
                                  className="px-3 py-1 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{cap.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
