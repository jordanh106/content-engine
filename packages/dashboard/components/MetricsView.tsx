import React, { useState } from "react";
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
  Target,
  Zap,
} from "lucide-react";
import { FORMATS } from "../shared/types.js";
import type { MetricsInsight, ContentRecommendation } from "../shared/types.js";
import { cn } from "../utils/cn.js";

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

  const { data: topPerformers } = useQuery<{ topPerformers: TopPerformer[] }>({
    queryKey: ["metrics", "top-performers"],
    queryFn: () => fetch("/api/metrics/top-performers").then((r) => r.json()),
  });

  const { data: byFormat } = useQuery<{ byFormat: FormatMetric[] }>({
    queryKey: ["metrics", "by-format"],
    queryFn: () => fetch("/api/metrics/by-format").then((r) => r.json()),
  });

  const { data: byPlatform } = useQuery<{ byPlatform: PlatformMetric[] }>({
    queryKey: ["metrics", "by-platform"],
    queryFn: () => fetch("/api/metrics/by-platform").then((r) => r.json()),
  });

  const { data: trendsData } = useQuery<{ trends: TrendPoint[] }>({
    queryKey: ["metrics", "trends", trendPlatform],
    queryFn: () => {
      const params = trendPlatform !== "all" ? `?platform=${trendPlatform}&days=60` : "?days=60";
      return fetch(`/api/metrics/trends${params}`).then((r) => r.json());
    },
  });

  const addMetric = useMutation({
    mutationFn: (data: { code: string; body: Record<string, unknown> }) =>
      fetch(`/api/metrics/${data.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      setShowEntryForm(false);
      setFormCode("");
      setFormViews("");
      setFormLikes("");
      setFormSaves("");
      setFormShares("");
      setFormComments("");
    },
  });

  const handleSubmitMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return;
    addMetric.mutate({
      code: formCode.toUpperCase(),
      body: {
        platform: formPlatform,
        recordedAt: formDate,
        views: parseInt(formViews) || 0,
        likes: parseInt(formLikes) || 0,
        saves: parseInt(formSaves) || 0,
        shares: parseInt(formShares) || 0,
        comments: parseInt(formComments) || 0,
      },
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/metrics/sync-n8n", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(`Sync failed: ${data.error}`);
      } else if (data.synced > 0) {
        setSyncMessage(`Synced ${data.synced} metric${data.synced > 1 ? "s" : ""} from n8n`);
        queryClient.invalidateQueries({ queryKey: ["metrics"] });
      } else {
        setSyncMessage(data.message || "No new metrics to sync");
      }
    } catch {
      setSyncMessage("Failed to connect to server");
    }
    setSyncing(false);
  };

  const handleAnalyze = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetch("/api/metrics-ai/insights", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setInsightsData(data);
    } catch (e) {
      setInsightsError(e instanceof Error ? e.message : "Failed to analyze");
    }
    setInsightsLoading(false);
  };

  const performers = topPerformers?.topPerformers ?? [];
  const formats = byFormat?.byFormat ?? [];
  const platforms = byPlatform?.byPlatform ?? [];
  const trends = trendsData?.trends ?? [];
  const hasData = performers.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={20} className="text-teal-600" />
              <h2 className="text-lg font-serif font-bold text-slate-900">Performance Metrics</h2>
            </div>
            <p className="text-sm text-slate-500">
              Track engagement across platforms. Data drives better content decisions.
            </p>
            {syncMessage && (
              <p className="text-xs text-teal-600 mt-1.5">{syncMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAnalyze}
              disabled={insightsLoading || !hasData}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                insightsLoading
                  ? "bg-violet-100 text-violet-400 cursor-wait"
                  : !hasData
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-violet-600 text-white hover:bg-violet-700",
              )}
            >
              {insightsLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {insightsLoading ? "Analyzing..." : "AI Insights"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                syncing
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-teal-600 text-white hover:bg-teal-700",
              )}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync n8n"}
            </button>
            <button
              onClick={() => setShowEntryForm(!showEntryForm)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold uppercase tracking-widest hover:border-slate-300 transition-colors"
            >
              {showEntryForm ? <X size={14} /> : <Plus size={14} />}
              {showEntryForm ? "Cancel" : "Manual"}
            </button>
          </div>
        </div>
      </header>

      {/* Manual Entry Form */}
      {showEntryForm && (
        <form
          onSubmit={handleSubmitMetric}
          className="bg-white border border-slate-200 rounded-2xl p-5"
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
            disabled={addMetric.isPending}
            className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {addMetric.isPending ? "Saving..." : "Save Metrics"}
          </button>
        </form>
      )}

      {/* Empty State */}
      {!hasData && !showEntryForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <TrendingUp size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-serif text-slate-700">No metrics yet</p>
          <p className="text-sm text-slate-500 mt-2">
            Click "Sync n8n" to pull metrics from your automation, or "Manual" to log data by hand.
          </p>
        </div>
      )}

      {hasData && (
        <>
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

          {/* AI Insights Panel */}
          {(insightsData || insightsLoading || insightsError) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-violet-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  AI Performance Insights
                </p>
              </div>

              {insightsLoading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                  <Loader2 size={24} className="text-violet-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-violet-600">Analyzing your content performance...</p>
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
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
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
        </>
      )}
    </div>
  );
};
