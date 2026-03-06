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
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  Hash,
  Upload,
} from "lucide-react";
import type { ConversationMessage } from "../shared/types.js";
import type { SavedCaption, FormatId, ProductionStatus } from "../shared/types.js";
import { FORMATS } from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP } from "../shared/help-content.js";
import { scoreCaption, type ScoreBreakdown } from "../utils/caption-scoring.js";

const PLATFORM_LIMITS: Record<string, { max: number; hookVisible: number }> = {
  instagram_reels: { max: 2200, hookVisible: 125 },
  tiktok: { max: 4000, hookVisible: 100 },
  youtube_shorts: { max: 100, hookVisible: 100 },
  youtube_long: { max: 5000, hookVisible: 200 },
};

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

// Quality score badge with hover breakdown
const ScoreBadge: React.FC<{ score: ScoreBreakdown }> = ({ score }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const color = score.total >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : score.total >= 50 ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";

  const categories = [
    { label: "Hook", value: score.hook, max: 25 },
    { label: "CTA", value: score.cta, max: 20 },
    { label: "Readability", value: score.readability, max: 20 },
    { label: "Hashtags", value: score.hashtags, max: 15 },
    { label: "Emoji", value: score.emoji, max: 10 },
    { label: "Length", value: score.length, max: 10 },
  ];

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowBreakdown(true)}
        onMouseLeave={() => setShowBreakdown(false)}
        onClick={() => setShowBreakdown(!showBreakdown)}
        className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums", color)}
      >
        {score.total}
      </button>
      {showBreakdown && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl p-3 shadow-xl min-w-[180px]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Score Breakdown</p>
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-600">{cat.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      cat.value / cat.max >= 0.7 ? "bg-emerald-500" : cat.value / cat.max >= 0.4 ? "bg-amber-500" : "bg-red-400",
                    )}
                    style={{ width: `${(cat.value / cat.max) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 tabular-nums w-8 text-right">
                  {cat.value}/{cat.max}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
  posted: "bg-teal-100 text-teal-700",
};

// Character count display
const CharCount: React.FC<{ text: string; platform: string }> = ({ text, platform }) => {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return null;
  const len = text.length;
  const ratio = len / limits.max;
  const color = ratio > 1 ? "text-red-500" : ratio > 0.9 ? "text-amber-500" : "text-slate-400";
  const hookText = text.split("\n")[0] || "";
  const hookLen = hookText.length;
  const showHook = platform === "instagram_reels" || platform === "tiktok";

  return (
    <div className="flex flex-col items-end gap-0.5 mt-1.5">
      <span className={cn("text-[10px] font-bold tabular-nums", color)}>
        {len.toLocaleString()} / {limits.max.toLocaleString()}
      </span>
      {showHook && (
        <span className={cn(
          "text-[10px] font-bold tabular-nums",
          hookLen > limits.hookVisible ? "text-amber-500" : "text-slate-400",
        )}>
          Hook: {hookLen} / {limits.hookVisible} visible
        </span>
      )}
    </div>
  );
};

// Platform preview mockups
const PlatformPreview: React.FC<{ caption: string; platform: string }> = ({ caption, platform }) => {
  const limits = PLATFORM_LIMITS[platform];
  const hookVisible = limits?.hookVisible || 100;

  if (platform === "instagram_reels") {
    const truncated = caption.length > hookVisible;
    return (
      <div className="bg-black rounded-xl p-4 max-w-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500" />
          <span className="text-white text-xs font-bold">collectivefamilychiro</span>
        </div>
        <p className="text-white text-xs leading-relaxed">
          {truncated ? caption.slice(0, hookVisible) : caption}
          {truncated && <span className="text-blue-400"> ...more</span>}
        </p>
        <div className="flex items-center gap-4 mt-3 text-white/60">
          <span className="text-sm">♡</span>
          <span className="text-sm">💬</span>
          <span className="text-sm">↗</span>
          <span className="text-sm ml-auto">⊏⊐</span>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    const truncated = caption.length > hookVisible;
    return (
      <div className="bg-black rounded-xl p-4 max-w-[280px] relative min-h-[160px] flex flex-col justify-end">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs font-bold">@collectivefamilychiro</span>
        </div>
        <p className="text-white text-[11px] leading-relaxed">
          {truncated ? caption.slice(0, hookVisible) + "..." : caption}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-white/40 text-[10px]">♫ original sound</span>
        </div>
      </div>
    );
  }

  // YouTube (shorts or long)
  const isShorts = platform === "youtube_shorts";
  const titleLimit = isShorts ? 100 : 200;
  const title = caption.split("\n")[0] || caption;
  const body = caption.split("\n").slice(1).join("\n").trim();
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-[280px]">
      <p className="text-sm font-bold text-slate-900 line-clamp-2">
        {title.length > titleLimit ? title.slice(0, titleLimit) + "..." : title}
      </p>
      {body && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-3">{body}</p>
      )}
      <div className="flex items-center gap-3 mt-3 text-slate-400">
        <span className="text-xs">👍</span>
        <span className="text-xs">👎</span>
        <span className="text-xs">↗ Share</span>
      </div>
    </div>
  );
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
  const [editHook, setEditHook] = useState("");
  const [editBody, setEditBody] = useState("");
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [previewPlatforms, setPreviewPlatforms] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ConversationMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  type VideoAnalysisResult = {
    visualDescription?: string;
    mood?: string;
    hookSuggestions?: string[];
    captionSuggestions?: Record<string, string>;
    hashtagSuggestions?: string[];
    keyMoments?: Array<{ timestamp: string; description: string }>;
    transcript?: string;
  };
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<Array<{ videoCode: string; status: string }> | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"edit" | "publish">("edit");

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

  // Caption coverage per video (batch endpoint)
  const { data: allCaptionCounts } = useQuery<Record<string, number>>({
    queryKey: ["caption-counts"],
    queryFn: () => fetch("/api/captions/counts").then((r) => r.json()),
    enabled: captionableVideos.length > 0,
  });

  // Generate mutation (supports optional platforms filter)
  const generateMutation = useMutation({
    mutationFn: async ({ videoCode, platforms: plats }: { videoCode: string; platforms?: string[] }) => {
      const r = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode, platforms: plats }),
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
    const lines = caption.caption.split("\n");
    setEditHook(lines[0] || "");
    setEditBody(lines.slice(1).join("\n").replace(/^\n+/, ""));
  };

  const togglePreview = (platform: string) => {
    setPreviewPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  // Chat refinement handler
  const handleChatSubmit = async (prompt: string) => {
    if (!selectedVideo || !prompt.trim()) return;
    setChatLoading(true);
    const newHistory = [...chatHistory, { role: "user" as const, content: prompt }];
    setChatHistory(newHistory);
    setChatInput("");
    try {
      const r = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoCode: selectedVideo,
          prompt,
          conversationHistory: newHistory,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setChatHistory([...newHistory, { role: "assistant", content: data.message || "Captions updated." }]);
        queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
        queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
      } else {
        setChatHistory([...newHistory, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch {
      setChatHistory([...newHistory, { role: "assistant", content: "Network error." }]);
    }
    setChatLoading(false);
  };

  // Suggest hashtags
  const handleSuggestHashtags = async () => {
    if (!selectedVideo) return;
    setChatLoading(true);
    try {
      const r = await fetch("/api/captions/suggest-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode: selectedVideo, platform: "instagram_reels" }),
      });
      const data = await r.json();
      if (r.ok) setHashtagSuggestions(data.hashtags || []);
    } catch { /* ignore */ }
    setChatLoading(false);
  };

  // Video upload + analysis
  const handleVideoUpload = async (file: File) => {
    setAnalysisLoading(true);
    setShowUpload(false);
    setAnalysisStep("Uploading...");

    const formData = new FormData();
    formData.append("video", file);
    if (selectedVideo) formData.append("videoCode", selectedVideo);

    try {
      setAnalysisStep("Extracting frames & analyzing...");
      const r = await fetch("/api/video-analysis/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (r.ok) {
        setVideoAnalysis(data.analysis);
        setAnalysisStep("");
      } else {
        setAnalysisStep(`Error: ${data.error}`);
        setTimeout(() => setAnalysisStep(""), 5000);
      }
    } catch {
      setAnalysisStep("Upload failed. Try again.");
      setTimeout(() => setAnalysisStep(""), 5000);
    }
    setAnalysisLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      handleVideoUpload(file);
    }
  };

  // Batch generation
  const handleBatchGenerate = async () => {
    const codes = [...batchSelected];
    if (codes.length === 0) return;
    setBatchProgress(codes.map((c) => ({ videoCode: c, status: "pending" })));
    try {
      const r = await fetch("/api/captions/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCodes: codes }),
      });
      const data = await r.json();
      if (r.ok) {
        setBatchProgress(data.results);
        queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
        queryClient.invalidateQueries({ queryKey: ["captions"] });
        setTimeout(() => {
          setBatchProgress(null);
          setBatchSelected(new Set());
        }, 3000);
      }
    } catch {
      setBatchProgress(null);
    }
  };

  const toggleBatchSelect = (code: string) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const CHAT_CHIPS = [
    "Make it more casual",
    "Add a question hook",
    "Shorter for TikTok",
    "Add a save-worthy CTA",
    "More emojis",
    "Remove hashtags",
  ];

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
                    <div key={v.code} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={batchSelected.has(v.code)}
                        onChange={() => toggleBatchSelect(v.code)}
                        className="mt-3.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0"
                      />
                      <button
                        onClick={() => setSelectedVideo(v.code)}
                        className={cn(
                          "flex-1 text-left p-3 rounded-xl border transition-colors",
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
                    </div>
                  );
                })}
            </div>

            {/* Batch generate button */}
            {batchSelected.size >= 2 && (
              <button
                onClick={handleBatchGenerate}
                disabled={!!batchProgress}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                Generate {batchSelected.size} Selected
              </button>
            )}

            {/* Batch progress */}
            {batchProgress && (
              <div className="mt-3 space-y-1">
                {batchProgress.map((r) => (
                  <div key={r.videoCode} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">{r.videoCode}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      r.status === "success" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "error" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-500",
                    )}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowUpload(true)}
                      disabled={analysisLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {analysisLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {analysisLoading ? analysisStep : "Analyze Video"}
                    </button>
                    <button
                      onClick={() => {
                        if (selectedVideo) generateMutation.mutate({ videoCode: selectedVideo });
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

              {/* Upload overlay */}
              {showUpload && (
                <div
                  className="bg-white border-2 border-dashed border-teal-300 rounded-2xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "video/mp4,video/quicktime,video/webm";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleVideoUpload(file);
                    };
                    input.click();
                  }}
                >
                  <Upload size={32} className="mx-auto text-teal-400 mb-3" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Drop a video file here or click to browse
                  </p>
                  <p className="text-xs text-slate-400">
                    MP4, MOV, or WebM (max 200MB). AI will analyze visuals and audio.
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowUpload(false); }}
                    className="mt-3 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Video Analysis Results */}
              {videoAnalysis && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Video Analysis
                    </p>
                    <button
                      onClick={() => setVideoAnalysis(null)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Visual description & mood */}
                  <p className="text-sm text-slate-700 mb-2">{videoAnalysis.visualDescription || ""}</p>
                  {videoAnalysis.mood ? (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold mb-3">
                      {videoAnalysis.mood}
                    </span>
                  ) : null}

                  {/* Hook suggestions */}
                  {videoAnalysis.hookSuggestions && videoAnalysis.hookSuggestions.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Hook Ideas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {videoAnalysis.hookSuggestions.map((hook, i) => (
                          <button
                            key={i}
                            onClick={() => navigator.clipboard.writeText(hook)}
                            className="px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                            title="Click to copy"
                          >
                            {hook}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Hashtag suggestions from analysis */}
                  {videoAnalysis.hashtagSuggestions && videoAnalysis.hashtagSuggestions.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Hashtags</p>
                      <div className="flex flex-wrap gap-1">
                        {videoAnalysis.hashtagSuggestions.map((tag, i) => (
                          <button
                            key={i}
                            onClick={() => navigator.clipboard.writeText(tag)}
                            className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-xs text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Use These Captions button */}
                  {videoAnalysis.captionSuggestions ? (
                    <button
                      onClick={() => {
                        const suggestions = videoAnalysis.captionSuggestions!;
                        // Save each suggestion as a draft caption
                        for (const [plat, caption] of Object.entries(suggestions)) {
                          if (caption && selectedVideo) {
                            fetch("/api/captions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ videoCode: selectedVideo, platform: plat, caption, status: "draft" }),
                            });
                          }
                        }
                        queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
                        queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
                      }}
                      className="px-4 py-2 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
                    >
                      Use These Captions
                    </button>
                  ) : null}

                  {/* Transcript */}
                  {videoAnalysis.transcript ? (
                    <div className="mt-3">
                      <button
                        onClick={() => setScriptExpanded(!scriptExpanded)}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600"
                      >
                        {scriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        Transcript
                      </button>
                      {scriptExpanded && (
                        <p className="mt-1 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
                          {videoAnalysis.transcript}
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Key moments */}
                  {videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Key Moments</p>
                      <div className="space-y-1">
                        {videoAnalysis.keyMoments.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-slate-400 w-10">{m.timestamp}</span>
                            <span className="text-slate-600">{m.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* AI Chat Refinement */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-2 w-full"
                >
                  <Sparkles size={14} className="text-teal-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    AI Refinement
                  </span>
                  {chatOpen ? <ChevronUp size={12} className="text-slate-400 ml-auto" /> : <ChevronDown size={12} className="text-slate-400 ml-auto" />}
                </button>

                {chatOpen && (
                  <div className="mt-3 space-y-3">
                    {/* Suggestion chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {CHAT_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => handleChatSubmit(chip)}
                          disabled={chatLoading}
                          className="px-2.5 py-1 rounded-full border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          {chip}
                        </button>
                      ))}
                      <button
                        onClick={handleSuggestHashtags}
                        disabled={chatLoading}
                        className="px-2.5 py-1 rounded-full border border-teal-200 text-[10px] font-bold text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Hash size={10} />
                        Suggest Hashtags
                      </button>
                    </div>

                    {/* Hashtag suggestions */}
                    {hashtagSuggestions.length > 0 && (
                      <div className="p-3 bg-teal-50 rounded-xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700 mb-2">Suggested Hashtags</p>
                        <div className="flex flex-wrap gap-1">
                          {hashtagSuggestions.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => {
                                navigator.clipboard.writeText(tag);
                              }}
                              className="px-2 py-0.5 rounded-full bg-white border border-teal-200 text-xs text-teal-700 hover:bg-teal-100 transition-colors"
                              title="Click to copy"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(hashtagSuggestions.join(" "));
                          }}
                          className="text-[10px] font-bold text-teal-600 mt-2 hover:underline"
                        >
                          Copy all
                        </button>
                      </div>
                    )}

                    {/* Chat history */}
                    {chatHistory.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {chatHistory.map((msg, i) => (
                          <div key={i} className={cn("text-xs rounded-xl p-2.5", msg.role === "user" ? "bg-slate-50 text-slate-700 ml-8" : "bg-teal-50 text-teal-800 mr-8")}>
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chat input */}
                    <div className="flex gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(chatInput);
                          }
                        }}
                        placeholder="Tell AI how to refine captions..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={chatLoading}
                      />
                      <button
                        onClick={() => handleChatSubmit(chatInput)}
                        disabled={chatLoading || !chatInput.trim()}
                        className="p-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      >
                        {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tab toggle: Edit | Publish Kit */}
              <div className="flex gap-1 bg-slate-100 rounded-full p-1 w-fit">
                {(["edit", "publish"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setWorkspaceTab(tab)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors",
                      workspaceTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {tab === "edit" ? "Edit" : "Publish Kit"}
                  </button>
                ))}
              </div>

              {/* Publish Kit view */}
              {workspaceTab === "publish" && (
                <div className="space-y-3">
                  {platforms.map((plat) => {
                    const platCaps = captions.filter((c) => c.platform === plat);
                    const approved = platCaps.find((c) => c.status === "approved") || platCaps[0];
                    return (
                      <div key={plat} className="bg-white border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", PLATFORM_COLORS[plat])}>
                            {PLATFORM_LABELS[plat]}
                          </span>
                          {approved ? (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_COLORS[approved.status])}>
                              {approved.status}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                              Missing
                            </span>
                          )}
                        </div>
                        {approved ? (
                          <>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3 line-clamp-4">{approved.caption}</p>
                            <button
                              onClick={() => handleCopy(approved.id, approved.caption)}
                              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                            >
                              {copiedId === approved.id ? <Check size={14} /> : <Copy size={14} />}
                              {copiedId === approved.id ? "Copied!" : "Copy Caption"}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              if (selectedVideo) generateMutation.mutate({ videoCode: selectedVideo, platforms: [plat] });
                            }}
                            disabled={generateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                          >
                            <Sparkles size={14} />
                            Generate
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Bulk actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const allText = platforms.map((plat) => {
                          const cap = captions.find((c) => c.platform === plat && c.status === "approved") || captions.find((c) => c.platform === plat);
                          return cap ? `--- ${PLATFORM_LABELS[plat]} ---\n${cap.caption}` : null;
                        }).filter(Boolean).join("\n\n");
                        navigator.clipboard.writeText(allText);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
                    >
                      <Copy size={14} />
                      Copy All
                    </button>
                    <button
                      onClick={() => {
                        if (selectedVideo) {
                          fetch("/api/captions/bulk-status", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ videoCode: selectedVideo, status: "posted" }),
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                      <Check size={14} />
                      Mark All Posted
                    </button>
                  </div>
                </div>
              )}

              {/* Platform sections (Edit tab) */}
              {workspaceTab === "edit" && captionsByPlatform.map(({ platform, captions: platCaptions }) => {
                const isPreview = previewPlatforms.has(platform);
                return (
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePreview(platform)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          isPreview ? "bg-teal-50 text-teal-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
                        )}
                        title={isPreview ? "Show raw text" : "Show preview"}
                      >
                        {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          if (selectedVideo) generateMutation.mutate({ videoCode: selectedVideo, platforms: [platform] });
                        }}
                        disabled={generateMutation.isPending}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                        title={`Regenerate ${PLATFORM_LABELS[platform]}`}
                      >
                        <RefreshCw size={14} className={generateMutation.isPending ? "animate-spin" : ""} />
                      </button>
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
                              <ScoreBadge score={scoreCaption(cap.caption, platform)} />
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
                              <div className="mb-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                                  Hook Line
                                </label>
                                <input
                                  value={editHook}
                                  onChange={(e) => setEditHook(e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="First line your audience sees..."
                                />
                                <CharCount text={editHook} platform={platform} />
                              </div>
                              <div className="mb-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                                  Body
                                </label>
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  rows={4}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const combined = editBody.trim()
                                        ? `${editHook}\n\n${editBody}`
                                        : editHook;
                                      editMutation.mutate({ id: cap.id, caption: combined });
                                    }}
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
                                <CharCount
                                  text={editBody.trim() ? `${editHook}\n\n${editBody}` : editHook}
                                  platform={platform}
                                />
                              </div>
                            </div>
                          ) : isPreview ? (
                            <PlatformPreview caption={cap.caption} platform={platform} />
                          ) : (
                            <>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{cap.caption}</p>
                              <CharCount text={cap.caption} platform={platform} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
