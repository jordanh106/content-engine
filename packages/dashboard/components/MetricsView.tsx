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
} from "recharts";
import { TrendingUp, Eye, Heart, Bookmark, Share2, MessageCircle, Plus, X } from "lucide-react";
import { FORMATS } from "../shared/types.js";

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

const PLATFORMS = [
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "youtube_long", label: "YouTube Long" },
];

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

  const performers = topPerformers?.topPerformers ?? [];
  const formats = byFormat?.byFormat ?? [];
  const platforms = byPlatform?.byPlatform ?? [];
  const hasData = performers.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900">Performance Metrics</h2>
            <p className="text-sm text-slate-500 mt-1">
              Track engagement across platforms. Data drives better content decisions.
            </p>
          </div>
          <button
            onClick={() => setShowEntryForm(!showEntryForm)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
          >
            {showEntryForm ? <X size={14} /> : <Plus size={14} />}
            {showEntryForm ? "Cancel" : "Add Metrics"}
          </button>
        </div>
      </header>

      {/* Metrics Entry Form */}
      {showEntryForm && (
        <form
          onSubmit={handleSubmitMetric}
          className="bg-white border border-slate-200 rounded-2xl p-5 mb-6"
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
              <input
                type="number"
                placeholder="Views"
                value={formViews}
                onChange={(e) => setFormViews(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <Heart size={14} className="text-slate-400" />
              <input
                type="number"
                placeholder="Likes"
                value={formLikes}
                onChange={(e) => setFormLikes(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <Bookmark size={14} className="text-slate-400" />
              <input
                type="number"
                placeholder="Saves"
                value={formSaves}
                onChange={(e) => setFormSaves(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <Share2 size={14} className="text-slate-400" />
              <input
                type="number"
                placeholder="Shares"
                value={formShares}
                onChange={(e) => setFormShares(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle size={14} className="text-slate-400" />
              <input
                type="number"
                placeholder="Comments"
                value={formComments}
                onChange={(e) => setFormComments(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
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

      {!hasData && !showEntryForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <TrendingUp size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-serif text-slate-700">No metrics yet</p>
          <p className="text-sm text-slate-500 mt-2">
            Click "Add Metrics" to log your first video performance data.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Top Performers */}
          <section className="mb-8">
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
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: FORMAT_COLORS[p.format] ?? "#94a3b8" }}
                              />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Performance by Format */}
            {formats.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                  Avg Views by Format
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={formats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="format"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickFormatter={(f: string) => FORMATS[f as keyof typeof FORMATS]?.shortName ?? f}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                      formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Avg Views"]}
                    />
                    <Bar dataKey="avgViews" radius={[6, 6, 0, 0]}>
                      {formats.map((entry) => (
                        <Cell key={entry.format} fill={FORMAT_COLORS[entry.format] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>
            )}

            {/* Platform Distribution */}
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
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                      formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), "Views"]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
                    />
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
                  <XAxis
                    dataKey="format"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(f: string) => FORMATS[f as keyof typeof FORMATS]?.shortName ?? f}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0}%`, name === "engagementRate" ? "Engagement Rate" : "Save Rate"]}
                  />
                  <Bar dataKey="engagementRate" fill="#0d9488" name="engagementRate" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saveRate" fill="#7c3aed" name="saveRate" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}
    </div>
  );
};
