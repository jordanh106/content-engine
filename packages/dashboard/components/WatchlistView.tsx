import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Users, ExternalLink, ChevronDown, ChevronUp, Radar, Sparkles, TrendingUp, UserPlus, RefreshCw, Plus, Check, Trash2, X, Loader2, BarChart3, ArrowUp, ArrowDown, Video, Search, Zap, Bookmark, ArrowRight, Dna, Link, Palette, Music, Film, Copy } from "lucide-react";
import type { WatchlistCreator, CreatorInsight, RisingCreator, WatchlistIntelIdea, IdeaCategory, BenchmarkComparison, ChannelSnapshot, CreatorVideo, DashboardView, VideoBreakdown } from "../shared/types.js";
import { SkillButton } from "./ui/SkillButton.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP } from "../shared/help-content.js";

function getCreatorProfileUrl(handle: string, platform: string): string {
  const cleanHandle = handle.replace(/^@/, "");
  const primaryPlatform = platform.split(",")[0].trim().toLowerCase();
  if (primaryPlatform.includes("tiktok")) return `https://tiktok.com/@${cleanHandle}`;
  if (primaryPlatform.includes("youtube")) return `https://youtube.com/@${cleanHandle}`;
  if (primaryPlatform.includes("instagram")) return `https://instagram.com/${cleanHandle}`;
  if (primaryPlatform.includes("twitter") || primaryPlatform === "x") return `https://x.com/${cleanHandle}`;
  return `https://www.google.com/search?q=${encodeURIComponent(handle)}+${encodeURIComponent(platform)}`;
}

type EnrichedCreator = WatchlistCreator & { hasInsight?: boolean };
type WatchlistResponse = { creators: EnrichedCreator[]; total: number; sections?: string[] };
type IntelResponse = {
  date: string | null;
  ideas: WatchlistIntelIdea[];
  risingCreators: RisingCreator[];
  selfImprovementNotes: { bestQueries: string[]; mostActionableCreators: string[]; nextScanFocus: string } | null;
  previousTopics: string[];
};

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-slate-900 text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  YouTube: "bg-red-600 text-white",
  Twitter: "bg-sky-500 text-white",
  X: "bg-slate-900 text-white",
};

const RELEVANT_PLATFORMS = new Set(["instagram", "tiktok", "youtube", "x", "twitter"]);

function parsePlatforms(raw: string): string[] {
  return raw
    .split(",")
    .map((p) => p.replace(/\(primary\)/i, "").replace(/x\/twitter/i, "X").trim())
    .filter((p) => p && RELEVANT_PLATFORMS.has(p.toLowerCase()))
    .filter((v, i, a) => a.indexOf(v) === i);
}

// ============================
// Competitor Content Gaps
// ============================

type GapData = {
  blueOcean: Array<{ topic: string; creators: string[]; count: number }>;
  overlap: Array<{ topic: string; creators: string[]; count: number }>;
  uniqueToYou: number;
  totalCompetitorTopics: number;
};

type CompetitorGapsProps = {
  onAddIdea: (topic: string) => void;
  addedTopic: string | null;
};

const CompetitorGaps: React.FC<CompetitorGapsProps> = ({ onAddIdea, addedTopic }) => {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<GapData>({
    queryKey: ["competitor-gaps"],
    queryFn: () => fetch("/api/creator-videos/competitor-gaps").then((r) => r.json()),
  });

  if (!data || (data.blueOcean.length === 0 && data.overlap.length === 0)) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-500 mb-2 px-1 hover:text-sky-700 transition-colors"
      >
        <Zap size={12} />
        Blue Ocean Topics ({data.blueOcean.length})
        <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-sky-700">
              Topics your competitors cover that you don't — content gaps you could own.
            </p>
            <p className="text-[10px] text-sky-500 mt-1">
              Based on {data.totalCompetitorTopics} analyzed competitor video{data.totalCompetitorTopics !== 1 ? "s" : ""}.
              {data.totalCompetitorTopics < 10 && (
                <span className="ml-1">Analyze more creator videos in the Videos tab to surface better opportunities.</span>
              )}
            </p>
          </div>
          {data.blueOcean.length > 0 ? (
            <div className="space-y-2">
              {data.blueOcean.slice(0, 10).map((gap, i) => (
                <div key={i} className="bg-white border border-sky-100 rounded-lg p-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{gap.topic}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Covered by: {gap.creators.slice(0, 3).map((c) => `@${c}`).join(", ")}
                      {gap.count > 1 && ` (${gap.count} videos)`}
                    </p>
                  </div>
                  <button
                    onClick={() => onAddIdea(gap.topic)}
                    className={cn(
                      "shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
                      addedTopic === gap.topic
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-teal-50 text-teal-700 hover:bg-teal-100",
                    )}
                  >
                    {addedTopic === gap.topic ? (
                      <><Check size={10} /> Added</>
                    ) : (
                      <><Plus size={10} /> Add to Ideas</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sky-600">No gaps detected. Analyze more creators to discover opportunities.</p>
          )}
          {data.overlap.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold text-slate-500 mb-1">Topics you both cover ({data.overlap.length}):</p>
              <div className="flex flex-wrap gap-1">
                {data.overlap.slice(0, 8).map((o, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{o.topic}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type WatchlistViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const WatchlistView: React.FC<WatchlistViewProps> = ({ onNavigate }) => {
  const { data, isLoading } = useQuery<WatchlistResponse>({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
  });

  const { data: intelData } = useQuery<IntelResponse>({
    queryKey: ["watchlist-intel"],
    queryFn: () => fetch("/api/watchlist-intel/latest").then((r) => r.json()),
  });

  type Outlier = { id: number; creatorHandle: string; platform: string; title: string; views: number; medianViews: number; multiplier: number; url: string | null; hasBreakdown: boolean };
  const { data: outliersData } = useQuery<{ outliers: Outlier[] }>({
    queryKey: ["creator-outliers"],
    queryFn: () => fetch("/api/creator-videos/outliers").then((r) => r.json()),
  });

  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/watchlist-intel/sync-n8n", { method: "POST" });
      if (!r.ok) {
        const body = await r.text();
        try { const json = JSON.parse(body); throw new Error(json.error || `Sync failed: ${r.status}`); } catch (e) { if (e instanceof SyntaxError) throw new Error(`Server error: ${r.status}`); throw e; }
      }
      return r.json();
    },
    onSuccess: (data) => {
      if (data?.synced) {
        queryClient.invalidateQueries({ queryKey: ["watchlist-intel"] });
        queryClient.invalidateQueries({ queryKey: ["ideas"] });
      }
      setTimeout(() => syncMutation.reset(), 5000);
    },
    onError: () => {
      setTimeout(() => syncMutation.reset(), 5000);
    },
  });

  const [addedIdea, setAddedIdea] = useState<string | null>(null);
  const addIdeaMutation = useMutation({
    mutationFn: async (idea: WatchlistIntelIdea) => {
      const r = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: idea.topic,
            suggestedFormat: idea.suggestedFormat,
            hookAngle: idea.hookAngle,
            priority: idea.priority,
            source: idea.source || "Watchlist Intelligence",
            category: (idea.category || "competitor") as IdeaCategory,
          }],
        }),
      });
      if (!r.ok) throw new Error("Failed to add idea");
      return r.json();
    },
    onSuccess: (_data, idea) => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      setAddedIdea(idea.topic);
      setTimeout(() => setAddedIdea(null), 2000);
    },
  });

  const [watchlistTab, setWatchlistTab] = useState<"creators" | "videos">("creators");
  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLogMetrics, setShowLogMetrics] = useState<string | null>(null);
  const [benchmarkExpanded, setBenchmarkExpanded] = useState(false);
  const [enrichingHandle, setEnrichingHandle] = useState<string | null>(null);
  const creators = data?.creators ?? [];
  const sections = data?.sections ?? [];

  // Benchmarking data
  const { data: benchmarkData } = useQuery<BenchmarkComparison>({
    queryKey: ["benchmarking-compare"],
    queryFn: () => fetch("/api/benchmarking/compare").then((r) => r.json()),
  });

  const logSnapshotMutation = useMutation({
    mutationFn: async (body: { handle: string; platform: string; followers?: number; avgViews?: number; engagementRateBps?: number; postsPerWeek?: number }) => {
      const r = await fetch("/api/benchmarking/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to log snapshot");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmarking-compare"] });
      setShowLogMetrics(null);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/benchmarking/analyze", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!r.ok) { const d = await r.json().catch(() => ({ error: `Error: ${r.status}` })); throw new Error(d.error || "Analysis failed"); }
      return r.json();
    },
  });

  const [analysisResult, setAnalysisResult] = useState<{ strengths: string[]; gaps: string[]; opportunities: string[]; summary: string } | null>(null);

  const enrichMutation = useMutation({
    mutationFn: async (handle: string) => {
      const clean = handle.replace("@", "").toLowerCase();
      const r = await fetch(`/api/creator-analysis/${clean}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180_000),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: `Server error: ${r.status}` }));
        throw new Error(d.error || "Enrichment failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setEnrichingHandle(null);
    },
    onError: () => {
      setEnrichingHandle(null);
    },
  });

  const addCreatorMutation = useMutation({
    mutationFn: async (body: WatchlistCreator & { section?: string }) => {
      const r = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Failed to add"); }
      return r.json() as Promise<{ added: boolean; handle: string }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setShowAddForm(false);
      // Auto-enrich the new creator
      const handle = result.handle;
      setEnrichingHandle(handle);
      enrichMutation.mutate(handle);
    },
  });

  const deleteCreatorMutation = useMutation({
    mutationFn: async (handle: string) => {
      const clean = handle.replace("@", "").toLowerCase();
      const r = await fetch(`/api/watchlist/${clean}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye size={20} className="text-violet-500" />
            <h2 className="text-lg font-serif font-bold text-slate-900">Creator Watchlist</h2>
          </div>
          <p className="text-sm text-slate-500">
            Track competitors and inspiration creators. Analyze their patterns directly from here.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={12} />
          Add Creator
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setWatchlistTab("creators")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors",
            watchlistTab === "creators"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Users size={14} />
          Creators
        </button>
        <button
          onClick={() => setWatchlistTab("videos")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors",
            watchlistTab === "videos"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Video size={14} />
          Videos
        </button>
      </div>

      {watchlistTab === "creators" && (<>
      {/* Add Creator Form */}
      {showAddForm && (
        <AddCreatorForm
          sections={sections}
          onSubmit={(data) => addCreatorMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isPending={addCreatorMutation.isPending}
          error={addCreatorMutation.isError ? (addCreatorMutation.error as Error).message : null}
        />
      )}

      {/* Benchmarking Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <button
          onClick={() => setBenchmarkExpanded(!benchmarkExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-teal-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Competitive Benchmarking
            </p>
          </div>
          {benchmarkExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {benchmarkExpanded && (
          <div className="mt-4 space-y-4">
            {/* Your Channel */}
            {benchmarkData && (
              <div className="border border-teal-200 bg-teal-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-teal-800">Your Channel</p>
                    <p className="text-[10px] font-medium text-teal-600">@collectivechiro</p>
                  </div>
                  <button
                    onClick={() => setShowLogMetrics("@collectivechiro")}
                    className="text-[10px] font-bold text-teal-600 hover:text-teal-800"
                  >
                    Log Snapshot
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-teal-600 uppercase">Avg Views</p>
                    <p className="text-lg font-bold text-teal-900">{benchmarkData.yourMetrics.avgViews.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-teal-600 uppercase">Engagement</p>
                    <p className="text-lg font-bold text-teal-900">{(benchmarkData.yourMetrics.avgEngagementRate / 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-teal-600 uppercase">Save Rate</p>
                    <p className="text-lg font-bold text-teal-900">{(benchmarkData.yourMetrics.avgSaveRate / 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-teal-600 uppercase">Published</p>
                    <p className="text-lg font-bold text-teal-900">{benchmarkData.yourMetrics.totalPublished}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Competitor comparison */}
            {benchmarkData?.competitors && benchmarkData.competitors.length > 0 && (
              <div className="space-y-2">
                {benchmarkData.competitors.map((comp) => (
                  <div key={comp.handle} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">{comp.handle}</p>
                      <p className="text-[10px] text-slate-400">{comp.platform}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {comp.latestSnapshot.followers && (
                        <span className="text-slate-600">{comp.latestSnapshot.followers.toLocaleString()} followers</span>
                      )}
                      {comp.latestSnapshot.engagementRateBps && (
                        <span className="text-slate-600">{(comp.latestSnapshot.engagementRateBps / 100).toFixed(1)}% eng.</span>
                      )}
                      <span className={cn(
                        "flex items-center gap-0.5 text-[10px] font-bold",
                        comp.trend === "growing" ? "text-emerald-600" :
                        comp.trend === "declining" ? "text-rose-600" :
                        "text-slate-400",
                      )}>
                        {comp.trend === "growing" && <ArrowUp size={10} />}
                        {comp.trend === "declining" && <ArrowDown size={10} />}
                        {comp.trend}
                      </span>
                      <button
                        onClick={() => setShowLogMetrics(comp.handle)}
                        className="text-[10px] font-bold text-slate-400 hover:text-teal-600 transition-colors"
                      >
                        Log
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Log metrics modal */}
            {showLogMetrics && (
              <LogMetricsForm
                handle={showLogMetrics}
                onSubmit={(body) => logSnapshotMutation.mutate(body)}
                onCancel={() => setShowLogMetrics(null)}
                isPending={logSnapshotMutation.isPending}
              />
            )}

            {/* Analyze button */}
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  const result = await analyzeMutation.mutateAsync();
                  setAnalysisResult(result);
                }}
                disabled={analyzeMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {analyzeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {analyzeMutation.isPending ? "Analyzing..." : "Analyze Position"}
              </button>
            </div>

            {/* AI Analysis results */}
            {analysisResult && (
              <div className="space-y-3 mt-3">
                <p className="text-sm text-slate-600">{analysisResult.summary}</p>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Strengths</p>
                    {analysisResult.strengths.map((s, i) => (
                      <p key={i} className="text-xs text-emerald-800 mb-1">- {s}</p>
                    ))}
                  </div>
                  <div className="border border-rose-200 bg-rose-50 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-2">Gaps</p>
                    {analysisResult.gaps.map((g, i) => (
                      <p key={i} className="text-xs text-rose-800 mb-1">- {g}</p>
                    ))}
                  </div>
                  <div className="border border-violet-200 bg-violet-50 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-2">Opportunities</p>
                    {analysisResult.opportunities.map((o, i) => (
                      <p key={i} className="text-xs text-violet-800 mb-1">- {o}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {analyzeMutation.isError && (
              <p className="text-xs text-rose-500">{(analyzeMutation.error as Error)?.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Outlier Videos */}
      {outliersData && outliersData.outliers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
              Outlier Videos ({outliersData.outliers.length})
            </p>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Videos that got 3x+ their creator's median views. Study these to find what works.
          </p>
          <div className="space-y-2">
            {outliersData.outliers.slice(0, 5).map((o) => (
              <div key={o.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{o.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">@{o.creatorHandle}</span>
                    <span className="text-[10px] font-bold text-amber-600">{o.multiplier}x median</span>
                    <span className="text-[10px] text-slate-400">{o.views.toLocaleString()} views</span>
                  </div>
                </div>
                {o.url && (
                  <a href={o.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-teal-600 shrink-0">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Content Gaps */}
      <CompetitorGaps
        onAddIdea={(topic) =>
          addIdeaMutation.mutate({
            topic,
            suggestedFormat: null,
            hookAngle: null,
            priority: "medium",
            source: "Blue Ocean / Competitor Gap",
            category: "competitor",
            inspiredBy: null,
            whyNonObvious: null,
            targetAudience: null,
          } as unknown as WatchlistIntelIdea)
        }
        addedTopic={addedIdea}
      />

      {/* Creator Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading watchlist...</div>
      ) : creators.length === 0 ? (
        <EmptyState
          icon={<Eye size={24} className="text-slate-400" />}
          headline="No creators tracked yet"
          description="Add creators to watchlist.md to start tracking their content patterns and strategies."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creators.map((creator) => (
            <CreatorCard
              key={creator.handle}
              creator={creator}
              isExpanded={expandedHandle === creator.handle}
              onToggle={() => setExpandedHandle(expandedHandle === creator.handle ? null : creator.handle)}
              onDelete={() => deleteCreatorMutation.mutate(creator.handle)}
              isDeleting={deleteCreatorMutation.isPending}
              isEnriching={enrichingHandle === creator.handle}
            />
          ))}
        </div>
      )}

      {/* Latest Intelligence */}
      {intelData?.date ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Watchlist Intelligence
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{intelData.date}</span>
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  title="Sync latest report from n8n"
                >
                  <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
                </button>
                {syncMutation.isSuccess && (
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {(syncMutation.data as { wasNew?: boolean })?.wasNew ? "New report synced!" : "Up to date"}
                  </span>
                )}
                {syncMutation.isError && (
                  <span className="text-[10px] text-red-500 font-medium">
                    {(syncMutation.error as Error)?.message || "Sync failed"}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.ideas?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Ideas Found</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.risingCreators?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Rising Creators</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.previousTopics?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Topics Tracked</p>
              </div>
            </div>

            {/* Non-Obvious Ideas */}
            {intelData.ideas?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Non-Obvious Opportunities
                </p>
                <div className="space-y-2">
                  {intelData.ideas.slice(0, 5).map((idea, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{idea.topic}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold",
                            idea.priority === "High" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                          )}>
                            {idea.priority}
                          </span>
                          <button
                            onClick={() => addIdeaMutation.mutate(idea)}
                            disabled={addIdeaMutation.isPending || addedIdea === idea.topic}
                            className={cn(
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors",
                              addedIdea === idea.topic
                                ? "bg-teal-100 text-teal-700"
                                : "bg-teal-50 text-teal-600 hover:bg-teal-100",
                            )}
                            title="Add to Idea Bank"
                          >
                            {addedIdea === idea.topic ? <Check size={10} /> : <Plus size={10} />}
                            {addedIdea === idea.topic ? "Added" : "Ideas"}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{idea.whyNonObvious}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {idea.suggestedFormat && <span className="font-mono">{idea.suggestedFormat}</span>}
                        {idea.inspiredBy && <span>via {idea.inspiredBy}</span>}
                        {idea.targetAudience && <span>{idea.targetAudience}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rising Creators */}
            {intelData.risingCreators?.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Rising Creators
                </p>
                <div className="space-y-2">
                  {intelData.risingCreators.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserPlus size={12} className="text-teal-500" />
                        <span className="text-sm font-medium text-slate-900">{c.handle}</span>
                        <span className="text-[10px] text-slate-400">{c.platform}</span>
                        {c.followers && <span className="text-[10px] text-slate-400">{c.followers}</span>}
                      </div>
                      <span className="text-xs text-slate-500 text-right max-w-[200px] truncate">{c.whyWatch}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Self-Improvement Focus */}
            {intelData.selfImprovementNotes?.nextScanFocus && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={12} className="text-teal-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next Scan Focus</p>
                </div>
                <p className="text-xs text-slate-500">{intelData.selfImprovementNotes.nextScanFocus}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-slate-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Watchlist Intelligence
              </p>
            </div>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
              {syncMutation.isPending ? "Syncing..." : "Sync from n8n"}
            </button>
          </div>
          {syncMutation.isSuccess && (syncMutation.data as { synced: boolean })?.synced === false && (
            <p className="text-xs text-slate-500 mt-2">{(syncMutation.data as { message?: string })?.message || "No data found"}</p>
          )}
          {syncMutation.isError && (
            <p className="text-xs text-rose-500 mt-2">{(syncMutation.error as Error)?.message || "Sync failed. Check n8n connection."}</p>
          )}
          {!syncMutation.isPending && !syncMutation.isSuccess && (
            <p className="text-xs text-slate-400 mt-2">
              Run the Watchlist Intelligence workflow in n8n, then sync to pull the report.
            </p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <SkillButton skill="/competitor-research" args="chiropractic" label="Competitor Research" icon={<Radar size={14} />} />
          <SkillButton skill="/viral-scout" args="chiropractic" label="Viral Scout" icon={<Radar size={14} />} />
        </div>
      </div>
      </>)}

      {watchlistTab === "videos" && (
        <VideosTab creators={creators} />
      )}

      {onNavigate && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("OPPORTUNITIES")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Discover Opportunities</span>
              <span className="block text-xs text-teal-600 mt-0.5">See what's trending in your niche</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.WATCHLIST} />
    </div>
  );
};

type CreatorCardProps = {
  creator: EnrichedCreator;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isEnriching?: boolean;
};

const CreatorCard: React.FC<CreatorCardProps> = ({ creator, isExpanded, onToggle, onDelete, isDeleting, isEnriching }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const cleanHandle = creator.handle.replace("@", "").toLowerCase();

  const analyzeMutation = useMutation({
    mutationFn: async (handle: string) => {
      const clean = handle.replace("@", "").toLowerCase();
      const r = await fetch(`/api/creator-analysis/${clean}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(180_000),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: `Server error: ${r.status}` }));
        throw new Error(d.error || "Analysis failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["creator-insight", cleanHandle] });
      // Auto-expand to show the analysis
      if (!isExpanded) onToggle();
    },
  });

  const platforms = parsePlatforms(creator.platform);
  const isStale = !creator.lastAnalyzed || creator.lastAnalyzed.trim() === "";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <a
            href={getCreatorProfileUrl(creator.handle, creator.platform)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 text-sm flex items-center gap-1.5 hover:text-teal-700 transition-colors"
          >
            {creator.handle}
            <ExternalLink size={12} className="text-slate-400" />
          </a>
          {creator.followers && (
            <p className="text-xs text-slate-500 mt-0.5">{creator.followers} followers</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {platforms.map((p) => (
            <span key={p} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PLATFORM_COLORS[p] ?? "bg-slate-200 text-slate-700"}`}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {creator.whyTracking && (
        <p className="text-xs text-slate-600 mb-2">{creator.whyTracking}</p>
      )}

      <div className="flex flex-wrap gap-2 text-[10px]">
        {creator.contentStyle && (
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {creator.contentStyle}
          </span>
        )}
        {creator.frequency && (
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {creator.frequency}
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            disabled={!creator.hasInsight}
            className={cn(
              "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-all border",
              creator.hasInsight
                ? "border-violet-200 text-violet-600 hover:bg-violet-50"
                : "border-slate-200 text-slate-300 cursor-not-allowed",
            )}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isExpanded ? "Hide" : "View"} Analysis
          </button>
          <button
            onClick={() => analyzeMutation.mutate(creator.handle)}
            disabled={analyzeMutation.isPending || isEnriching}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all",
              (analyzeMutation.isPending || isEnriching)
                ? "bg-violet-100 text-violet-500"
                : creator.hasInsight
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-violet-600 text-white hover:bg-violet-700",
            )}
          >
            {(analyzeMutation.isPending || isEnriching) ? (
              <><Loader2 size={12} className="animate-spin" /> {isEnriching ? "Enriching..." : "Analyzing..."}</>
            ) : (
              <><Radar size={12} /> {creator.hasInsight ? "Re-analyze" : "Analyze"}</>
            )}
          </button>
          {analyzeMutation.isError && (
            <span className="text-[10px] text-rose-500">{(analyzeMutation.error as Error)?.message}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className={cn("text-xs", isStale ? "text-amber-500 font-medium" : "text-slate-500")}>
            {isStale ? "Never analyzed" : creator.lastAnalyzed}
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                disabled={isDeleting}
                className="text-[9px] font-bold text-rose-600 hover:text-rose-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[9px] font-bold text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-slate-300 hover:text-rose-500 transition-colors"
              title="Remove creator"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Insight Panel */}
      {isExpanded && creator.hasInsight && (
        <CreatorInsightPanel handle={creator.handle} />
      )}
    </div>
  );
};

type AddCreatorFormProps = {
  sections: string[];
  onSubmit: (data: WatchlistCreator & { section?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
};

const AddCreatorForm: React.FC<AddCreatorFormProps> = ({ sections, onSubmit, onCancel, isPending, error }) => {
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [followers, setFollowers] = useState("");
  const [whyTracking, setWhyTracking] = useState("");
  const [contentStyle, setContentStyle] = useState("");
  const [frequency, setFrequency] = useState("");
  const [section, setSection] = useState(sections[0] || "");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Add Creator</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Handle *</label>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@creator_handle"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Platform *</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white"
          >
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>TikTok, Instagram</option>
            <option>TikTok, IG</option>
            <option>X</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Followers</label>
          <input
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            placeholder="e.g. ~50K"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Section</label>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white"
          >
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Why Tracking</label>
          <input
            value={whyTracking}
            onChange={(e) => setWhyTracking(e.target.value)}
            placeholder="What makes this creator worth watching?"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Content Style</label>
          <input
            value={contentStyle}
            onChange={(e) => setContentStyle(e.target.value)}
            placeholder="e.g. Educational, humor-driven"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Frequency</label>
          <input
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="e.g. 3-4x/week"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit({
            handle: handle.startsWith("@") ? handle : `@${handle}`,
            platform,
            followers,
            whyTracking,
            contentStyle,
            frequency,
            lastAnalyzed: "-",
            section: section || undefined,
          })}
          disabled={isPending || !handle.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add to Watchlist
        </button>
      </div>
    </div>
  );
};

type LogMetricsFormProps = {
  handle: string;
  onSubmit: (body: { handle: string; platform: string; followers?: number; avgViews?: number; engagementRateBps?: number; postsPerWeek?: number }) => void;
  onCancel: () => void;
  isPending: boolean;
};

const LogMetricsForm: React.FC<LogMetricsFormProps> = ({ handle, onSubmit, onCancel, isPending }) => {
  const [platform, setPlatform] = useState("Instagram");
  const [followers, setFollowers] = useState("");
  const [avgViews, setAvgViews] = useState("");
  const [engRate, setEngRate] = useState("");
  const [postsPerWeek, setPostsPerWeek] = useState("");

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-700">Log Metrics: {handle}</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
            <option>Instagram</option>
            <option>TikTok</option>
            <option>YouTube</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Followers</label>
          <input value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="50000" type="number" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Avg Views</label>
          <input value={avgViews} onChange={(e) => setAvgViews(e.target.value)} placeholder="5000" type="number" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Posts/Week</label>
          <input value={postsPerWeek} onChange={(e) => setPostsPerWeek(e.target.value)} placeholder="4" type="number" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-700">Cancel</button>
        <button
          onClick={() => onSubmit({
            handle,
            platform,
            followers: followers ? parseInt(followers) : undefined,
            avgViews: avgViews ? parseInt(avgViews) : undefined,
            postsPerWeek: postsPerWeek ? parseInt(postsPerWeek) : undefined,
          })}
          disabled={isPending}
          className="px-3 py-1.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
};

const CreatorInsightPanel: React.FC<{ handle: string }> = ({ handle }) => {
  const cleanHandle = handle.replace("@", "").toLowerCase();
  const { data, isLoading } = useQuery<{ available: boolean; insight: CreatorInsight | null }>({
    queryKey: ["creator-insight", cleanHandle],
    queryFn: () => fetch(`/api/watchlist/${cleanHandle}/insights`).then((r) => r.json()),
  });

  if (isLoading) return <div className="mt-3 text-xs text-slate-400">Loading analysis...</div>;
  if (!data?.insight) return null;

  const insight = data.insight;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {insight.keyTakeaways.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Key Takeaways</p>
          <ul className="space-y-1">
            {insight.keyTakeaways.map((t, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                <span className="text-teal-500 mt-0.5">-</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight.contentPatterns.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Content Patterns</p>
          <div className="flex flex-wrap gap-1">
            {insight.contentPatterns.slice(0, 6).map((p, i) => (
              <span key={i} className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      )}

      {insight.hookStyles.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Hook Styles</p>
          <div className="flex flex-wrap gap-1">
            {insight.hookStyles.slice(0, 6).map((h, i) => (
              <span key={i} className="bg-violet-50 text-violet-700 text-[10px] px-2 py-0.5 rounded-full">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Videos Tab ──────────────────────────────────────────────────────────────

type VideosTabProps = { creators: EnrichedCreator[] };

const VideosTab: React.FC<VideosTabProps> = ({ creators }) => {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("all");
  const [minOutlier, setMinOutlier] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"outlierScore" | "views" | "publishedAt">("outlierScore");
  const [searchHandle, setSearchHandle] = useState("");
  const [expandedVideo, setExpandedVideo] = useState<number | null>(null);
  const [analyzeUrlOpen, setAnalyzeUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlResult, setUrlResult] = useState<{ breakdown: VideoBreakdown; videoTitle: string; frameCount: number; hasTranscript: boolean } | null>(null);

  const params = new URLSearchParams();
  if (searchHandle) params.set("handle", searchHandle);
  if (minOutlier > 0) params.set("minOutlierScore", String(minOutlier));
  if (dateRange !== "all") {
    const d = new Date();
    if (dateRange === "7d") d.setDate(d.getDate() - 7);
    else if (dateRange === "30d") d.setDate(d.getDate() - 30);
    else if (dateRange === "90d") d.setDate(d.getDate() - 90);
    params.set("dateFrom", d.toISOString().split("T")[0]);
  }
  params.set("sort", sortBy);

  const { data, isLoading } = useQuery<{ videos: CreatorVideo[]; total: number }>({
    queryKey: ["creator-videos", searchHandle, minOutlier, dateRange, sortBy],
    queryFn: () => fetch(`/api/creator-videos?${params}`).then((r) => r.json()),
  });

  const scanMutation = useMutation({
    mutationFn: async ({ handle, platform }: { handle: string; platform: string }) => {
      const clean = handle.replace(/^@/, "");
      const r = await fetch(`/api/creator-videos/scan/${clean}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.split(",")[0].trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: `Error ${r.status}` }));
        throw new Error(d.error || "Scan failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-videos"] });
    },
  });

  const analyzeUrlMutation = useMutation({
    mutationFn: async (videoUrl: string) => {
      const r = await fetch("/api/creator-videos/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl, save: true }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error || "Analysis failed");
      }
      return r.json();
    },
    onSuccess: (data) => {
      setUrlResult(data);
    },
  });

  const videos = data?.videos ?? [];

  return (
    <div className="space-y-4">
      {/* Analyze URL */}
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-4">
        <button
          onClick={() => { setAnalyzeUrlOpen(!analyzeUrlOpen); setUrlResult(null); }}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 hover:text-purple-700"
        >
          <Link size={12} />
          Analyze Any Video URL
          <ChevronDown size={12} className={cn("transition-transform", analyzeUrlOpen && "rotate-180")} />
        </button>
        {analyzeUrlOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube, Instagram, or TikTok URL..."
                className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm text-slate-700 focus:outline-none focus:border-purple-400 bg-white"
              />
              <button
                onClick={() => { if (urlInput.trim()) analyzeUrlMutation.mutate(urlInput.trim()); }}
                disabled={analyzeUrlMutation.isPending || !urlInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {analyzeUrlMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Dna size={12} />}
                {analyzeUrlMutation.isPending ? "Analyzing..." : "Deep Analyze"}
              </button>
            </div>
            {analyzeUrlMutation.isPending && (
              <p className="text-xs text-purple-500">Downloading video, extracting frames, transcribing audio, and analyzing with AI. This may take 1-3 minutes...</p>
            )}
            {analyzeUrlMutation.isError && (
              <p className="text-xs text-rose-500">{(analyzeUrlMutation.error as Error).message}</p>
            )}
            {urlResult && (
              <div className="bg-white border border-purple-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{urlResult.videoTitle}</p>
                  <span className="text-[9px] font-bold text-purple-500">
                    {urlResult.frameCount} frames | {urlResult.hasTranscript ? "Transcribed" : "No transcript"}
                  </span>
                </div>
                <DnaDisplay breakdown={urlResult.breakdown as VideoBreakdown} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan creators */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Scan Creator Videos
        </p>
        <div className="flex flex-wrap gap-2">
          {creators.map((c) => (
            <button
              key={c.handle}
              onClick={() => scanMutation.mutate({ handle: c.handle, platform: c.platform })}
              disabled={scanMutation.isPending}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors",
                scanMutation.isPending && scanMutation.variables?.handle === c.handle
                  ? "bg-violet-100 text-violet-500"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {scanMutation.isPending && scanMutation.variables?.handle === c.handle
                ? <Loader2 size={10} className="animate-spin" />
                : <Zap size={10} />}
              {c.handle}
            </button>
          ))}
        </div>
        {scanMutation.isSuccess && (
          <p className="text-xs text-teal-600 mt-2">
            Scanned {(scanMutation.data as { handle: string }).handle}: {(scanMutation.data as { videosFound: number }).videosFound} videos found
          </p>
        )}
        {scanMutation.isError && (
          <p className="text-xs text-rose-500 mt-2">{(scanMutation.error as Error).message}</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["all", "7d", "30d", "90d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors",
                dateRange === range
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {range === "all" ? "All" : range}
            </button>
          ))}
        </div>

        <select
          value={minOutlier}
          onChange={(e) => setMinOutlier(parseInt(e.target.value))}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 bg-white"
        >
          <option value={0}>All Scores</option>
          <option value={100}>1x+</option>
          <option value={150}>1.5x+</option>
          <option value={200}>2x+</option>
          <option value={300}>3x+</option>
          <option value={500}>5x+</option>
          <option value={1000}>10x+</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "outlierScore" | "views" | "publishedAt")}
          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 bg-white"
        >
          <option value="outlierScore">Outlier Score</option>
          <option value="views">Views</option>
          <option value="publishedAt">Recent</option>
        </select>

        <div className="relative flex-1 min-w-[120px] max-w-[200px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchHandle}
            onChange={(e) => setSearchHandle(e.target.value)}
            placeholder="Filter by handle..."
            className="w-full pl-7 pr-2 py-1 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-600 focus:outline-none focus:border-teal-400"
          />
        </div>
      </div>

      {/* Video grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading videos...</div>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Video size={24} className="text-slate-400" />}
          headline="No videos tracked yet"
          description="Use the Scan buttons above to find recent videos from your watchlist creators."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{videos.length} video{videos.length !== 1 ? "s" : ""} found</p>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isExpanded={expandedVideo === video.id}
              onToggle={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Video Card ──────────────────────────────────────────────────────────────

type VideoCardProps = {
  video: CreatorVideo;
  isExpanded: boolean;
  onToggle: () => void;
};

const outlierLabel = (score: number) => `${(score / 100).toFixed(1)}x`;

const outlierColor = (score: number) => {
  if (score >= 300) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 150) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
};

// ─── DNA Display Components ──────────────────────────────────────────────────

function parseJson(val: string | null | undefined): unknown {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

const ColorSwatch: React.FC<{ hex: string; label?: string }> = ({ hex, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(hex); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1.5 group"
      title={`Copy ${hex}`}
    >
      <div className="w-5 h-5 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: hex }} />
      <span className="text-[10px] text-slate-500 group-hover:text-slate-700">
        {copied ? "Copied!" : label || hex}
      </span>
    </button>
  );
};

const DnaDisplay: React.FC<{ breakdown: VideoBreakdown }> = ({ breakdown }) => {
  const [dnaTab, setDnaTab] = useState<"overview" | "style" | "plan">("overview");
  const story = parseJson(breakdown.storyStructure) as Record<string, { description?: string; timestamp?: string }> | null;
  const aesthetics = parseJson(breakdown.aestheticKeywords) as string[] | null;
  const typography = parseJson(breakdown.typographySystem) as Record<string, string> | null;
  const colors = parseJson(breakdown.colorPalette) as Record<string, string> | null;
  const setDesign = parseJson(breakdown.setDesign) as Record<string, unknown> | null;
  const music = parseJson(breakdown.musicAudio) as Record<string, string> | null;
  const transitions = parseJson(breakdown.transitionStyle) as Record<string, unknown> | null;
  const replication = parseJson(breakdown.replicationPlan) as string[] | null;
  const broll = parseJson(breakdown.brollTypes) as Record<string, string[]> | null;

  const hasDeepDna = !!(story || aesthetics || typography || colors || replication);

  if (!hasDeepDna) {
    // Show basic 7-field breakdown
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Topic", value: breakdown.topic },
          { label: "Angle", value: breakdown.angle },
          { label: "Hook Format", value: breakdown.hookFormat },
          { label: "Story Style", value: breakdown.storyStyle },
          { label: "Visual Format", value: breakdown.visualFormat },
          { label: "Visuals", value: breakdown.visuals },
          { label: "Audio", value: breakdown.audio },
        ].filter((i) => i.value).map((item) => (
          <div key={item.label} className="bg-slate-50 rounded-lg p-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="text-xs text-slate-700 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* One-sentence concept banner */}
      {breakdown.oneSentenceConcept && (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-violet-400 mb-1">Core Concept</p>
          <p className="text-sm font-medium text-violet-900">{breakdown.oneSentenceConcept}</p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
        {(["overview", "style", "plan"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDnaTab(tab)}
            className={cn(
              "px-3 py-1 rounded-md text-[10px] font-bold capitalize transition-colors",
              dnaTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {dnaTab === "overview" && (
        <div className="space-y-3">
          {/* Basic 7-field grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Topic", value: breakdown.topic },
              { label: "Angle", value: breakdown.angle },
              { label: "Hook Format", value: breakdown.hookFormat },
              { label: "Story Style", value: breakdown.storyStyle },
              { label: "Visual Format", value: breakdown.visualFormat },
              { label: "Audio", value: breakdown.audio },
            ].filter((i) => i.value).map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="text-xs text-slate-700 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Story Structure Timeline */}
          {story && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Film size={10} /> Story Structure
              </p>
              <div className="flex gap-1">
                {["hook", "conflict", "build", "resolution", "cta"].map((act) => {
                  const actData = story[act];
                  const colors: Record<string, string> = {
                    hook: "bg-rose-100 border-rose-200 text-rose-700",
                    conflict: "bg-amber-100 border-amber-200 text-amber-700",
                    build: "bg-sky-100 border-sky-200 text-sky-700",
                    resolution: "bg-emerald-100 border-emerald-200 text-emerald-700",
                    cta: "bg-violet-100 border-violet-200 text-violet-700",
                  };
                  return (
                    <div key={act} className={cn("flex-1 rounded-lg border p-2", colors[act])}>
                      <p className="text-[8px] font-black uppercase">{act}</p>
                      {actData && (
                        <p className="text-[10px] mt-0.5 opacity-80">
                          {typeof actData === "string" ? actData : actData.description || ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aesthetic keywords */}
          {aesthetics && aesthetics.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Aesthetic Keywords</p>
              <div className="flex flex-wrap gap-1">
                {aesthetics.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-200">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* B-Roll Types */}
          {broll && (
            <div className="grid grid-cols-3 gap-2">
              {(["macro", "process", "reveal"] as const).map((type) => {
                const items = broll[type];
                if (!items || !Array.isArray(items) || items.length === 0) return null;
                return (
                  <div key={type} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{type} B-Roll</p>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((item, i) => (
                        <p key={i} className="text-[10px] text-slate-600">{item}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Style tab */}
      {dnaTab === "style" && (
        <div className="space-y-3">
          {/* Color Palette */}
          {colors && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Palette size={10} /> Color Palette
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(colors).filter(([, v]) => v && v.startsWith("#")).map(([key, hex]) => (
                  <ColorSwatch key={key} hex={hex} label={`${key}: ${hex}`} />
                ))}
              </div>
              {colors.mood && (
                <p className="text-[10px] text-slate-500 mt-1.5">Mood: {colors.mood}</p>
              )}
              {colors.grading && (
                <p className="text-[10px] text-slate-500">Grading: {colors.grading}</p>
              )}
            </div>
          )}

          {/* Typography */}
          {typography && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Typography</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(typography).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[8px] font-bold uppercase text-slate-400">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-[10px] text-slate-700 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Music/Audio */}
          {music && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Music size={10} /> Music & Audio
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(music).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[8px] font-bold uppercase text-slate-400">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-[10px] text-slate-700 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Set Design */}
          {setDesign && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Set Design</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(setDesign).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[8px] font-bold uppercase text-slate-400">{key}</p>
                    <p className="text-[10px] text-slate-700 mt-0.5">
                      {Array.isArray(val) ? val.join(", ") : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transitions */}
          {transitions && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Transitions</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(transitions).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[8px] font-bold uppercase text-slate-400">{key}</p>
                    <p className="text-[10px] text-slate-700 mt-0.5">
                      {Array.isArray(val) ? val.join(", ") : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan tab */}
      {dnaTab === "plan" && (
        <div className="space-y-3">
          {replication && replication.length > 0 ? (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Replication Plan</p>
              <div className="space-y-1.5">
                {replication.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-xs text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No replication plan available. Run Deep Analyze to generate one.</p>
          )}
        </div>
      )}
    </div>
  );
};

const VideoCard: React.FC<VideoCardProps> = ({ video, isExpanded, onToggle }) => {
  const queryClient = useQueryClient();
  const platformColor = PLATFORM_COLORS[video.platform] ?? "bg-slate-200 text-slate-700";

  const breakdownQuery = useQuery<{ breakdown: VideoBreakdown | null }>({
    queryKey: ["video-breakdown", video.id],
    queryFn: () => fetch(`/api/creator-videos/${video.id}/breakdown`).then((r) => r.json()),
    enabled: isExpanded,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/creator-videos/${video.id}/breakdown`, { method: "POST" });
      if (!r.ok) throw new Error("Analysis failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-breakdown", video.id] });
    },
  });

  const deepAnalyzeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/creator-videos/${video.id}/deep-breakdown`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Deep analysis failed" }));
        throw new Error(err.error || "Deep analysis failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-breakdown", video.id] });
    },
  });

  const saveHookMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/creator-videos/${video.id}/save-hook`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to save hook");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault-hooks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/creator-videos/${video.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-videos"] });
    },
  });

  const breakdown = breakdownQuery.data?.breakdown ?? null;
  const hasDeepDna = breakdown && (breakdown.storyStructure || breakdown.colorPalette || breakdown.replicationPlan);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Outlier badge */}
        {video.outlierScoreX100 != null && (
          <div className={cn(
            "flex-shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center",
            outlierColor(video.outlierScoreX100),
          )}>
            <span className="text-sm font-black">{outlierLabel(video.outlierScoreX100)}</span>
            <span className="text-[8px] font-bold uppercase">Outlier</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm font-medium text-slate-900 line-clamp-2 flex-1">
              {video.videoTitle || "Untitled Video"}
            </p>
            {hasDeepDna && (
              <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[8px] font-bold">
                <Dna size={8} /> DNA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{video.creatorHandle}</span>
            <span className={`px-1.5 py-0 rounded-full text-[9px] font-bold ${platformColor}`}>
              {video.platform}
            </span>
            {video.publishedAt && (
              <span className="text-[10px] text-slate-400">{video.publishedAt}</span>
            )}
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-500">
            <span>{(video.views || 0).toLocaleString()} views</span>
            {(video.likes ?? 0) > 0 && <span>{(video.likes ?? 0).toLocaleString()} likes</span>}
            {(video.comments ?? 0) > 0 && <span>{(video.comments ?? 0).toLocaleString()} comments</span>}
            {(video.shares ?? 0) > 0 && <span>{(video.shares ?? 0).toLocaleString()} shares</span>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700"
            >
              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {isExpanded ? "Hide" : "Analyze"}
            </button>
            <button
              onClick={() => saveHookMutation.mutate()}
              disabled={saveHookMutation.isPending || !video.videoTitle}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 disabled:opacity-50"
            >
              {saveHookMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Bookmark size={10} />}
              {saveHookMutation.isSuccess ? "Saved!" : "Save Hook"}
            </button>
            {video.videoUrl && (
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600"
              >
                <ExternalLink size={10} />
                View
              </a>
            )}
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="ml-auto text-slate-300 hover:text-rose-500 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded breakdown */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {breakdownQuery.isLoading ? (
            <p className="text-xs text-slate-400">Loading breakdown...</p>
          ) : breakdown ? (
            <DnaDisplay breakdown={breakdown} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-slate-400">No breakdown yet.</p>
              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending || deepAnalyzeMutation.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold hover:bg-violet-100 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {analyzeMutation.isPending ? "Analyzing..." : "Quick Breakdown"}
              </button>
              <button
                onClick={() => deepAnalyzeMutation.mutate()}
                disabled={deepAnalyzeMutation.isPending || analyzeMutation.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold hover:bg-purple-100 disabled:opacity-50"
              >
                {deepAnalyzeMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Dna size={10} />}
                {deepAnalyzeMutation.isPending ? "Deep Analyzing..." : "Deep Analyze"}
              </button>
            </div>
          )}
          {/* Re-analyze button when breakdown exists but no deep DNA */}
          {breakdown && !hasDeepDna && (
            <div className="mt-2">
              <button
                onClick={() => deepAnalyzeMutation.mutate()}
                disabled={deepAnalyzeMutation.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold hover:bg-purple-100 disabled:opacity-50"
              >
                {deepAnalyzeMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Dna size={10} />}
                {deepAnalyzeMutation.isPending ? "Deep Analyzing..." : "Upgrade to Deep DNA"}
              </button>
            </div>
          )}
          {(analyzeMutation.isError || deepAnalyzeMutation.isError) && (
            <p className="text-xs text-rose-500 mt-1">
              {((analyzeMutation.error || deepAnalyzeMutation.error) as Error)?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
