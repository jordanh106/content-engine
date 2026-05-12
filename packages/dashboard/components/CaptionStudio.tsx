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
  ArrowRight,
  CalendarPlus,
  Wand2,
  Bookmark,
  Zap,
  FileText,
  BarChart3,
} from "lucide-react";
import type { ConversationMessage, CreatorPersona } from "../shared/types.js";
import type { SavedCaption, FormatId, ProductionStatus, DashboardView } from "../shared/types.js";
import { FORMATS } from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { useCreator } from "./context/CreatorContext.js";
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
  E: "bg-teal-100 text-teal-700",
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
  tiktok: "bg-surface-hover text-themed-secondary border-themed",
  youtube_shorts: "bg-red-50 text-red-700 border-red-200",
  youtube_long: "bg-red-50 text-red-700 border-red-200",
};

// Quality score badge with hover breakdown
const ScoreBadge: React.FC<{ score: ScoreBreakdown }> = ({ score }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const color = score.total >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : score.total >= 50 ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  const context = score.total >= 80 ? "Strong" : score.total >= 65 ? "Above avg" : score.total >= 50 ? "Average" : "Needs work";

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
        {score.total} · {context}
      </button>
      {showBreakdown && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-surface-elevated border border-themed rounded-xl p-3 shadow-xl min-w-[180px]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Score Breakdown</p>
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-themed-secondary">{cat.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      cat.value / cat.max >= 0.7 ? "bg-emerald-500" : cat.value / cat.max >= 0.4 ? "bg-amber-500" : "bg-red-400",
                    )}
                    style={{ width: `${(cat.value / cat.max) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-themed-tertiary tabular-nums w-8 text-right">
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
  draft: "bg-surface-hover text-themed-secondary",
  approved: "bg-emerald-100 text-emerald-700",
  posted: "bg-teal-100 text-teal-700",
};

// Character count display
const CharCount: React.FC<{ text: string; platform: string }> = ({ text, platform }) => {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return null;
  const len = text.length;
  const ratio = len / limits.max;
  const color = ratio > 1 ? "text-red-500" : ratio > 0.9 ? "text-amber-500" : "text-themed-muted";
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
          hookLen > limits.hookVisible ? "text-amber-500" : "text-themed-muted",
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
          <div className="w-8 h-8 rounded-full bg-rose-500" />
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
    <div className="bg-surface-elevated border border-themed rounded-xl p-4 max-w-[280px]">
      <p className="text-sm font-bold text-themed line-clamp-2">
        {title.length > titleLimit ? title.slice(0, titleLimit) + "..." : title}
      </p>
      {body && (
        <p className="text-xs text-themed-tertiary mt-1 line-clamp-3">{body}</p>
      )}
      <div className="flex items-center gap-3 mt-3 text-themed-muted">
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
  audienceLabel?: string;
};

type CaptionsResponse = {
  captions: SavedCaption[];
};

type CaptionStudioProps = {
  onNavigate?: (view: DashboardView) => void;
};

const CAPTION_AVATAR_COLOR_MAP: Record<string, string> = {
  teal: "bg-teal-600",
  violet: "bg-violet-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

export const CaptionStudio: React.FC<CaptionStudioProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const { selectedCreatorId } = useCreator();

  const { data: personaData } = useQuery<{ personas: CreatorPersona[] }>({
    queryKey: ["personas"],
    queryFn: () => fetch("/api/personas").then((r) => r.json()),
    staleTime: 60_000,
  });
  const activePersona = personaData?.personas?.find((p) => p.id === selectedCreatorId) ?? null;
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
    ctaSuggestion?: string;
    hashtagSuggestions?: string[];
    waterfallIdeas?: string[];
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [schedulePlatform, setSchedulePlatform] = useState("instagram_reels");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // Freeform caption mode state
  const [freeformDesc, setFreeformDesc] = useState("");
  const [freeformMood, setFreeformMood] = useState("");
  const [freeformTags, setFreeformTags] = useState("");
  const [freeformPlatforms, setFreeformPlatforms] = useState<Set<string>>(
    new Set(["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"]),
  );
  const [freeformVisualHook, setFreeformVisualHook] = useState("");
  const [freeformTextOverlay, setFreeformTextOverlay] = useState("");
  const [freeformAudioContext, setFreeformAudioContext] = useState("");
  const [showAlignmentFields, setShowAlignmentFields] = useState(false);
  const [freeformResult, setFreeformResult] = useState<{
    captions: Array<{ platform: string; caption: string }>;
    videoCode: string;
  } | null>(null);
  const [freeformContext, setFreeformContext] = useState<{
    description: string;
    mood?: string;
    tags?: string[];
    platforms?: string[];
  } | null>(null);

  const freeformMutation = useMutation({
    mutationFn: async (params: { description: string; mood?: string; platforms?: string[]; tags?: string[] }) => {
      const r = await fetch("/api/captions/generate-freeform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, creatorId: selectedCreatorId ?? undefined }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      setFreeformResult(data);
      if (data.videoCode) {
        setSelectedVideo(data.videoCode);
      }
      queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
      queryClient.invalidateQueries({ queryKey: ["captions"] });
    },
  });

  // Hook Lab state
  type HookVariant = { text: string; type: string; score: number; breakdown?: { contextLean: string; patternInterrupt: string; snapback: string } };
  const [hookLabOpen, setHookLabOpen] = useState(false);
  const [hookVariants, setHookVariants] = useState<HookVariant[]>([]);
  const hookMutation = useMutation({
    mutationFn: async (params: { title?: string; description?: string; audience?: string; format?: string }) => {
      const r = await fetch("/api/captions/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, creatorId: selectedCreatorId ?? undefined }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      setHookVariants(data.hooks || []);
      setHookLabOpen(true);
    },
  });

  // Templates state
  const { data: templatesData } = useQuery<{ templates: Array<{ id: number; name: string; platform: string; template: string; format: string; usageCount: number }> }>({
    queryKey: ["caption-templates"],
    queryFn: () => fetch("/api/captions/templates").then((r) => r.json()),
  });
  const [showTemplates, setShowTemplates] = useState(false);

  // Hashtag groups state
  const { data: hashtagGroupsData } = useQuery<{ groups: Array<{ id: number; name: string; hashtags: string; category: string }> }>({
    queryKey: ["hashtag-groups"],
    queryFn: () => fetch("/api/captions/hashtag-groups").then((r) => r.json()),
  });
  const [showHashtagGroups, setShowHashtagGroups] = useState(false);

  const scheduleMutation = useMutation({
    mutationFn: (params: { videoCode: string; date: string; platform: string }) =>
      fetch("/api/calendar/schedule-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }).then((r) => r.json()),
    onSuccess: () => {
      setScheduleSuccess(true);
      setScheduleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setTimeout(() => setScheduleSuccess(false), 3000);
    },
  });

  // Fetch all videos from content library (not gated by pipeline status)
  const { data: allVideosData } = useQuery<VideoSummary[]>({
    queryKey: ["videos"],
    queryFn: () => fetch("/api/videos").then((r) => r.json()),
  });

  const captionableVideos: VideoSummary[] = React.useMemo(() => {
    if (!allVideosData) return [];
    return allVideosData.map((v) => ({
      code: v.code,
      title: v.title,
      format: v.format,
      status: v.status || ("SCRIPTED" as ProductionStatus),
      scriptPreview: v.scriptPreview || "",
      audienceLabel: v.audienceLabel,
    }));
  }, [allVideosData]);

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
  });

  // Generate mutation (supports optional platforms filter)
  const generateMutation = useMutation({
    mutationFn: async ({ videoCode, platforms: plats }: { videoCode: string; platforms?: string[] }) => {
      const r = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode, platforms: plats, creatorId: selectedCreatorId ?? undefined }),
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

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const handleCopyAsPrompt = (videoCode: string, platform: string, description?: string) => {
    const lines = [
      `Write a short-form video caption for the following:`,
      ``,
      videoCode ? `Video: ${videoCode}` : null,
      platform ? `Platform: ${platform}` : null,
      description ? `Description: ${description}` : null,
      ``,
      `Requirements:`,
      `- Hook in the first line (must stop the scroll)`,
      `- Platform-native tone and length`,
      `- Include a clear CTA`,
      `- Structure: Hook → Context → Rehook → CTA`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
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
      const isFreeform = selectedVideo.startsWith("CUSTOM-");
      const url = isFreeform ? "/api/captions/generate-freeform" : "/api/captions/generate";
      const body = isFreeform
        ? {
            videoCode: selectedVideo,
            description: freeformContext?.description || prompt,
            mood: freeformContext?.mood,
            platforms: freeformContext?.platforms,
            tags: freeformContext?.tags,
            conversationHistory: newHistory,
            creatorId: selectedCreatorId ?? undefined,
          }
        : {
            videoCode: selectedVideo,
            prompt,
            conversationHistory: newHistory,
            creatorId: selectedCreatorId ?? undefined,
          };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const isFreeform = selectedVideo.startsWith("CUSTOM-");
      const r = await fetch("/api/captions/suggest-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoCode: selectedVideo,
          platform: "instagram_reels",
          ...(isFreeform && freeformContext ? { caption: freeformContext.description } : {}),
        }),
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
      setAnalysisStep("Analyzing video... (this may take up to a minute)");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000);
      const r = await fetch("/api/video-analysis/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await r.json();
      if (r.ok) {
        setVideoAnalysis(data.analysis);
        setAnalysisStep("");
      } else {
        console.error("[video-analysis] API error:", data.error);
        setAnalysisStep(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error("[video-analysis] Upload failed:", err);
      const msg = err instanceof DOMException && err.name === "AbortError"
        ? "Analysis timed out. Try a shorter video."
        : "Upload failed. Try again.";
      setAnalysisStep(msg);
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
        body: JSON.stringify({ videoCodes: codes, creatorId: selectedCreatorId ?? undefined }),
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

  const CHAT_CHIP_GROUPS = [
    { label: "Hook", chips: ["Stronger opening hook", "Open loop / curiosity gap", "Question hook", "Pattern interrupt", "Add a contrarian snapback", "Try a different archetype"] },
    { label: "Value", chips: ["More educational", "Make it more casual", "Add a personal touch", "Shorter"] },
    { label: "CTA", chips: ["Save-worthy CTA", "Comment-driving CTA", "Follow CTA"] },
    { label: "Platform", chips: ["Optimize for TikTok", "More SEO for YouTube", "Remove hashtags", "Add a mid-caption rehook"] },
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
            <h1 className="text-2xl font-serif font-bold text-themed">Caption Studio</h1>
            <ViewHelp {...VIEW_HELP.CAPTIONS} />
          </div>
          <p className="text-sm text-themed-tertiary mt-1">
            Generate and manage social media captions for your videos
          </p>
        </div>
        {activePersona && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-themed-muted">Generating as</span>
            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0", CAPTION_AVATAR_COLOR_MAP[activePersona.avatarColor ?? "teal"] ?? "bg-teal-600")}>
              {activePersona.initials ?? activePersona.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-themed-secondary">{activePersona.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video Selector */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-surface-elevated border border-themed rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-3">
              Content Library
            </p>

            {/* Status filter */}
            <div className="flex flex-wrap gap-1 mb-3">
              {["all", "SCRIPTED", "RECORDING", "GENERATING", "ASSEMBLED", "SCHEDULED", "PUBLISHED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                    statusFilter === s
                      ? "bg-teal-600 text-white"
                      : "bg-surface-hover text-themed-tertiary hover:bg-surface-hover",
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
                  icon={<MessageSquareText size={24} className="text-themed-muted" />}
                  headline="No videos found"
                  description="Add videos to your content library to generate captions."
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
                        className="mt-3.5 w-4 h-4 rounded border-themed text-teal-600 focus:ring-teal-500 shrink-0"
                      />
                      <button
                        onClick={() => setSelectedVideo(v.code)}
                        className={cn(
                          "flex-1 text-left p-3 rounded-xl border transition-colors",
                          selectedVideo === v.code
                            ? "border-teal-300 bg-teal-50"
                            : "border-themed hover:border-themed bg-surface-elevated",
                        )}
                      >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-themed-tertiary">{v.code}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", FORMAT_COLORS[v.format] || "bg-surface-hover")}>
                          {v.format}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-themed line-clamp-1">{v.title}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-themed-muted">
                          {v.status}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          count >= 4 ? "bg-emerald-100 text-emerald-700" :
                          count > 0 ? "bg-amber-100 text-amber-700" :
                          "bg-surface-hover text-themed-tertiary",
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
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
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
                    <span className="font-mono text-themed-tertiary">{r.videoCode}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      r.status === "success" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "error" ? "bg-red-100 text-red-700" :
                      "bg-surface-hover text-themed-tertiary",
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
            <div className="space-y-4">
              {/* Describe Your Video - freeform caption generation */}
              <div className="bg-surface-elevated border border-themed rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wand2 size={18} className="text-teal-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
                    Describe Your Video
                  </p>
                </div>
                <p className="text-sm text-themed-tertiary mb-4">
                  Generate captions for any video, even outside your content library. Describe what's in it, the hook, and any trending sound or format.
                </p>
                <textarea
                  value={freeformDesc}
                  onChange={(e) => setFreeformDesc(e.target.value)}
                  placeholder="Example: I filmed a reaction to a viral chiropractic compilation with the 'oh no' sound. Text overlay says 'When patients say they crack their own neck' and I slowly turn to look at the camera."
                  className="w-full p-3 border border-themed rounded-xl text-sm text-themed-secondary placeholder:text-themed-muted resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={4}
                />

                {/* Mood chips */}
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mb-2">Mood / Tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Educational", "Humorous", "Inspirational", "Casual", "Trending", "Professional"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFreeformMood(freeformMood === m ? "" : m)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors",
                          freeformMood === m
                            ? "bg-teal-600 text-white"
                            : "bg-surface-hover text-themed-tertiary hover:bg-surface-hover",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform selection */}
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mb-2">Platforms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          const next = new Set(freeformPlatforms);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          setFreeformPlatforms(next);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors",
                          freeformPlatforms.has(key)
                            ? "bg-teal-600 text-white"
                            : "bg-surface-hover text-themed-tertiary hover:bg-surface-hover",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-3">
                  <input
                    value={freeformTags}
                    onChange={(e) => setFreeformTags(e.target.value)}
                    placeholder="Tags (comma-separated): chiropractic, humor, trending"
                    className="w-full p-2.5 border border-themed rounded-xl text-sm text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Hook Alignment (Kallaway 4-Component) */}
                <div className="mt-3">
                  <button
                    onClick={() => setShowAlignmentFields(!showAlignmentFields)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    <Zap size={12} />
                    Hook Alignment (Advanced)
                    <ChevronDown size={12} className={cn("transition-transform", showAlignmentFields && "rotate-180")} />
                  </button>
                  {showAlignmentFields && (
                    <div className="mt-2 space-y-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                      <p className="text-[10px] text-teal-600 mb-1">Align your 4 hook components for maximum impact. Visual is most important.</p>
                      <input
                        value={freeformVisualHook}
                        onChange={(e) => setFreeformVisualHook(e.target.value)}
                        placeholder="Visual hook: What's the first thing viewers SEE?"
                        className="w-full p-2 border border-teal-200 rounded-lg text-xs text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-surface-elevated"
                      />
                      <input
                        value={freeformTextOverlay}
                        onChange={(e) => setFreeformTextOverlay(e.target.value)}
                        placeholder="Text overlay: What text appears on screen?"
                        className="w-full p-2 border border-teal-200 rounded-lg text-xs text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-surface-elevated"
                      />
                      <input
                        value={freeformAudioContext}
                        onChange={(e) => setFreeformAudioContext(e.target.value)}
                        placeholder="Audio: Trending sound, original voiceover, ASMR..."
                        className="w-full p-2 border border-teal-200 rounded-lg text-xs text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-surface-elevated"
                      />
                    </div>
                  )}
                </div>

                {/* Generate button */}
                <button
                  onClick={() => {
                    if (!freeformDesc.trim()) return;
                    const tags = freeformTags ? freeformTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
                    const params: Record<string, unknown> = {
                      description: freeformDesc,
                      mood: freeformMood || undefined,
                      platforms: [...freeformPlatforms],
                      tags,
                    };
                    if (freeformVisualHook) params.visualHook = freeformVisualHook;
                    if (freeformTextOverlay) params.textOverlay = freeformTextOverlay;
                    if (freeformAudioContext) params.audioContext = freeformAudioContext;
                    setFreeformContext({ description: freeformDesc, mood: freeformMood || undefined, tags, platforms: [...freeformPlatforms] });
                    freeformMutation.mutate(params as { description: string; mood?: string; platforms?: string[]; tags?: string[] });
                  }}
                  disabled={freeformMutation.isPending || !freeformDesc.trim()}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {freeformMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {freeformMutation.isPending ? "Generating..." : "Generate Captions"}
                </button>
                {freeformMutation.isError && (
                  <p className="text-xs text-red-500 mt-2">{(freeformMutation.error as Error)?.message}</p>
                )}
                {freeformDesc.trim() && (
                  <button
                    onClick={() => handleCopyAsPrompt("", [...freeformPlatforms].join(", "), freeformDesc)}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-themed text-themed-tertiary text-[10px] font-bold hover:border-slate-400 hover:text-themed-secondary transition-colors"
                    title="Copy a structured prompt to use in Claude or ChatGPT"
                  >
                    {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPrompt ? "Copied!" : "Copy as Prompt"}
                  </button>
                )}
              </div>

              {/* Or select from library / analyze video */}
              <div className="bg-surface-elevated border border-themed rounded-2xl p-6 text-center">
                <p className="text-sm text-themed-muted mb-3">
                  Or select a video from the Content Library on the left
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  disabled={analysisLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold hover:bg-teal-100 transition-colors disabled:opacity-50"
                >
                  {analysisLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {analysisLoading ? analysisStep : "Analyze Video File"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video context */}
              <div className="bg-surface-elevated border border-themed rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-themed-tertiary">{selectedVideo}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", FORMAT_COLORS[videoDetail?.format] || "bg-surface-hover")}>
                      {videoDetail?.format ? `${videoDetail.format} - ${FORMATS[videoDetail.format as FormatId]?.name || ""}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => {
                        if (videoDetail) hookMutation.mutate({
                          title: videoDetail.title,
                          audience: videoDetail.audienceLabel,
                          format: videoDetail.format,
                        });
                      }}
                      disabled={hookMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-50 transition-colors disabled:opacity-50"
                    >
                      {hookMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      Hook Lab
                    </button>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-themed text-themed-secondary text-xs font-semibold hover:bg-surface-hover transition-colors"
                    >
                      <FileText size={12} />
                      Templates
                    </button>
                    <button
                      onClick={() => setShowUpload(true)}
                      disabled={analysisLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-themed text-themed-secondary text-xs font-semibold hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      {analysisLoading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      {analysisLoading ? analysisStep : "Analyze"}
                    </button>
                    <button
                      onClick={() => {
                        if (selectedVideo) generateMutation.mutate({ videoCode: selectedVideo });
                      }}
                      disabled={generateMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
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
                <p className="text-sm font-medium text-themed mt-2">{videoDetail?.title || ""}</p>

                {/* Collapsible script */}
                {videoDetail?.script && (
                  <div className="mt-3">
                    <button
                      onClick={() => setScriptExpanded(!scriptExpanded)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted hover:text-themed-secondary"
                    >
                      {scriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Video Script
                    </button>
                    {scriptExpanded && (
                      <div className="mt-2 p-3 bg-surface-hover rounded-xl text-sm text-themed-secondary whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {videoDetail.script}
                      </div>
                    )}
                  </div>
                )}

                {/* Script-first generation badge */}
                {videoDetail && !selectedVideo?.startsWith("CUSTOM-") && (
                  <div className="mt-2">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                      ["SCRIPTED", "RECORDING", "GENERATING"].includes(videoDetail.status || "")
                        ? "bg-teal-50 text-teal-700"
                        : "bg-emerald-50 text-emerald-600",
                    )}>
                      <Sparkles size={10} />
                      {["SCRIPTED", "RECORDING", "GENERATING"].includes(videoDetail.status || "")
                        ? "Generates from script"
                        : "Generates from script + production data"}
                    </span>
                  </div>
                )}

                {generateMutation.isError && (
                  <p className="text-sm text-red-600 mt-2">{generateMutation.error.message}</p>
                )}
              </div>

              {/* Hook Lab Error */}
              {hookMutation.isError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600">
                  <span>Hook Lab failed: {(hookMutation.error as Error).message || "Try again."}</span>
                </div>
              )}

              {/* Hook Lab Panel */}
              {hookLabOpen && hookVariants.length > 0 && (
                <div className="bg-surface-elevated border border-teal-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-teal-600" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Hook Lab</p>
                    </div>
                    <button onClick={() => setHookLabOpen(false)} className="text-themed-muted hover:text-themed-secondary">
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-themed-tertiary mb-3">6 Kallaway archetypes. Click to copy. Each uses a different hook psychology.</p>
                  <div className="space-y-2">
                    {hookVariants.map((hook, i) => (
                      <button
                        key={i}
                        onClick={() => { navigator.clipboard.writeText(hook.text); }}
                        className="w-full text-left p-3 rounded-xl border border-themed-subtle hover:border-teal-200 hover:bg-teal-50/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-themed-secondary font-medium">{hook.text}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                              hook.score >= 25 ? "bg-emerald-100 text-emerald-700" :
                              hook.score >= 18 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700",
                            )}>
                              {hook.score}/33
                            </span>
                            <Copy size={12} className="text-themed-muted group-hover:text-teal-600 transition-colors" />
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mt-1 inline-block">{hook.type}</span>
                        {hook.breakdown && (
                          <div className="mt-2 pt-2 border-t border-slate-50 space-y-0.5">
                            <p className="text-[10px] text-themed-muted"><span className="font-bold text-teal-600">Context:</span> {hook.breakdown.contextLean}</p>
                            <p className="text-[10px] text-themed-muted"><span className="font-bold text-amber-600">Interrupt:</span> {hook.breakdown.patternInterrupt}</p>
                            <p className="text-[10px] text-themed-muted"><span className="font-bold text-rose-600">Snapback:</span> {hook.breakdown.snapback}</p>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Templates Dropdown */}
              {showTemplates && (
                <div className="bg-surface-elevated border border-themed rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-themed-tertiary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Saved Templates</p>
                    </div>
                    <button onClick={() => setShowTemplates(false)} className="text-themed-muted hover:text-themed-secondary">
                      <X size={14} />
                    </button>
                  </div>
                  {!templatesData?.templates?.length ? (
                    <p className="text-xs text-themed-muted">No templates saved yet. Save a caption as a template using the bookmark icon on any caption card.</p>
                  ) : (
                    <div className="space-y-2">
                      {templatesData.templates.map((t) => (
                        <div key={t.id} className="p-3 rounded-xl border border-themed-subtle hover:border-themed transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-themed-secondary">{t.name}</span>
                            <div className="flex items-center gap-1.5">
                              {t.platform && (
                                <span className="text-[10px] font-bold text-themed-muted">{PLATFORM_LABELS[t.platform] || t.platform}</span>
                              )}
                              <span className="text-[10px] text-themed-muted">Used {t.usageCount}x</span>
                            </div>
                          </div>
                          <p className="text-xs text-themed-tertiary line-clamp-2">{t.template}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AI Chat Refinement */}
              <div className="bg-surface-elevated border border-themed rounded-2xl p-4">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-2 w-full"
                >
                  <Sparkles size={14} className="text-teal-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
                    AI Refinement
                  </span>
                  {chatOpen ? <ChevronUp size={12} className="text-themed-muted ml-auto" /> : <ChevronDown size={12} className="text-themed-muted ml-auto" />}
                </button>

                {chatOpen && (
                  <div className="mt-3 space-y-3">
                    {/* Suggestion chips grouped by Hook-Value-CTA structure */}
                    <div className="space-y-2">
                      {CHAT_CHIP_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-themed-muted mb-1">{group.label}</p>
                          <div className="flex flex-wrap gap-1">
                            {group.chips.map((chip) => (
                              <button
                                key={chip}
                                onClick={() => handleChatSubmit(chip)}
                                disabled={chatLoading}
                                className="px-2 py-0.5 rounded-full border border-themed text-[10px] font-bold text-themed-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleSuggestHashtags}
                          disabled={chatLoading}
                          className="px-2.5 py-1 rounded-full border border-teal-200 text-[10px] font-bold text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          <Hash size={10} />
                          Suggest Hashtags
                        </button>
                        <button
                          onClick={() => setShowHashtagGroups(!showHashtagGroups)}
                          className="px-2.5 py-1 rounded-full border border-themed text-[10px] font-bold text-themed-tertiary hover:bg-surface-hover transition-colors flex items-center gap-1"
                        >
                          <Bookmark size={10} />
                          Saved Groups
                        </button>
                      </div>
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
                              className="px-2 py-0.5 rounded-full bg-surface-elevated border border-teal-200 text-xs text-teal-700 hover:bg-teal-100 transition-colors"
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

                    {/* Saved Hashtag Groups */}
                    {showHashtagGroups && (
                      <div className="p-3 bg-surface-hover rounded-xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Saved Hashtag Groups</p>
                        {!hashtagGroupsData?.groups?.length ? (
                          <p className="text-xs text-themed-muted">No groups saved yet. Suggest hashtags first, then save them as a group.</p>
                        ) : (
                          <div className="space-y-2">
                            {hashtagGroupsData.groups.map((g) => {
                              const tags: string[] = (() => { try { return JSON.parse(g.hashtags); } catch { return []; } })();
                              return (
                                <div key={g.id} className="p-2 bg-surface-elevated rounded-lg border border-themed-subtle">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-themed-secondary">{g.name}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(tags.join(" "))}
                                      className="text-[10px] font-bold text-teal-600 hover:underline"
                                    >
                                      Copy all
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {tags.slice(0, 8).map((tag) => (
                                      <span key={tag} className="text-[10px] text-themed-tertiary">{tag}</span>
                                    ))}
                                    {tags.length > 8 && <span className="text-[10px] text-themed-muted">+{tags.length - 8}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat history */}
                    {chatHistory.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {chatHistory.map((msg, i) => (
                          <div key={i} className={cn("text-xs rounded-xl p-2.5", msg.role === "user" ? "bg-surface-hover text-themed-secondary ml-8" : "bg-teal-50 text-teal-800 mr-8")}>
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
                        className="flex-1 px-3 py-2 border border-themed rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              <div className="flex gap-1 bg-surface-hover rounded-full p-1 w-fit">
                {(["edit", "publish"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setWorkspaceTab(tab)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
                      workspaceTab === tab ? "bg-surface-elevated text-themed shadow-sm" : "text-themed-tertiary hover:text-themed-secondary",
                    )}
                  >
                    {tab === "edit" ? "Edit" : "Publish Kit"}
                  </button>
                ))}
              </div>

              {/* Publish Kit view */}
              {workspaceTab === "publish" && (
                <div className="space-y-3">
                  {/* Coverage progress bar */}
                  {(() => {
                    const covered = platforms.filter((p) => captions.some((c) => c.platform === p)).length;
                    const approved = platforms.filter((p) => captions.some((c) => c.platform === p && (c.status === "approved" || c.status === "posted"))).length;
                    return (
                      <div className="bg-surface-elevated border border-themed rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Platform Coverage</p>
                          <span className="text-sm font-bold text-themed-secondary">{covered}/4 platforms</span>
                        </div>
                        <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", approved === 4 ? "bg-emerald-500" : "bg-teal-500")}
                            style={{ width: `${(covered / 4) * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {platforms.map((p) => {
                            const has = captions.some((c) => c.platform === p);
                            const isApproved = captions.some((c) => c.platform === p && (c.status === "approved" || c.status === "posted"));
                            return (
                              <span key={p} className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                isApproved ? "bg-emerald-100 text-emerald-700" :
                                has ? "bg-amber-100 text-amber-700" :
                                "bg-red-50 text-red-400",
                              )}>
                                {PLATFORM_LABELS[p]}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {platforms.map((plat) => {
                    const platCaps = captions.filter((c) => c.platform === plat);
                    const approved = platCaps.find((c) => c.status === "approved") || platCaps[0];
                    return (
                      <div key={plat} className="bg-surface-elevated border border-themed rounded-2xl p-4">
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
                            <p className="text-sm text-themed-secondary whitespace-pre-wrap mb-3 line-clamp-4">{approved.caption}</p>
                            <button
                              onClick={() => handleCopy(approved.id, approved.caption)}
                              className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
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
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-themed text-themed-secondary text-xs font-semibold hover:bg-surface-hover transition-colors"
                          >
                            <Sparkles size={14} />
                            Generate
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Schedule CTA */}
                  {onNavigate && captions.some((c) => c.status === "approved") && (
                    <button
                      onClick={() => onNavigate("CALENDAR")}
                      className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left mb-2"
                    >
                      <div>
                        <span className="text-sm font-semibold text-teal-800">Schedule this video</span>
                        <span className="block text-xs text-teal-600 mt-0.5">Add to your content calendar to plan your publish date</span>
                      </div>
                      <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
                    </button>
                  )}

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
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
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
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-themed text-themed-secondary text-xs font-semibold hover:bg-surface-hover transition-colors"
                    >
                      <Check size={14} />
                      Mark All Posted
                    </button>
                    <button
                      onClick={() => {
                        if (selectedVideo) {
                          fetch("/api/captions/bulk-status", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ videoCode: selectedVideo, status: "approved" }),
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-200 text-emerald-600 text-xs font-semibold hover:bg-emerald-50 transition-colors"
                    >
                      <Check size={14} />
                      Approve All Drafts
                    </button>
                  </div>
                </div>
              )}

              {/* Platform sections (Edit tab) */}
              {workspaceTab === "edit" && captionsByPlatform.map(({ platform, captions: platCaptions }) => {
                const isPreview = previewPlatforms.has(platform);
                return (
                <div key={platform} className="bg-surface-elevated border border-themed rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", PLATFORM_COLORS[platform])}>
                        {PLATFORM_LABELS[platform] || platform}
                      </span>
                      <span className="text-[10px] text-themed-muted">
                        {platCaptions.length} variant{platCaptions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePreview(platform)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          isPreview ? "bg-teal-50 text-teal-600" : "text-themed-muted hover:bg-surface-hover hover:text-themed-secondary",
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
                        className="p-1.5 rounded-lg text-themed-muted hover:bg-surface-hover hover:text-themed-secondary disabled:opacity-50"
                        title={`Regenerate ${PLATFORM_LABELS[platform]}`}
                      >
                        <RefreshCw size={14} className={generateMutation.isPending ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {platCaptions.length === 0 ? (
                    <p className="text-sm text-themed-muted py-2">No captions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {platCaptions.map((cap) => (
                        <div key={cap.id} className="border border-themed-subtle rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-themed-muted">v{cap.variant}</span>
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
                                className="p-1.5 rounded-lg hover:bg-surface-hover text-themed-muted hover:text-themed-secondary"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleCopy(cap.id, cap.caption)}
                                className="p-1.5 rounded-lg hover:bg-surface-hover text-themed-muted hover:text-teal-600"
                                title="Copy"
                              >
                                {copiedId === cap.id ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(cap.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-themed-muted hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {editingId === cap.id ? (
                            <div>
                              <div className="mb-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1 block">
                                  Hook Line
                                </label>
                                <input
                                  value={editHook}
                                  onChange={(e) => setEditHook(e.target.value)}
                                  className="w-full p-2 border border-themed rounded-lg text-sm text-themed-secondary bg-amber-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  placeholder="First line your audience sees..."
                                />
                                <CharCount text={editHook} platform={platform} />
                              </div>
                              <div className="mb-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1 block">
                                  Body
                                </label>
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  className="w-full p-2 border border-themed rounded-lg text-sm text-themed-secondary resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                    className="px-3 py-1 rounded-full bg-surface-hover text-themed-secondary text-[10px] font-bold uppercase tracking-wider"
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
                              <p className="text-sm text-themed-secondary whitespace-pre-wrap">{cap.caption}</p>
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

          {/* Upload overlay - renders regardless of video selection */}
          {showUpload && (
            <div
              className="mt-4 bg-surface-elevated border-2 border-dashed border-teal-300 rounded-2xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
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
              <p className="text-sm font-medium text-themed-secondary mb-1">
                Drop a video file here or click to browse
              </p>
              <p className="text-xs text-themed-muted">
                MP4, MOV, or WebM (max 200MB). AI will analyze visuals and audio.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowUpload(false); }}
                className="mt-3 text-[10px] font-bold text-themed-muted hover:text-themed-secondary uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Video Analysis Results - renders regardless of video selection */}
          {videoAnalysis && (
            <div className="mt-4 bg-surface-elevated border border-themed rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
                  Video Analysis
                </p>
                <button
                  onClick={() => setVideoAnalysis(null)}
                  className="p-1 rounded-lg hover:bg-surface-hover text-themed-muted"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Visual description & mood */}
              <p className="text-sm text-themed-secondary mb-2">{videoAnalysis.visualDescription || ""}</p>
              {videoAnalysis.mood ? (
                <span className="inline-block px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold mb-3">
                  {videoAnalysis.mood}
                </span>
              ) : null}

              {/* Hook suggestions */}
              {videoAnalysis.hookSuggestions && videoAnalysis.hookSuggestions.length > 0 ? (
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1.5">Hook Ideas</p>
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1.5">Hashtags</p>
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

              {/* Caption suggestions per platform */}
              {videoAnalysis.captionSuggestions && Object.keys(videoAnalysis.captionSuggestions).length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Caption Suggestions</div>
                  <div className="space-y-2">
                    {Object.entries(videoAnalysis.captionSuggestions).map(([plat, caption]) => (
                      <div key={plat} className={`rounded-xl border p-3 ${PLATFORM_COLORS[plat] || "bg-surface-hover text-themed-secondary border-themed"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.15em]">{PLATFORM_LABELS[plat] || plat}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(caption); }}
                            className="text-[9px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed">{caption}</p>
                      </div>
                    ))}
                  </div>
                  {selectedVideo ? (
                    <button
                      onClick={() => {
                        const suggestions = videoAnalysis.captionSuggestions!;
                        for (const [plat, cap] of Object.entries(suggestions)) {
                          if (cap && selectedVideo) {
                            fetch("/api/captions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ videoCode: selectedVideo, platform: plat, caption: cap, status: "draft" }),
                            });
                          }
                        }
                        queryClient.invalidateQueries({ queryKey: ["captions", selectedVideo] });
                        queryClient.invalidateQueries({ queryKey: ["caption-counts"] });
                      }}
                      className="mt-3 px-4 py-2 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
                    >
                      Save as Drafts
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* CTA Suggestion */}
              {videoAnalysis.ctaSuggestion ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Coupled CTA</div>
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 flex items-start justify-between gap-2">
                    <p className="text-xs text-teal-800 leading-relaxed">{videoAnalysis.ctaSuggestion}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(videoAnalysis.ctaSuggestion!); }}
                      className="text-[9px] font-bold uppercase tracking-wider text-teal-600 opacity-60 hover:opacity-100 transition-opacity shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Waterfall Ideas */}
              {videoAnalysis.waterfallIdeas && videoAnalysis.waterfallIdeas.length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Content Waterfall</div>
                  <div className="space-y-1.5">
                    {videoAnalysis.waterfallIdeas.map((idea, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-themed-secondary">
                        <span className="text-themed-muted font-bold shrink-0">{i + 1}.</span>
                        <span>{idea}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Transcript */}
              {videoAnalysis.transcript ? (
                <div className="mt-3">
                  <button
                    onClick={() => setScriptExpanded(!scriptExpanded)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted hover:text-themed-secondary"
                  >
                    {scriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    Transcript
                  </button>
                  {scriptExpanded && (
                    <p className="mt-1 text-xs text-themed-secondary bg-surface-hover rounded-xl p-3">
                      {videoAnalysis.transcript}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Key moments */}
              {videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1.5">Key Moments</p>
                  <div className="space-y-1">
                    {videoAnalysis.keyMoments.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-themed-muted w-10">{m.timestamp}</span>
                        <span className="text-themed-secondary">{m.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {selectedVideo && (
        <div className="mt-6 space-y-3">
          {scheduleSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <Check size={16} />
              Video scheduled successfully!
            </div>
          )}

          {scheduleOpen ? (
            <div className="bg-surface-elevated border border-teal-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-themed">Schedule Video</h4>
                <button onClick={() => setScheduleOpen(false)} className="p-1 text-themed-muted hover:text-themed-secondary">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-themed-muted block mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-themed-muted block mb-1">Platform</label>
                  <select
                    value={schedulePlatform}
                    onChange={(e) => setSchedulePlatform(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-surface-elevated"
                  >
                    {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => scheduleMutation.mutate({ videoCode: selectedVideo, date: scheduleDate, platform: schedulePlatform })}
                disabled={scheduleMutation.isPending}
                className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scheduleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
                {scheduleMutation.isPending ? "Scheduling..." : "Schedule & Update Status"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setScheduleOpen(true)}
              className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
            >
              <div>
                <span className="text-sm font-semibold text-teal-800">Schedule This Video</span>
                <span className="block text-xs text-teal-600 mt-0.5">Pick a date and platform to add to your calendar</span>
              </div>
              <CalendarPlus size={16} className="text-teal-600 shrink-0 ml-3" />
            </button>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate("CALENDAR")}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-semibold text-themed-tertiary hover:text-teal-600 transition-colors"
            >
              View full calendar <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
