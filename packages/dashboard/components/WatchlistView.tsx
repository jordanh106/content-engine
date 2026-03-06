import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Users, ExternalLink, ChevronDown, ChevronUp, Radar, Sparkles, TrendingUp, UserPlus, RefreshCw, Plus, Check, Trash2, X, Loader2, BarChart3, ArrowUp, ArrowDown } from "lucide-react";
import type { WatchlistCreator, CreatorInsight, RisingCreator, WatchlistIntelIdea, IdeaCategory, BenchmarkComparison, ChannelSnapshot } from "../shared/types.js";
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

export const WatchlistView: React.FC = () => {
  const { data, isLoading } = useQuery<WatchlistResponse>({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
  });

  const { data: intelData } = useQuery<IntelResponse>({
    queryKey: ["watchlist-intel"],
    queryFn: () => fetch("/api/watchlist-intel/latest").then((r) => r.json()),
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

  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLogMetrics, setShowLogMetrics] = useState<string | null>(null);
  const [benchmarkExpanded, setBenchmarkExpanded] = useState(false);
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

  const addCreatorMutation = useMutation({
    mutationFn: async (body: WatchlistCreator & { section?: string }) => {
      const r = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Failed to add"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setShowAddForm(false);
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
                  <p className="text-sm font-bold text-teal-800">Your Channel</p>
                  <button
                    onClick={() => setShowLogMetrics("@collective_family")}
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
              {creators.length > 0 && (
                <button
                  onClick={() => {
                    const handle = creators[0]?.handle;
                    if (handle) setShowLogMetrics(handle);
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                >
                  Log Competitor Metrics
                </button>
              )}
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
};

const CreatorCard: React.FC<CreatorCardProps> = ({ creator, isExpanded, onToggle, onDelete, isDeleting }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const cleanHandle = creator.handle.replace("@", "").toLowerCase();

  const analyzeMutation = useMutation({
    mutationFn: async (handle: string) => {
      const clean = handle.replace("@", "").toLowerCase();
      const r = await fetch(`/api/creator-analysis/${clean}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const platformColor = PLATFORM_COLORS[creator.platform] ?? "bg-slate-200 text-slate-700";
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
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${platformColor}`}>
          {creator.platform}
        </span>
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
            onClick={() => analyzeMutation.mutate(creator.handle)}
            disabled={analyzeMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all",
              analyzeMutation.isPending
                ? "bg-violet-100 text-violet-500"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            {analyzeMutation.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Radar size={12} /> Analyze</>
            )}
          </button>
          {analyzeMutation.isError && (
            <span className="text-[10px] text-rose-500">{(analyzeMutation.error as Error)?.message}</span>
          )}
          {creator.hasInsight && (
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? "Hide" : "View"} Analysis
            </button>
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
