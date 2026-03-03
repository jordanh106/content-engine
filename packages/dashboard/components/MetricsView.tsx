import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { FORMATS } from "../shared/types.js";
import type {
  MetricsInsight,
  ContentRecommendation,
  IntelDigest,
} from "../shared/types.js";
import { cn } from "../utils/cn.js";

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

type IntelligenceResponse = {
  latest: IntelDigest | null;
  availableDates: string[];
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

export const MetricsView: React.FC = () => {
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
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [trendPlatform, setTrendPlatform] = useState<string>("all");
  const [insightsData, setInsightsData] = useState<InsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);

  // Intelligence data
  const { data: intelData, isLoading: intelLoading, isError: intelError } = useQuery<IntelligenceResponse>({
    queryKey: ["metrics", "intelligence"],
    queryFn: () => fetchJson<IntelligenceResponse>("/api/metrics/intelligence"),
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
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Failed to connect to server");
    }
    setSyncing(false);
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

  const intel = intelData?.latest ?? null;
  const performers = topPerformers?.topPerformers ?? [];
  const formats = byFormat?.byFormat ?? [];
  const platforms = byPlatform?.byPlatform ?? [];
  const trends = trendsData?.trends ?? [];
  const hasPerformanceData = performers.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ================================================================ */}
      {/* CONTENT INTELLIGENCE SECTION                                     */}
      {/* ================================================================ */}

      {/* Header */}
      <header>
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
              Market trends, hook patterns, and strategic opportunities for your niche.
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={insightsLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors shrink-0",
              insightsLoading
                ? "bg-violet-100 text-violet-400 cursor-wait"
                : "bg-violet-600 text-white hover:bg-violet-700",
            )}
          >
            {insightsLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {insightsLoading ? "Analyzing..." : "Analyze Strategy"}
          </button>
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
            Run the Content Intelligence n8n workflow to generate market insights and trending data.
          </p>
        </div>
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
                        <ArrowUpRight size={16} className="text-slate-300 shrink-0 mt-1" />
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
              disabled={syncing}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                syncing
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-teal-600 text-white hover:bg-teal-700",
              )}
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              Sync
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
                      </tr>
                    </thead>
                    <tbody>
                      {performers.slice(0, 10).map((p) => (
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
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{p.engagementRate}%</td>
                          <td className="text-right px-3 py-3 text-slate-700 tabular-nums">{p.saveRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formats.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                    Avg Views by Format
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={formats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="format" tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(f: string) => FORMATS[f as keyof typeof FORMATS]?.shortName ?? f} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Avg Views"]} />
                      <Bar dataKey="avgViews" radius={[6, 6, 0, 0]}>
                        {formats.map((entry) => (
                          <Cell key={entry.format} fill={FORMAT_COLORS[entry.format] ?? "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              )}

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
            {formats.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                  Engagement & Save Rate by Format
                </p>
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
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
