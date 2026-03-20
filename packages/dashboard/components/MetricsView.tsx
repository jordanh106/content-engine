import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  Eye,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  Plus,
  X,
  RefreshCw,
  Sparkles,
  Loader2,
  Trophy,
  Lightbulb,
  ArrowUpRight,
  Check,
  Target,
  Zap,
  Flame,
  MessageSquareQuote,
  LayoutGrid,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  Globe,
  Hash,
  ExternalLink,
  Radio,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Users,
  Youtube,
  Link2,
  PlugZap,
} from "lucide-react";
import { FORMATS, HOOK_PATTERNS, HOOK_PATTERN_LABELS } from "../shared/types.js";
import type {
  MetricsInsight,
  ContentRecommendation,
  UnifiedIntelligenceResponse,
  VelocityResponse,
  ContentMixResponse,
  CadenceResponse,
  DashboardView,
} from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

type TopPerformer = {
  videoCode: string;
  title: string;
  format: string | null;
  audience: string | null;
  totalViews: number;
  totalLikes: number;
  totalSaves: number;
  totalShares: number;
  totalComments: number;
  totalEngagement: number;
  engagementRate: number;
  saveRate: number;
  outlierScore: number | null;
  medianViews: number;
};

type FormatMetric = {
  format: string;
  views: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  count: number;
  avgViews: number;
  engagementRate: number;
  saveRate: number;
};

type PlatformMetric = {
  platform: string;
  totalViews: number;
  totalSaves: number;
  totalShares: number;
  totalLikes: number;
  totalComments: number;
  videoCount: number;
  engagementRate: number;
};

type TrendPoint = {
  date: string;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
};

type InsightsResponse = {
  insights: MetricsInsight[];
  summary: string;
  recommendations: ContentRecommendation[];
};

type ResearchStatus = {
  running: boolean;
  report: { topic: string; generated_at: string; from_cache?: boolean } | null;
};

const FORMAT_COLORS: Record<string, string> = {
  A: "#0d9488",
  B: "#059669",
  C: "#0284c7",
  D: "#e11d48",
  E: "#7c3aed",
  F: "#ea580c",
  G: "#db2777",
};

const PLATFORM_COLORS = ["#0d9488", "#e11d48", "#0284c7", "#ea580c", "#7c3aed"];
const TREND_LINE_COLORS = { views: "#0d9488", likes: "#e11d48", saves: "#7c3aed", shares: "#ea580c", comments: "#0284c7" };

const PLATFORMS = [
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube_long", label: "YouTube Long" },
];

const INSIGHT_STYLES: Record<string, { icon: React.ReactNode; border: string; bg: string; text: string }> = {
  win: { icon: <Trophy size={14} />, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" },
  opportunity: { icon: <Target size={14} />, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700" },
  trend: { icon: <TrendingUp size={14} />, border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-700" },
  recommendation: { icon: <Lightbulb size={14} />, border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-700" },
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

const PLATFORM_PILL_COLORS: Record<string, string> = {
  IG: "bg-pink-100 text-pink-700",
  TikTok: "bg-slate-800 text-white",
  FB: "bg-blue-100 text-blue-700",
  All: "bg-slate-100 text-slate-700",
  Shorts: "bg-red-100 text-red-700",
};

function platformPillClass(platform: string): string {
  for (const [key, cls] of Object.entries(PLATFORM_PILL_COLORS)) {
    if (platform.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-slate-100 text-slate-600";
}

// Audience Segment Analytics Component
type AudienceMetric = {
  audience: string;
  label: string;
  views: number;
  likes: number;
  saves: number;
  videoCount: number;
  avgViews: number;
  engagementRate: number;
  saveRate: number;
};

const AudienceAnalytics: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<{ byAudience: AudienceMetric[] }>({
    queryKey: ["audience-analytics"],
    queryFn: () => fetch("/api/analytics/by-audience").then((r) => r.json()),
  });

  const audiences = data?.byAudience || [];
  if (audiences.length === 0) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Performance by Audience
        </p>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-4">
          <div className="space-y-3">
            {audiences.map((a) => (
              <div key={a.audience} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{a.label}</p>
                  <p className="text-[10px] text-slate-500">{a.videoCount} video{a.videoCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs font-bold text-slate-700 tabular-nums">{a.avgViews.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400">avg views</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-teal-600 tabular-nums">{a.engagementRate}%</p>
                    <p className="text-[9px] text-slate-400">eng rate</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-violet-600 tabular-nums">{a.saveRate}%</p>
                    <p className="text-[9px] text-slate-400">save rate</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

type MetricsViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const MetricsView: React.FC<MetricsViewProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formPlatform, setFormPlatform] = useState("instagram_reels");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formViews, setFormViews] = useState("");
  const [formLikes, setFormLikes] = useState("");
  const [formSaves, setFormSaves] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formComments, setFormComments] = useState("");
  const [formHookPattern, setFormHookPattern] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [runNowRunning, setRunNowRunning] = useState(false);
  const [runNowSec, setRunNowSec] = useState(0);
  const [runNowMessage, setRunNowMessage] = useState<string | null>(null);
  const [trendPlatform, setTrendPlatform] = useState<string>("all");
  const [insightsData, setInsightsData] = useState<InsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [addedRecIndex, setAddedRecIndex] = useState<number | null>(null);
  const addRecMutation = useMutation({
    mutationFn: async (rec: ContentRecommendation) => {
      const r = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: rec.ideaTopic,
            suggestedFormat: `${rec.suggestedFormat} (${FORMATS[rec.suggestedFormat as keyof typeof FORMATS]?.name || rec.suggestedFormat})`,
            hookAngle: rec.reason,
            priority: rec.confidenceScore === "high" ? "High" : rec.confidenceScore === "medium" ? "Medium" : "Low",
            source: "AI Strategy Recommendation",
            category: "trending",
          }],
        }),
      });
      if (!r.ok) throw new Error("Failed to add idea");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
    },
  });
  const [researchTopic, setResearchTopic] = useState("chiropractic content marketing");
  const [researchRunning, setResearchRunning] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intelligence data (unified response)
  const { data: intelData, isLoading: intelLoading, isError: intelError } = useQuery<UnifiedIntelligenceResponse>({
    queryKey: ["metrics", "intelligence"],
    queryFn: () => fetchJson<UnifiedIntelligenceResponse>("/api/metrics/intelligence"),
  });

  // Performance data
  const { data: topPerformers } = useQuery<{ topPerformers: TopPerformer[] }>({
    queryKey: ["metrics", "top-performers"],
    queryFn: () => fetchJson<{ topPerformers: TopPerformer[] }>("/api/metrics/top-performers"),
  });

  const { data: byFormat } = useQuery<{ byFormat: FormatMetric[] }>({
    queryKey: ["metrics", "by-format"],
    queryFn: () => fetchJson<{ byFormat: FormatMetric[] }>("/api/metrics/by-format"),
  });

  const { data: byPlatform } = useQuery<{ byPlatform: PlatformMetric[] }>({
    queryKey: ["metrics", "by-platform"],
    queryFn: () => fetchJson<{ byPlatform: PlatformMetric[] }>("/api/metrics/by-platform"),
  });

  const { data: trendsData } = useQuery<{ trends: TrendPoint[] }>({
    queryKey: ["metrics", "trends", trendPlatform],
    queryFn: () => {
      const params = trendPlatform !== "all" ? `?platform=${trendPlatform}&days=60` : "?days=60";
      return fetchJson<{ trends: TrendPoint[] }>(`/api/metrics/trends${params}`);
    },
  });

  // Analytics queries
  const { data: velocityData } = useQuery<VelocityResponse>({
    queryKey: ["analytics-velocity"],
    queryFn: () => fetchJson<VelocityResponse>("/api/analytics/velocity"),
  });

  const { data: contentMixData } = useQuery<ContentMixResponse>({
    queryKey: ["analytics-content-mix"],
    queryFn: () => fetchJson<ContentMixResponse>("/api/analytics/content-mix"),
  });

  const { data: cadenceData } = useQuery<CadenceResponse>({
    queryKey: ["analytics-cadence"],
    queryFn: () => fetchJson<CadenceResponse>("/api/analytics/cadence?weeks=4"),
  });

  // YouTube connection
  type YoutubeStatus = {
    connected: boolean;
    channelName?: string;
    channelId?: string;
    connectedAt?: string;
    linkedVideos?: number;
  };
  type YoutubeMatchResult = {
    channelVideosFound: number;
    matched: number;
    matches: Array<{ youtubeVideoId: string; youtubeTitle: string; videoCode: string; matchScore: number }>;
  };

  const { data: ytStatus, refetch: refetchYtStatus } = useQuery<YoutubeStatus>({
    queryKey: ["youtube-status"],
    queryFn: () => fetchJson<YoutubeStatus>("/api/metrics/youtube/status"),
    staleTime: 60_000,
  });
  const [ytMatchResult, setYtMatchResult] = useState<YoutubeMatchResult | null>(null);
  const [ytMatchExpanded, setYtMatchExpanded] = useState(false);
  const ytMatchMutation = useMutation({
    mutationFn: () => fetchJson<YoutubeMatchResult>("/api/metrics/youtube/match", { method: "POST" }),
    onSuccess: (data) => {
      setYtMatchResult(data);
      setYtMatchExpanded(true);
      refetchYtStatus();
    },
  });
  const [ytSyncResult, setYtSyncResult] = useState<{ synced: number } | null>(null);
  const ytSyncMutation = useMutation({
    mutationFn: () => fetchJson<{ synced: number }>("/api/metrics/youtube/sync", { method: "POST" }),
    onSuccess: (data) => {
      setYtSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      setTimeout(() => setYtSyncResult(null), 4000);
    },
  });
  const ytDisconnectMutation = useMutation({
    mutationFn: () => fetch("/api/metrics/youtube/disconnect", { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      refetchYtStatus();
      setYtMatchResult(null);
    },
  });

  // Attribution tracking
  type AttributionRow = { id: number; monthKey: string; count: number };
  const { data: attributionData, refetch: refetchAttribution } = useQuery<{ attributions: AttributionRow[]; total: number }>({
    queryKey: ["metrics", "attribution"],
    queryFn: () => fetchJson<{ attributions: AttributionRow[]; total: number }>("/api/metrics/attribution"),
  });
  const [tappedAttribution, setTappedAttribution] = useState(false);
  const tapMutation = useMutation({
    mutationFn: () => fetch("/api/metrics/attribution/tap", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      refetchAttribution();
      setTappedAttribution(true);
      setTimeout(() => setTappedAttribution(false), 2000);
    },
  });

  const handleSubmitMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;
    fetch(`/api/metrics/${formCode.toUpperCase()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: formPlatform,
        recordedAt: formDate,
        views: parseInt(formViews) || 0,
        likes: parseInt(formLikes) || 0,
        saves: parseInt(formSaves) || 0,
        shares: parseInt(formShares) || 0,
        comments: parseInt(formComments) || 0,
        hookPatternUsed: formHookPattern || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["metrics"] });
        setShowEntryForm(false);
        setFormCode("");
        setFormViews("");
        setFormLikes("");
        setFormSaves("");
        setFormShares("");
        setFormComments("");
        setFormHookPattern("");
      });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const data = await fetchJson<{ synced?: number; skipped?: number; message?: string; error?: string }>("/api/metrics/sync-n8n", { method: "POST" });
      if (data.synced && data.synced > 0) {
        setSyncMessage(`Synced ${data.synced} metric${data.synced > 1 ? "s" : ""} from n8n`);
        queryClient.invalidateQueries({ queryKey: ["metrics"] });
      } else {
        setSyncMessage(data.message || "No new metrics to sync");
      }
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Failed to connect to server");
      setTimeout(() => setSyncMessage(null), 5000);
    }
    setSyncing(false);
  };

  const handleRunNow = async () => {
    setRunNowRunning(true);
    setRunNowSec(0);
    setRunNowMessage(null);
    const timer = setInterval(() => setRunNowSec((s) => s + 1), 1000);
    try {
      const data = await fetchJson<{ triggered?: boolean; detail?: { synced?: number }; error?: string }>("/api/n8n/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowType: "content-intel" }),
      });
      clearInterval(timer);
      const synced = data.detail?.synced ?? 0;
      setRunNowMessage(synced > 0 ? `Synced ${synced} metric${synced > 1 ? "s" : ""} from fresh run` : "Run complete. No new metrics.");
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      setTimeout(() => setRunNowMessage(null), 6000);
    } catch (e) {
      clearInterval(timer);
      setRunNowMessage(e instanceof Error ? e.message : "Run failed");
      setTimeout(() => setRunNowMessage(null), 6000);
    }
    setRunNowRunning(false);
  };

  const handleAnalyze = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await fetchJson<InsightsResponse>("/api/metrics-ai/insights", { method: "POST" });
      setInsightsData(data);
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : "Failed to analyze");
    }
    setInsightsLoading(false);
  };

  const handleRunResearch = async () => {
    if (!researchTopic.trim()) return;
    setResearchRunning(true);
    setResearchError(null);
    try {
      await fetchJson("/api/metrics/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: researchTopic }),
      });
      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const status = await fetchJson<ResearchStatus>("/api/metrics/research/status");
          if (!status.running) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setResearchRunning(false);
            queryClient.invalidateQueries({ queryKey: ["metrics", "intelligence"] });
          }
        } catch {
          // Keep polling
        }
      }, 5000);
    } catch (e) {
      setResearchRunning(false);
      setResearchError(e instanceof Error ? e.message : "Failed to start research");
    }
  };

  // Handle YouTube OAuth callback redirect (clears query param from URL)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("youtube_connected") || url.searchParams.has("youtube_error")) {
      refetchYtStatus();
      url.searchParams.delete("youtube_connected");
      url.searchParams.delete("youtube_error");
      window.history.replaceState({}, "", url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const intel = intelData?.digest ?? null;
  const research = intelData?.research ?? null;
  const hookLibrary = intelData?.hookLibrary ?? [];
  const counts = intelData?.counts ?? { redditThreads: 0, xPosts: 0, webResults: 0, hookPatterns: 0 };
  const performers = topPerformers?.topPerformers ?? [];
  // Always include all 7 formats so charts render complete bars even when sparse
  const ALL_FORMAT_IDS = ["A", "B", "C", "D", "E", "F", "G"];
  const rawFormats = byFormat?.byFormat ?? [];
  const formatMap = new Map(rawFormats.map((f) => [f.format, f]));
  const formats = ALL_FORMAT_IDS.map((id) => formatMap.get(id) ?? {
    format: id,
    avgViews: 0,
    engagementRate: 0,
    saveRate: 0,
    totalVideos: 0,
  });
  const platforms = byPlatform?.byPlatform ?? [];
  const trends = trendsData?.trends ?? [];
  const hasPerformanceData = performers.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ================================================================ */}
      {/* CONTENT INTELLIGENCE SECTION                                     */}
      {/* ================================================================ */}

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Search size={20} className="text-teal-600" />
              <h2 className="text-lg font-serif font-bold text-slate-900">Content Intelligence</h2>
              {intel && (
                <span className="flex items-center gap-1 ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Calendar size={10} />
                  {intel.date}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Market trends, social signals, hook patterns, and strategic opportunities.
            </p>
            {/* Data source counts */}
            {!intelLoading && !intelError && (
              <div className="flex items-center gap-3 mt-2">
                {counts.redditThreads > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600">
                    <Hash size={10} /> {counts.redditThreads} Reddit
                  </span>
                )}
                {counts.xPosts > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                    <Hash size={10} /> {counts.xPosts} X posts
                  </span>
                )}
                {counts.hookPatterns > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600">
                    <MessageSquareQuote size={10} /> {counts.hookPatterns} hooks
                  </span>
                )}
                {(counts as Record<string, number>).instagramResults > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-pink-600">
                    <Hash size={10} /> {(counts as Record<string, number>).instagramResults} IG
                  </span>
                )}
                {(counts as Record<string, number>).tiktokResults > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-800">
                    <Hash size={10} /> {(counts as Record<string, number>).tiktokResults} TikTok
                  </span>
                )}
                {(counts as Record<string, number>).facebookResults > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                    <Hash size={10} /> {(counts as Record<string, number>).facebookResults} FB
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={insightsLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors shrink-0 border",
              insightsLoading
                ? "border-violet-200 text-violet-400 cursor-wait bg-white"
                : "border-violet-300 text-violet-600 bg-white hover:bg-violet-50",
            )}
            title="Synthesize existing research data into strategic recommendations"
          >
            {insightsLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {insightsLoading ? "Analyzing..." : "Synthesize Data"}
          </button>
        </div>

        {/* Research Trigger */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Radio size={14} className="text-teal-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Research
            </p>
            {research && (
              <span className="text-[10px] text-slate-400 ml-auto">
                Last: "{research.topic}" ({new Date(research.generated_at).toLocaleDateString()})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={researchTopic}
              onChange={(e) => setResearchTopic(e.target.value)}
              placeholder="Topic to research (e.g. chiropractic content marketing)"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={researchRunning}
            />
            <button
              onClick={handleRunResearch}
              disabled={researchRunning || !researchTopic.trim()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors shrink-0",
                researchRunning
                  ? "bg-teal-100 text-teal-400 cursor-wait"
                  : "bg-teal-600 text-white hover:bg-teal-700",
              )}
            >
              {researchRunning ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {researchRunning ? "Researching..." : "Run Research"}
            </button>
          </div>
          {researchError && <p className="text-xs text-rose-600 mt-2">{researchError}</p>}
          {researchRunning && (
            <p className="text-xs text-teal-600 mt-2">Searching Reddit, X, and web for "{researchTopic}". This may take 30-60 seconds.</p>
          )}
        </div>
      </header>

      {/* Intelligence Cards */}
      {intelLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Loader2 size={32} className="text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading market intelligence...</p>
        </div>
      ) : intelError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Failed to load intelligence data</p>
            <p className="text-xs text-amber-600 mt-1">Check that the server is running. The page will retry automatically.</p>
          </div>
        </div>
      ) : intel ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trending Topics */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} className="text-orange-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Trending Topics
              </p>
            </div>
            <div className="space-y-2.5">
              {intel.trendingTopics.map((topic, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{topic.topic}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{topic.context}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {topic.platforms.map((p) => (
                      <span key={p} className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", platformPillClass(p))}>
                        {p}
                      </span>
                    ))}
                    {topic.engagementRange && (
                      <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                        {topic.engagementRange}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hook Patterns */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquareQuote size={14} className="text-violet-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Hook Patterns
              </p>
            </div>
            {intel.hookPatterns.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400">No hook patterns found in this research digest.</p>
                <p className="text-[10px] text-slate-300 mt-1">Run research above or use /viral-scout to surface hook patterns.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {intel.hookPatterns.map((hook, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{hook.type}</span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", platformPillClass(hook.platform))}>
                        {hook.platform}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", PRIORITY_STYLES[hook.priority] ?? PRIORITY_STYLES.Medium)}>
                        {hook.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 italic">"{hook.text}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content Gaps */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Content Gaps
              </p>
            </div>
            <div className="space-y-3">
              {intel.contentGaps.map((gap, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-slate-900">{gap.area}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{gap.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Format Trends */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid size={14} className="text-teal-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Format Trends
              </p>
            </div>
            <div className="space-y-2.5">
              {intel.formatTrends.map((ft, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black text-white shrink-0"
                    style={{ backgroundColor: FORMAT_COLORS[ft.format] ?? "#94a3b8" }}
                  >
                    {ft.format}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {FORMATS[ft.format as keyof typeof FORMATS]?.name ?? ft.format}
                    </p>
                    <p className="text-xs text-slate-500">{ft.trend}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Search size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-serif text-slate-700">No intelligence data yet</p>
          <p className="text-sm text-slate-500 mt-2">
            Run the Content Intelligence workflow or use Research above to gather market data.
          </p>
        </div>
      )}

      {/* ================================================================ */}
      {/* SOCIAL SIGNALS SECTION                                           */}
      {/* ================================================================ */}

      {research && (research.reddit.length > 0 || research.x.length > 0 || research.web.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-teal-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Social Signals
            </p>
            <span className="text-[10px] text-slate-400 ml-2">
              "{research.topic}" ({research.range.from} to {research.range.to})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reddit Signals */}
            {research.reddit.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-orange-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Reddit ({research.reddit.length})
                  </p>
                </div>
                <div className="space-y-3">
                  {research.reddit.slice(0, 6).map((thread) => (
                    <div key={thread.id} className="group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-bold text-orange-600">r/{thread.subreddit}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold",
                              thread.score >= 70 ? "bg-emerald-100 text-emerald-700"
                                : thread.score >= 40 ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600",
                            )}>
                              {thread.score}
                            </span>
                          </div>
                          <p className="text-sm text-slate-900 leading-tight">{thread.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{thread.why_relevant}</p>
                          {thread.comment_insights.length > 0 && (
                            <p className="text-xs text-teal-600 mt-1 italic">
                              "{thread.comment_insights[0]}"
                            </p>
                          )}
                        </div>
                        <a href={thread.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-teal-500 shrink-0 mt-1">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* X Signals */}
            {research.x.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[14px] font-black text-slate-700">X</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Posts ({research.x.length})
                  </p>
                </div>
                <div className="space-y-3">
                  {research.x.slice(0, 6).map((post) => (
                    <div key={post.id} className="group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-bold text-slate-600">@{post.author_handle}</span>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-bold",
                              post.score >= 70 ? "bg-emerald-100 text-emerald-700"
                                : post.score >= 40 ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600",
                            )}>
                              {post.score}
                            </span>
                            {post.engagement && (
                              <span className="text-[9px] text-slate-400">
                                {post.engagement.likes ? `${post.engagement.likes} likes` : ""}
                                {post.engagement.reposts ? ` ${post.engagement.reposts} reposts` : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-900 leading-tight">{post.text.slice(0, 150)}{post.text.length > 150 ? "..." : ""}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{post.why_relevant}</p>
                        </div>
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-teal-500 shrink-0 mt-1">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Web Results (if no Reddit/X but web exists) */}
            {research.reddit.length === 0 && research.x.length === 0 && research.web.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={14} className="text-sky-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Web Results ({research.web.length})
                  </p>
                </div>
                <div className="space-y-3">
                  {research.web.slice(0, 6).map((result) => (
                    <div key={result.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold text-sky-600">{result.source_domain}</span>
                        </div>
                        <p className="text-sm text-slate-900 leading-tight">{result.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{result.snippet.slice(0, 120)}</p>
                      </div>
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-teal-500 shrink-0 mt-1">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Research errors */}
          {(research.reddit_error || research.x_error) && (
            <div className="mt-2 flex gap-4">
              {research.reddit_error && (
                <p className="text-[10px] text-amber-500">Reddit: {research.reddit_error.slice(0, 80)}</p>
              )}
              {research.x_error && (
                <p className="text-[10px] text-amber-500">X: {research.x_error.slice(0, 80)}</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* AI Strategy Panel */}
      {(insightsData || insightsLoading || insightsError) && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-violet-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              AI Strategy Analysis
            </p>
          </div>

          {insightsLoading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <Loader2 size={24} className="text-violet-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-violet-600">Analyzing market intelligence and building strategy...</p>
            </div>
          )}

          {insightsError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-sm text-rose-700">{insightsError}</p>
            </div>
          )}

          {insightsData && !insightsLoading && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-sm text-slate-700">{insightsData.summary}</p>
              </div>

              {/* Insight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insightsData.insights.map((insight, i) => {
                  const style = INSIGHT_STYLES[insight.type] ?? INSIGHT_STYLES.trend;
                  return (
                    <div key={i} className={cn("border rounded-2xl p-4", style.border)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("p-1 rounded-lg", style.bg, style.text)}>{style.icon}</span>
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", style.text)}>
                          {insight.type}
                        </span>
                      </div>
                      <p className="font-medium text-slate-900 text-sm">{insight.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{insight.detail}</p>
                    </div>
                  );
                })}
              </div>

              {/* Content Recommendations */}
              {insightsData.recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-4">
                    <Zap size={14} className="text-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Content Recommendations
                    </p>
                  </div>
                  <div className="space-y-2">
                    {insightsData.recommendations.map((rec, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{rec.ideaTopic}</p>
                          <p className="text-xs text-slate-500 mt-1">{rec.reason}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black text-white"
                              style={{ backgroundColor: FORMAT_COLORS[rec.suggestedFormat] ?? "#94a3b8" }}
                            >
                              {rec.suggestedFormat}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {rec.suggestedPlatform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", CONFIDENCE_STYLES[rec.confidenceScore] ?? CONFIDENCE_STYLES.medium)}>
                              {rec.confidenceScore}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            addRecMutation.mutate(rec);
                            setAddedRecIndex(i);
                            setTimeout(() => setAddedRecIndex(null), 2000);
                          }}
                          disabled={addRecMutation.isPending || addedRecIndex === i}
                          className={cn(
                            "shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                            addedRecIndex === i
                              ? "bg-teal-50 text-teal-600"
                              : "bg-teal-600 text-white hover:bg-teal-700",
                          )}
                        >
                          {addedRecIndex === i ? <Check size={12} /> : <Plus size={12} />}
                          {addedRecIndex === i ? "Added" : "Add to Ideas"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* BUSINESS OUTCOMES ATTRIBUTION                                    */}
      {/* ================================================================ */}

      <section className="border border-slate-200 rounded-2xl p-5 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-teal-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Business Outcomes</p>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              When a patient says they found you on social, tap to log it.
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">
                {attributionData?.attributions.find((a) => a.monthKey === new Date().toISOString().slice(0, 7))?.count ?? 0}
              </span>
              <span className="text-sm text-slate-400">this month</span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-sm font-semibold text-slate-600">{attributionData?.total ?? 0}</span>
              <span className="text-sm text-slate-400">all-time</span>
            </div>
          </div>
          <button
            onClick={() => tapMutation.mutate()}
            disabled={tapMutation.isPending}
            className={cn(
              "shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 transition-all",
              tappedAttribution
                ? "bg-teal-50 border-teal-300 text-teal-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50 active:scale-95",
            )}
          >
            {tappedAttribution ? (
              <>
                <Check size={22} className="text-teal-600" />
                <span className="text-[10px] font-bold text-teal-600 mt-1">Logged</span>
              </>
            ) : (
              <>
                <Users size={22} />
                <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">Log it</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ================================================================ */}
      {/* YOUTUBE AUTO-SYNC                                                */}
      {/* ================================================================ */}

      <section className="border border-slate-200 rounded-2xl p-5 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Youtube size={14} className="text-rose-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">YouTube Auto-Sync</p>
          {ytStatus?.connected && (
            <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} />
              Connected
            </span>
          )}
        </div>

        {!ytStatus?.connected ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">
                Connect your YouTube channel to pull views, likes, and comments automatically.
              </p>
              <p className="text-xs text-slate-400">No manual metric entry for YouTube Shorts or Long-form.</p>
            </div>
            <a
              href="/api/metrics/youtube/auth"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-colors"
            >
              <PlugZap size={12} />
              Connect
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{ytStatus.channelName}</p>
                <p className="text-xs text-slate-400">
                  {ytStatus.linkedVideos ?? 0} videos linked
                  {ytStatus.connectedAt && ` · connected ${new Date(ytStatus.connectedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => ytDisconnectMutation.mutate()}
                disabled={ytDisconnectMutation.isPending}
                className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors underline"
              >
                Disconnect
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => ytMatchMutation.mutate()}
                disabled={ytMatchMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:border-teal-300 hover:text-teal-700 transition-colors disabled:opacity-50"
              >
                {ytMatchMutation.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Link2 size={11} />
                )}
                {ytMatchMutation.isPending ? "Matching..." : "Auto-Match Videos"}
              </button>
              <button
                onClick={() => ytSyncMutation.mutate()}
                disabled={ytSyncMutation.isPending || (ytStatus.linkedVideos ?? 0) === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {ytSyncMutation.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : ytSyncResult ? (
                  <Check size={11} />
                ) : (
                  <RefreshCw size={11} />
                )}
                {ytSyncMutation.isPending
                  ? "Syncing..."
                  : ytSyncResult
                    ? `Synced ${ytSyncResult.synced} videos`
                    : "Sync Now"}
              </button>
            </div>

            {ytMatchMutation.error && (
              <p className="text-xs text-rose-600">{String(ytMatchMutation.error)}</p>
            )}

            {ytMatchResult && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setYtMatchExpanded((x) => !x)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <span>
                    Matched {ytMatchResult.matched} of {ytMatchResult.channelVideosFound} channel videos
                  </span>
                  {ytMatchExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {ytMatchExpanded && (
                  <div className="px-3 py-2 max-h-48 overflow-y-auto space-y-1">
                    {ytMatchResult.matches.map((m) => (
                      <div key={m.youtubeVideoId} className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-600 leading-snug flex-1 line-clamp-1">{m.youtubeTitle}</p>
                        <span className="shrink-0 text-[10px] font-bold text-teal-700 font-mono">{m.videoCode}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{m.matchScore}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* PERFORMANCE METRICS SECTION                                      */}
      {/* ================================================================ */}

      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Performance Tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPerformanceData && (
              <button
                onClick={() => setShowPerformance(!showPerformance)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
              >
                {showPerformance ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showPerformance ? "Collapse" : "Expand"}
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || runNowRunning}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                syncing || runNowRunning
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-teal-600 text-white hover:bg-teal-700",
              )}
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              Sync
            </button>
            <button
              onClick={handleRunNow}
              disabled={runNowRunning || syncing}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                runNowRunning
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-emerald-600 text-white hover:bg-emerald-700",
              )}
              title="Trigger n8n workflow now and sync results"
            >
              <Zap size={12} className={runNowRunning ? "animate-pulse" : ""} />
              {runNowRunning ? `Running… ${runNowSec}s` : "Run Now"}
            </button>
            <button
              onClick={() => setShowEntryForm(!showEntryForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-slate-300 transition-colors"
            >
              {showEntryForm ? <X size={12} /> : <Plus size={12} />}
              Manual
            </button>
          </div>
        </div>

        {syncMessage && (
          <p className="text-xs text-teal-600 mt-2">{syncMessage}</p>
        )}
        {runNowMessage && (
          <p className="text-xs text-emerald-600 mt-2">{runNowMessage}</p>
        )}

        {/* Manual Entry Form */}
        {showEntryForm && (
          <form
            onSubmit={handleSubmitMetric}
            className="bg-white border border-slate-200 rounded-2xl p-5 mt-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
              Log Performance
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Video code (e.g. P1)"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="col-span-2 md:col-span-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex items-center gap-1">
                <Eye size={14} className="text-slate-400" />
                <input type="number" placeholder="Views" value={formViews} onChange={(e) => setFormViews(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex items-center gap-1">
                <Heart size={14} className="text-slate-400" />
                <input type="number" placeholder="Likes" value={formLikes} onChange={(e) => setFormLikes(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex items-center gap-1">
                <Bookmark size={14} className="text-slate-400" />
                <input type="number" placeholder="Saves" value={formSaves} onChange={(e) => setFormSaves(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex items-center gap-1">
                <Share2 size={14} className="text-slate-400" />
                <input type="number" placeholder="Shares" value={formShares} onChange={(e) => setFormShares(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle size={14} className="text-slate-400" />
                <input type="number" placeholder="Comments" value={formComments} onChange={(e) => setFormComments(e.target.value)} className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <select
                value={formHookPattern}
                onChange={(e) => setFormHookPattern(e.target.value)}
                className="col-span-2 md:col-span-2 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-600"
              >
                <option value="">Hook pattern (optional)</option>
                {HOOK_PATTERNS.map((p) => (
                  <option key={p} value={p}>{HOOK_PATTERN_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
            >
              Save Metrics
            </button>
          </form>
        )}

        {/* No performance data message */}
        {!hasPerformanceData && !showEntryForm && (
          <p className="text-xs text-slate-400 mt-3">
            Performance tracking will appear here once you start publishing content. Use Sync after configuring your platform API credentials.
          </p>
        )}

        {/* Performance Charts (collapsible) */}
        {hasPerformanceData && showPerformance && (
          <div className="space-y-6 mt-4">
            {/* Trend Chart */}
            {trends.length > 1 && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Performance Over Time
                  </p>
                  <div className="flex gap-1.5">
                    {[{ value: "all", label: "All" }, ...PLATFORMS].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setTrendPlatform(p.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                          trendPlatform === p.value
                            ? "bg-teal-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      labelFormatter={(d) => String(d)}
                      formatter={(value, name) => [Number(value).toLocaleString(), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                    />
                    <Line type="monotone" dataKey="views" stroke={TREND_LINE_COLORS.views} strokeWidth={2} dot={false} name="Views" />
                    <Line type="monotone" dataKey="saves" stroke={TREND_LINE_COLORS.saves} strokeWidth={2} dot={false} name="Saves" />
                    <Line type="monotone" dataKey="likes" stroke={TREND_LINE_COLORS.likes} strokeWidth={1.5} dot={false} name="Likes" />
                    <Legend iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>} />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Top Performers */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                Top Performers
              </p>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Video</th>
                        <th className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Views</th>
                        <th className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Saves</th>
                        <th className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Eng. Rate</th>
                        <th className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Save Rate</th>
                        <th className="text-right px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          <FeatureHint id="outlier-score" content={FEATURE_HINTS["outlier-score"].content} side="top">
                            <span>Outlier</span>
                          </FeatureHint>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {performers.slice(0, 10).map((p) => {
                        const outlier = p.outlierScore ?? null;
                        const outlierCls = outlier && outlier >= 10
                          ? "bg-violet-100 text-violet-700"
                          : outlier && outlier >= 5
                          ? "bg-teal-100 text-teal-700"
                          : outlier && outlier >= 2
                          ? "bg-emerald-100 text-emerald-700"
                          : null;
                        return (
                        <tr key={p.videoCode} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {p.format && (
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: FORMAT_COLORS[p.format] ?? "#94a3b8" }} />
                              )}
                              <span className="font-medium text-slate-900">{p.videoCode}</span>
                              <span className="text-slate-500 truncate max-w-[200px]">{p.title}</span>
                            </div>
                          </td>
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{(p.totalViews ?? 0).toLocaleString()}</td>
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{(p.totalSaves ?? 0).toLocaleString()}</td>
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{p.engagementRate > 0 ? `${p.engagementRate}%` : "—"}</td>
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{(p.totalSaves ?? 0) > 0 ? `${p.saveRate}%` : "—"}</td>
                          <td className="text-right px-3 py-3">
                            {outlierCls ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${outlierCls}`}>
                                {outlier}x
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Avg Views by Format
                  </p>
                  {rawFormats.length < 3 && (
                    <span className="text-[10px] text-slate-400 italic">Publish more formats to compare</span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={formats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="format" tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(f: string) => FORMATS[f as keyof typeof FORMATS]?.shortName ?? f} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Avg Views"]} />
                    <Bar dataKey="avgViews" radius={[6, 6, 0, 0]}>
                      {formats.map((entry) => (
                        <Cell key={entry.format} fill={entry.avgViews > 0 ? (FORMAT_COLORS[entry.format] ?? "#94a3b8") : "#e2e8f0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {(() => {
                  const topFmt = [...formats].filter((f) => f.avgViews > 0).sort((a, b) => b.avgViews - a.avgViews)[0];
                  if (!topFmt) return null;
                  return (
                    <p className="text-[11px] text-slate-500 mt-3 italic">
                      Format {topFmt.format} leads with {topFmt.avgViews.toLocaleString()} avg views. Prioritize more {FORMATS[topFmt.format as keyof typeof FORMATS]?.name ?? topFmt.format} videos to maximize reach.
                    </p>
                  );
                })()}
              </section>

              {platforms.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                    Views by Platform
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={platforms.map((p) => ({
                          name: p.platform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                          value: p.totalViews ?? 0,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {platforms.map((_, i) => (
                          <Cell key={i} fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Views"]} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </section>
              )}
            </div>

            {/* Engagement Rate by Format */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Engagement & Save Rate by Format
                </p>
                {rawFormats.length < 3 && (
                  <span className="text-[10px] text-slate-400 italic">Publish more formats to compare</span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={formats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="format" tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(f: string) => FORMATS[f as keyof typeof FORMATS]?.shortName ?? f} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0}%`, name === "engagementRate" ? "Engagement Rate" : "Save Rate"]} />
                  <Bar dataKey="engagementRate" fill="#0d9488" name="engagementRate" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saveRate" fill="#7c3aed" name="saveRate" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {(() => {
                const topEng = [...formats].filter((f) => f.engagementRate > 0).sort((a, b) => b.engagementRate - a.engagementRate)[0];
                const topSave = [...formats].filter((f) => f.saveRate > 0).sort((a, b) => b.saveRate - a.saveRate)[0];
                if (!topEng && !topSave) return null;
                const note = topSave
                  ? `Format ${topSave.format} drives the most saves (${topSave.saveRate}%) — ideal for evergreen content worth bookmarking.`
                  : `Format ${topEng!.format} has your highest engagement rate (${topEng!.engagementRate}%) — audiences respond well to this format.`;
                return <p className="text-[11px] text-slate-500 mt-3 italic">{note}</p>;
              })()}
            </section>

            {/* Production Velocity */}
            {velocityData && velocityData.transitions.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Production Velocity
                  </p>
                  <div className="flex items-center gap-3">
                    {velocityData.completedVideos > 0 && (
                      <span className="text-xs text-emerald-600 font-bold">{velocityData.completedVideos} published</span>
                    )}
                    {velocityData.avgDaysTotal > 0 && (
                      <span className="text-xs text-slate-500">{velocityData.avgDaysTotal}d avg total</span>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={velocityData.transitions} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} unit="d" domain={[0, Math.min(30, Math.max(7, ...velocityData.transitions.map((t) => t.avgDays ?? 0)) * 1.1)]} />
                    <YAxis
                      type="category"
                      dataKey="fromStatus"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      width={90}
                      tickFormatter={(v: string) => v.slice(0, 6)}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                      formatter={(value: number | undefined) => [`${value ?? 0}d`, "Avg Days"]}
                      labelFormatter={(label: unknown) => {
                        const labelStr = String(label);
                        const t = velocityData.transitions.find((tr) => tr.fromStatus === labelStr);
                        return t ? `${t.fromStatus} to ${t.toStatus}` : labelStr;
                      }}
                    />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                      {velocityData.transitions.map((t) => (
                        <Cell
                          key={`${t.fromStatus}-${t.toStatus}`}
                          fill={velocityData.bottleneck?.stage === `${t.fromStatus}→${t.toStatus}` ? "#e11d48" : "#0d9488"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {velocityData.bottleneck ? (
                  <p className="text-[11px] text-rose-600 mt-3 italic">
                    <AlertTriangle size={11} className="inline mr-1" />
                    Bottleneck at {velocityData.bottleneck.stage} ({velocityData.bottleneck.avgDays}d avg). Consider a focused session to clear this stage.
                  </p>
                ) : velocityData.avgDaysTotal > 0 ? (
                  <p className="text-[11px] text-slate-500 mt-3 italic">
                    Average {velocityData.avgDaysTotal}d from start to publish. Batch sessions reduce this significantly.
                  </p>
                ) : null}
              </section>
            )}

            {/* Audience Segment Analytics */}
            <AudienceAnalytics />

            {/* Content Mix + Platform Cadence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Content Mix Compliance */}
              {contentMixData && contentMixData.totalPublished > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Content Mix
                    </p>
                    {contentMixData.compliant ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={12} /> On Target
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                        <AlertTriangle size={12} /> Off Target
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {Object.entries(contentMixData.targets).map(([type, target]) => {
                      const actual = contentMixData.actual[type] ?? 0;
                      const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{label}</span>
                            <span className="text-slate-500">
                              {Math.round(actual * 100)}% / {Math.round(target * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                Math.abs(actual - target) > 0.1 ? "bg-amber-400" : "bg-emerald-500",
                              )}
                              style={{ width: `${Math.min(actual * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 mt-2">{contentMixData.totalPublished} published videos</p>
                  </div>
                </section>
              )}

              {/* Platform Cadence */}
              {cadenceData && cadenceData.overall.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                    Platform Cadence
                  </p>
                  <div className="space-y-2.5">
                    {cadenceData.overall.map((p) => {
                      const label = p.platform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <div key={p.platform} className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700 w-32 truncate">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs tabular-nums text-slate-500">
                              {p.avgPerWeek}/{p.target} per week
                            </span>
                            {p.onTrack ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : p.avgPerWeek === 0 ? (
                              <XCircle size={14} className="text-rose-400" />
                            ) : (
                              <XCircle size={14} className="text-amber-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {cadenceData.weeks.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 mb-2">Last 4 Weeks</p>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        {cadenceData.weeks.map((w) => (
                          <div key={w.weekStart} className="text-center">
                            <p className="text-slate-400 truncate">{w.weekLabel.split(" - ")[0]}</p>
                            {w.platforms.map((p) => (
                              <div
                                key={p.platform}
                                className={cn(
                                  "rounded px-1 py-0.5 mt-0.5 font-bold",
                                  p.onTrack ? "bg-emerald-50 text-emerald-700" : p.actual === 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600",
                                )}
                              >
                                {p.actual}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {onNavigate && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("OPPORTUNITIES")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Find New Opportunities</span>
              <span className="block text-xs text-teal-600 mt-0.5">Use your performance data to discover what works</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.METRICS} />
    </div>
  );
};
