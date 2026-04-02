import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileText,
  Mic,
  Sparkles,
  Film,
  CalendarCheck,
  CircleCheck,
  ArrowRight,
  ChevronRight,
  Trophy,
  Eye,
  Signal,
  Copy,
  Plus,
  Check,
  Flame,
  Activity,
  LayoutGrid,
  TrendingUp,
  Zap,
  Loader2,
  Shuffle,
  RefreshCw,
  Settings,
  X,
  UserPlus,
} from "lucide-react";
import type {
  PipelineResponse,
  ProductionStatus,
  DashboardView,
  OpportunitiesResponse,
  IntelDigest,
  CreatorVideo,
  CarouselRemixSeed,
} from "../shared/types.js";
import { VideoThumbnailCard } from "./ui/VideoThumbnailCard.js";
import { ScrollReveal, CountUp } from "./ui/animations.js";
import { Sparkline } from "./ui/Sparkline.js";
import { MetricBadge } from "./ui/MetricBadge.js";
import { CreatorLevelBadge } from "./ui/CreatorLevelBadge.js";
import { QuestChain } from "./ui/QuestChain.js";
import { GoalRing } from "./ui/GoalRing.js";

type DashboardHomeProps = {
  onSelectVideo: (code: string) => void;
  onNavigate: (view: DashboardView) => void;
};

type WhatsNextAction = {
  headline: string;
  description: string;
  cta: string;
  target: DashboardView;
  gradient: string;
  borderColor: string;
};

const STATUS_ICONS: Record<ProductionStatus, React.ReactNode> = {
  SCRIPTED: <FileText size={16} />,
  RECORDING: <Mic size={16} />,
  GENERATING: <Sparkles size={16} />,
  ASSEMBLED: <Film size={16} />,
  SCHEDULED: <CalendarCheck size={16} />,
  PUBLISHED: <CircleCheck size={16} />,
};

const STATUS_COLORS: Record<ProductionStatus, { bg: string; text: string; ring: string }> = {
  SCRIPTED: { bg: "bg-slate-100", text: "text-themed-secondary", ring: "ring-slate-300" },
  RECORDING: { bg: "bg-amber-100", text: "text-amber-600", ring: "ring-amber-300" },
  GENERATING: { bg: "bg-sky-100", text: "text-sky-600", ring: "ring-sky-300" },
  ASSEMBLED: { bg: "bg-teal-100", text: "text-teal-600", ring: "ring-teal-300" },
  SCHEDULED: { bg: "bg-violet-100", text: "text-violet-600", ring: "ring-violet-300" },
  PUBLISHED: { bg: "bg-emerald-100", text: "text-emerald-600", ring: "ring-emerald-300" },
};

const STATUS_NAV: Record<ProductionStatus, DashboardView> = {
  SCRIPTED: "LIBRARY",
  RECORDING: "SESSION",
  GENERATING: "PIPELINE",
  ASSEMBLED: "PIPELINE",
  SCHEDULED: "CALENDAR",
  PUBLISHED: "METRICS",
};

function getGreeting(): { text: string; date: string } {
  const now = new Date();
  const hour = now.getHours();
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const text = hour >= 5 && hour < 12
    ? "Good morning, Jordan"
    : hour >= 12 && hour < 17
    ? "Good afternoon, Jordan"
    : "Good evening, Jordan";
  return { text, date };
}

function getBottleneckAdvice(status: ProductionStatus, count: number): string {
  switch (status) {
    case "SCRIPTED": return count >= 5 ? " \u2014 pick 5 for a recording session" : "";
    case "RECORDING": return " \u2014 finish recordings to advance";
    case "GENERATING": return " \u2014 renders in progress";
    case "ASSEMBLED": return " \u2014 schedule to keep your cadence";
    case "SCHEDULED": return " \u2014 ready to publish";
    default: return "";
  }
}

function determineWhatsNext(
  pipeline: PipelineResponse | undefined,
  opportunities: OpportunitiesResponse | undefined,
  daysSinceLastPublish: number | null,
): WhatsNextAction {
  const staleWarnings = opportunities?.staleWarnings ?? [];
  const hasOpps = (opportunities?.opportunities?.length ?? 0) > 0;
  const hasStaleData = staleWarnings.length > 0 && hasOpps;

  if (!pipeline) {
    return {
      headline: "Discover new opportunities",
      description: "Analyze trending topics and audience signals to find your highest-value content ideas.",
      cta: "Generate Opportunities",
      target: "OPPORTUNITIES",
      gradient: "from-teal-50 to-sky-50",
      borderColor: "border-teal-200",
    };
  }

  // Recovery mode: no publish in 14+ days
  if (daysSinceLastPublish !== null && daysSinceLastPublish >= 14) {
    const scripted = pipeline.summary.SCRIPTED ?? 0;
    const assembled = pipeline.summary.ASSEMBLED ?? 0;

    let recoveryNote = "Start with one quick win to rebuild your momentum.";
    let recoveryCta = "View Pipeline";
    let recoveryTarget: DashboardView = "PIPELINE";

    if (assembled > 0) {
      recoveryNote = `${assembled} assembled video${assembled > 1 ? "s" : ""} just need scheduling. Fastest path back.`;
      recoveryCta = "Schedule Videos";
      recoveryTarget = "CALENDAR";
    } else if (scripted > 0) {
      recoveryNote = `${scripted} scripts are ready to record. Pick one audience category and do a quick session.`;
      recoveryCta = "Start Session";
      recoveryTarget = "SESSION";
    }

    return {
      headline: `It's been ${daysSinceLastPublish} days since your last post`,
      description: `No stress \u2014 everyone falls off the rhythm. ${recoveryNote}`,
      cta: recoveryCta,
      target: recoveryTarget,
      gradient: "from-rose-50 to-orange-50",
      borderColor: "border-rose-200",
    };
  }

  const scripted = pipeline.summary.SCRIPTED ?? 0;
  const recording = pipeline.summary.RECORDING ?? 0;
  const assembled = pipeline.summary.ASSEMBLED ?? 0;
  const scheduled = pipeline.summary.SCHEDULED ?? 0;

  // Priority 1: Stale research data
  if (hasStaleData) {
    return {
      headline: "Your research data is getting stale",
      description: "Fresh research means better content ideas. Run a new scan to see what your audience is actually talking about right now.",
      cta: "Generate Fresh Opportunities",
      target: "OPPORTUNITIES",
      gradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
    };
  }

  // Priority 2: No opportunities generated yet
  if (!hasOpps) {
    return {
      headline: "Discover your highest-value content ideas",
      description: "Cross-reference trending topics, audience demand, and your content gaps to find opportunities that score highest.",
      cta: "Generate Opportunities",
      target: "OPPORTUNITIES",
      gradient: "from-teal-50 to-sky-50",
      borderColor: "border-teal-200",
    };
  }

  // Priority 2.5: Videos without a production style set
  const scriptedVideos = pipeline.stages.SCRIPTED ?? [];
  const unstyledCount = scriptedVideos.filter((v) => !v.productionStyle).length;
  if (unstyledCount >= 3) {
    return {
      headline: `${unstyledCount} videos need a production style`,
      description: "Decide how you're making each video: Real, Enhanced, Heavy AI, or Full AI. This shapes your sessions and workflow.",
      cta: "Set Production Styles",
      target: "LIBRARY",
      gradient: "from-slate-50 to-slate-100",
      borderColor: "border-slate-300",
    };
  }

  // Priority 3: Scripts ready but not recording (style-aware)
  if (scripted >= 3) {
    const filmingVideos = scriptedVideos.filter((v) => v.productionStyle === "real" || v.productionStyle === "enhanced");
    const aiOnlyVideos = scriptedVideos.filter((v) => v.productionStyle === "full_ai" || v.productionStyle === "heavy_ai");

    if (filmingVideos.length >= 3) {
      return {
        headline: `${filmingVideos.length} videos ready to film`,
        description: `${filmingVideos.length} Real/Enhanced videos need filming. Batch by audience for tone consistency.`,
        cta: "Start Filming Session",
        target: "SESSION",
        gradient: "from-amber-50 to-yellow-50",
        borderColor: "border-amber-200",
      };
    }
    if (aiOnlyVideos.length >= 3) {
      return {
        headline: `${aiOnlyVideos.length} AI videos ready for voiceover`,
        description: `These videos skip filming. Record voiceovers, then move straight to AI generation.`,
        cta: "Start Voiceover Session",
        target: "SESSION",
        gradient: "from-sky-50 to-violet-50",
        borderColor: "border-violet-200",
      };
    }

    // Find the largest audience batch
    const byAudience = new Map<string, { label: string; count: number }>();
    for (const v of scriptedVideos) {
      const entry = byAudience.get(v.audience) ?? { label: v.audienceLabel, count: 0 };
      entry.count++;
      byAudience.set(v.audience, entry);
    }
    const topBatch = Array.from(byAudience.values()).sort((a, b) => b.count - a.count)[0];
    const batchNote = topBatch ? ` ${topBatch.count} in ${topBatch.label} is the most concentrated batch.` : "";

    return {
      headline: `${scripted} scripts ready for recording`,
      description: `Batch record voiceovers in one focused session. Group by audience category for the most efficient workflow.${batchNote}`,
      cta: "Start Recording Session",
      target: "SESSION",
      gradient: "from-amber-50 to-yellow-50",
      borderColor: "border-amber-200",
    };
  }

  // Priority 4: Assembled but not scheduled
  if (assembled > 0) {
    return {
      headline: `${assembled} video${assembled > 1 ? "s" : ""} ready to schedule`,
      description: "Your content is assembled and ready to go. Add it to your publishing calendar to keep your posting cadence consistent.",
      cta: "Schedule Videos",
      target: "CALENDAR",
      gradient: "from-violet-50 to-purple-50",
      borderColor: "border-violet-200",
    };
  }

  // Priority 5: Scheduled but not published
  if (scheduled > 0) {
    return {
      headline: `${scheduled} video${scheduled > 1 ? "s" : ""} scheduled for publishing`,
      description: "Check your calendar for upcoming publish dates. Mark videos as published once they go live.",
      cta: "View Calendar",
      target: "CALENDAR",
      gradient: "from-emerald-50 to-green-50",
      borderColor: "border-emerald-200",
    };
  }

  // Priority 6: Videos in recording/generating
  if (recording > 0) {
    return {
      headline: `${recording} video${recording > 1 ? "s" : ""} in production`,
      description: "You have content moving through the pipeline. Check in on progress and advance completed videos.",
      cta: "View Pipeline",
      target: "PIPELINE",
      gradient: "from-sky-50 to-blue-50",
      borderColor: "border-sky-200",
    };
  }

  // Fallback
  return {
    headline: "Discover new opportunities",
    description: "Analyze trending topics and audience signals to find your highest-value content ideas.",
    cta: "Generate Opportunities",
    target: "OPPORTUNITIES",
    gradient: "from-teal-50 to-sky-50",
    borderColor: "border-teal-200",
  };
}

// ─── Blowing Up: Tracked Creators Manager ────────────────────────────────────

type TrackedCreator = { id: number; handle: string; platform: string; active: boolean };

type DiscoverSuggestion = { handle: string; platform: string; source: string; videoCount?: number; avgViews?: number };

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
      platform === "TikTok" ? "bg-black text-white" :
      platform === "Instagram" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" :
      "bg-red-500 text-white"
    }`}>{platform}</span>
  );
}

function TrackedCreatorsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState("Instagram");
  const [showTracked, setShowTracked] = useState(false);

  const { data: creators = [] } = useQuery<TrackedCreator[]>({
    queryKey: ["blowing-up-creators"],
    queryFn: () => fetch("/api/creator-videos/blowing-up/creators").then((r) => r.json()),
    enabled: open,
  });

  const { data: discover } = useQuery<{ suggestions: DiscoverSuggestion[] }>({
    queryKey: ["blowing-up-discover"],
    queryFn: () => fetch("/api/creator-videos/blowing-up/discover").then((r) => r.json()),
    enabled: open,
  });
  const suggestions = discover?.suggestions ?? [];

  const addMutation = useMutation({
    mutationFn: async (params: { handle: string; platform: string }) => {
      const res = await fetch("/api/creator-videos/blowing-up/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blowing-up-creators"] });
      queryClient.invalidateQueries({ queryKey: ["blowing-up-discover"] });
      setNewHandle("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/creator-videos/blowing-up/creators/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blowing-up-creators"] });
      queryClient.invalidateQueries({ queryKey: ["blowing-up-discover"] });
    },
  });

  if (!open) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 animate-in fade-in duration-200 mb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Manage Tracked Creators</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-600">Suggested Creators</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((s) => (
              <button
                key={`${s.handle}-${s.platform}`}
                onClick={() => addMutation.mutate({ handle: s.handle, platform: s.platform })}
                disabled={addMutation.isPending}
                className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-xs font-semibold text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-colors disabled:opacity-40"
              >
                <Plus size={10} />
                {s.handle}
                <PlatformBadge platform={s.platform} />
                {s.source === "existing" && s.videoCount ? (
                  <span className="text-[9px] text-teal-500">{s.videoCount} vids</span>
                ) : s.source === "watchlist" ? (
                  <span className="text-[9px] text-teal-500">watchlist</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add manually */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newHandle}
          onChange={(e) => setNewHandle(e.target.value)}
          placeholder="@handle"
          className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
          onKeyDown={(e) => { if (e.key === "Enter" && newHandle.trim()) addMutation.mutate({ handle: newHandle, platform: newPlatform }); }}
        />
        <select
          value={newPlatform}
          onChange={(e) => setNewPlatform(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-2"
        >
          <option>Instagram</option>
          <option>TikTok</option>
          <option>YouTube</option>
        </select>
        <button
          onClick={() => addMutation.mutate({ handle: newHandle, platform: newPlatform })}
          disabled={!newHandle.trim() || addMutation.isPending}
          className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          <UserPlus size={12} /> Add
        </button>
      </div>
      {addMutation.isError && (
        <p className="text-xs text-red-500">{(addMutation.error as Error).message}</p>
      )}

      {/* Current tracked list (collapsible) */}
      <div>
        <button
          onClick={() => setShowTracked((v) => !v)}
          className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          {showTracked ? "Hide" : "Show"} tracked ({creators.length})
          <ChevronRight size={10} className={`transition-transform ${showTracked ? "rotate-90" : ""}`} />
        </button>
        {showTracked && (
          <div className="space-y-1 mt-2">
            {creators.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">{c.handle}</span>
                  <PlatformBadge platform={c.platform} />
                </div>
                <button
                  onClick={() => deleteMutation.mutate(c.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Blowing Up Refresh Button ───────────────────────────────────────────────

function BlowingUpRefresh({ onDone }: { onDone: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRefresh = async () => {
    setScanning(true);
    setResult(null);
    try {
      // Fix bad Instagram thumbnails first
      await fetch("/api/discover/fix-instagram-thumbnails", { method: "POST" });
      // Then trigger the n8n Blowing Up Scanner workflow via webhook
      try {
        const n8nBase = "https://n8n.srv1290877.hstgr.cloud";
        await fetch(`${n8nBase}/webhook/blowing-up-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "dashboard-manual" }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // n8n webhook may not be reachable from client -- that's ok, thumbnail fix still ran
      }
      setResult("Done");
      onDone();
    } catch {
      setResult("Error");
    } finally {
      setScanning(false);
      setTimeout(() => setResult(null), 3000);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={scanning}
      className="text-[10px] font-bold text-themed-muted hover:text-teal-600 disabled:opacity-50 transition-colors flex items-center gap-1"
      title="Refresh thumbnails and scan for new trending videos"
    >
      <RefreshCw size={10} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning..." : result || "Refresh"}
    </button>
  );
}

// ─── Trending Carousels Widget ───────────────────────────────────────────────

function TrendingCarousels({ onNavigate }: { onNavigate: (view: DashboardView, payload?: CarouselRemixSeed) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery<{
    trends: Array<{
      topic: string; hookLine: string; archetype: string; audience: string;
      platform: string; aspectRatio: string; proof: string; engagementSignal: string;
      creatorHandle?: string; postUrl?: string; thumbnailUrl?: string;
    }>;
    source?: string;
  }>({
    queryKey: ["carousel-trending-home"],
    queryFn: async () => {
      const res = await fetch("/api/carousels/trending");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/carousels/trending/refresh", { method: "POST" });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const trends = data?.trends;
  const source = data?.source;
  if (!trends?.length && !isLoading) return null;

  return (
    <ScrollReveal delay={180}>
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted flex items-center gap-1.5">
            <LayoutGrid size={12} className="text-violet-500" />
            Trending Carousels
          </h2>
          <div className="flex items-center gap-3">
            {source && (
              <span className="text-[9px] text-themed-muted">
                {source === "xpoz_real_data" || source === "n8n_carousel_trend_scanner" ? "Live data" : source === "web_search" ? "Web search" : "AI generated"}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[10px] font-bold text-themed-muted hover:text-violet-600 transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <TrendingUp size={10} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Scanning..." : "Refresh"}
            </button>
            <button
              onClick={() => onNavigate("CAROUSEL_LAB")}
              className="text-[10px] font-bold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Carousel Lab →
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-1 py-4 text-themed-muted">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Scanning trends...</span>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x scrollbar-hide">
            {trends!.slice(0, 6).map((trend, i) => (
              <div
                key={i}
                className="w-56 flex-shrink-0 snap-start rounded-2xl border border-themed bg-surface-elevated hover:border-violet-400 hover:shadow-md transition-all group overflow-hidden"
              >
                {/* Thumbnail */}
                {trend.thumbnailUrl ? (
                  <div className="relative w-full h-28 bg-slate-900 overflow-hidden">
                    <img
                      src={trend.thumbnailUrl}
                      alt={trend.topic}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                      <Zap size={9} className={trend.engagementSignal === "high" ? "text-amber-400" : "text-violet-300"} />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${
                        trend.engagementSignal === "high" ? "text-amber-400" : "text-violet-300"
                      }`}>
                        {trend.engagementSignal === "high" ? "Hot" : "Rising"}
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 text-[9px] text-white/70 capitalize">{trend.platform}</span>
                  </div>
                ) : (
                  <div className={`w-full h-28 flex flex-col items-center justify-center gap-1.5 ${
                    trend.platform === "tiktok" ? "bg-gradient-to-br from-slate-900 to-slate-800"
                    : trend.platform === "linkedin" ? "bg-gradient-to-br from-blue-900 to-blue-800"
                    : "bg-gradient-to-br from-fuchsia-900 via-purple-900 to-orange-900"
                  }`}>
                    <span className="text-white/90 text-lg font-black">@{trend.creatorHandle || "creator"}</span>
                    <div className="flex items-center gap-2">
                      <Zap size={10} className={trend.engagementSignal === "high" ? "text-amber-400" : "text-violet-300"} />
                      <span className={`text-[9px] font-black uppercase tracking-wider ${
                        trend.engagementSignal === "high" ? "text-amber-400" : "text-violet-300"
                      }`}>
                        {trend.engagementSignal === "high" ? "Hot" : "Rising"}
                      </span>
                      <span className="text-[9px] text-white/60 capitalize">{trend.platform}</span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <button
                  onClick={() => onNavigate("CAROUSEL_LAB", {
                    topic: trend.topic,
                    hookLine: trend.hookLine,
                    archetype: trend.archetype,
                    audience: trend.audience,
                    platform: trend.platform,
                    aspectRatio: trend.aspectRatio,
                    sourceUrl: trend.postUrl,
                  })}
                  className="w-full text-left p-3 space-y-1.5"
                >
                  <p className="text-sm font-bold text-themed leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
                    {trend.topic}
                  </p>
                  {trend.creatorHandle && (
                    <p className="text-[10px] text-themed-muted">@{trend.creatorHandle}</p>
                  )}
                  <p className="text-[11px] text-themed-muted line-clamp-1">{trend.proof}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                      {trend.archetype}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {trend.postUrl && (
                      <a
                        href={trend.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5"
                      >
                        <Eye size={8} /> View Original
                      </a>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("CAROUSEL_LAB", {
                          topic: trend.topic,
                          hookLine: trend.hookLine,
                          archetype: trend.archetype,
                          audience: trend.audience,
                          platform: trend.platform,
                          aspectRatio: trend.aspectRatio,
                          sourceUrl: trend.postUrl,
                        });
                      }}
                      className="text-[9px] font-bold text-violet-600 hover:text-violet-700 flex items-center gap-0.5 ml-auto cursor-pointer"
                    >
                      <Shuffle size={8} /> Remix
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </ScrollReveal>
  );
}

// ─── Dashboard Home ──────────────────────────────────────────────────────────

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onSelectVideo,
  onNavigate,
}) => {
  const queryClient = useQueryClient();
  const { data: pipeline, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
  });

  const { data: opportunities } = useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: () => fetch("/api/opportunities").then((r) => r.json()),
  });

  const { data: metricsData } = useQuery<{
    totalViews: number; totalLikes: number; totalSaves: number; totalShares: number;
    engagementRate: number; saveRate: number;
    viewsTrend: number[]; thisWeek: number; weekOverWeekDelta: number;
    topPerformer: {
      code: string; title: string; format: string; formatName: string | null; audience: string | null;
      views: number; likes: number; saves: number; shares: number; comments: number;
      engagementRate: number; saveRate: number; outlierScore: number;
      thumbnailUrl: string | null; videoUrl: string | null;
    } | null;
    bestFormat: { format: string; avgSaveRate: number; videoCount: number } | null;
    avgDaysToPublish: number | null;
    totalPublished: number; totalTracked: number;
  }>({
    queryKey: ["home-stats"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/metrics/summary");
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
  });

  const { data: lastPublishData } = useQuery<{ daysSinceLastPublish: number | null; lastPublishDate: string | null }>({
    queryKey: ["last-publish"],
    queryFn: () => fetch("/api/analytics/last-publish").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: pulseData } = useQuery<{ digest: IntelDigest | null }>({
    queryKey: ["viral-insights-latest"],
    queryFn: () => fetch("/api/viral-insights/latest").then((r) => r.json()),
    staleTime: 1000 * 60 * 30,
  });

  const { data: outlierVideos } = useQuery<{ videos: CreatorVideo[]; total: number }>({
    queryKey: ["outlier-videos-home"],
    queryFn: () => fetch("/api/creator-videos?sort=outlierScore&limit=12").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const [copiedHook, setCopiedHook] = useState<string | null>(null);
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set());
  const [showTrackedCreators, setShowTrackedCreators] = useState(false);

  const addIdeaMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideas: [{ topic, category: "trending", priority: "High" }] }),
      });
      if (!res.ok) throw new Error("Failed to add idea");
      return topic;
    },
    onSuccess: (topic) => {
      setAddedTopics((prev) => new Set([...prev, topic]));
      setTimeout(() => {
        setAddedTopics((prev) => {
          const next = new Set(prev);
          next.delete(topic);
          return next;
        });
      }, 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-themed-muted">Loading...</div>
    );
  }

  const whatsNext = determineWhatsNext(pipeline, opportunities, lastPublishData?.daysSinceLastPublish ?? null);
  const greeting = getGreeting();

  // Pipeline stages for stepper
  const stages: { status: ProductionStatus; label: string }[] = [
    { status: "SCRIPTED", label: "Scripted" },
    { status: "RECORDING", label: "Recording" },
    { status: "GENERATING", label: "Generating" },
    { status: "ASSEMBLED", label: "Assembled" },
    { status: "SCHEDULED", label: "Scheduled" },
    { status: "PUBLISHED", label: "Published" },
  ];

  // Find bottleneck (most items, excluding PUBLISHED)
  let bottleneckStatus: ProductionStatus | null = null;
  let maxCount = 0;
  for (const stage of stages) {
    if (stage.status === "PUBLISHED") continue;
    const count = pipeline?.summary[stage.status] ?? 0;
    if (count > maxCount) {
      maxCount = count;
      bottleneckStatus = stage.status;
    }
  }

  // In-progress count (everything between SCRIPTED and PUBLISHED)
  const inProgress = (pipeline?.summary.RECORDING ?? 0) + (pipeline?.summary.GENERATING ?? 0) +
    (pipeline?.summary.ASSEMBLED ?? 0) + (pipeline?.summary.SCHEDULED ?? 0);

  const [progressExpanded, setProgressExpanded] = useState(false);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* ═══ Section 1: Performance Command Strip ═══════════════════════════ */}
      <section>
        <div className="flex items-baseline justify-between mb-4 px-1">
          <h2 className="text-base font-serif font-bold text-themed">{greeting.text}</h2>
          <span className="text-[10px] text-themed-muted hidden md:block">{greeting.date}</span>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {/* Views */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Views</p>
            <p className="text-2xl font-serif font-bold text-slate-800">
              {metricsData?.totalViews ? <CountUp to={metricsData.totalViews} /> : "---"}
            </p>
            {metricsData?.viewsTrend && (
              <Sparkline data={metricsData.viewsTrend} width={120} height={24} color="#0d9488" fillOpacity={0.15} className="mt-1" />
            )}
          </div>

          {/* Week-over-Week */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">vs Last Week</p>
            {metricsData?.weekOverWeekDelta !== undefined ? (
              <p className={`text-2xl font-bold ${metricsData.weekOverWeekDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {metricsData.weekOverWeekDelta >= 0 ? "+" : ""}{metricsData.weekOverWeekDelta}%
              </p>
            ) : (
              <p className="text-2xl font-bold text-slate-300">---</p>
            )}
          </div>

          {/* Engagement Rate */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Engagement</p>
            <p className="text-2xl font-serif font-bold text-slate-800">
              {metricsData?.engagementRate ? `${metricsData.engagementRate}%` : "---"}
            </p>
          </div>

          {/* Monthly Goal */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Monthly Goal</p>
            {(() => {
              const goal = parseInt(localStorage.getItem("ce-monthly-views-goal") || "50000", 10);
              const current = metricsData?.thisWeek || metricsData?.totalViews || 0;
              const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
              const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
              return (
                <>
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-bold text-slate-800">{pct}%</span>
                  </div>
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{formatNum(current)} / {formatNum(goal)}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Record Tonight", icon: <Mic size={13} />, view: "SESSION" as const },
            { label: "Schedule Post", icon: <CalendarCheck size={13} />, view: "CALENDAR" as const },
            { label: "Generate Carousel", icon: <LayoutGrid size={13} />, view: "CAROUSEL_LAB" as const },
            { label: "View Pipeline", icon: <Activity size={13} />, view: "PIPELINE" as const },
          ].map((a) => (
            <button
              key={a.view}
              onClick={() => onNavigate(a.view)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors"
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* ═══ Section 2: Pipeline + Top Performer (side by side) ════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Pipeline (compact) ─────────────────────────────────────────── */}
        <button onClick={() => onNavigate("PIPELINE")} className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 text-left hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Pipeline</p>
            <span className="text-[10px] font-bold text-slate-500">{inProgress + (pipeline?.summary.SCRIPTED ?? 0)} in flight</span>
          </div>
          {/* Inline stage dots */}
          <div className="flex items-center gap-2 mb-3">
            {stages.map((stage, i) => {
              const count = pipeline?.summary[stage.status] ?? 0;
              return (
                <React.Fragment key={stage.status}>
                  <div className="flex items-center gap-1">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      count > 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-400"
                    }`}>
                      {count}
                    </span>
                    <span className="text-[8px] uppercase tracking-wide text-slate-400 hidden md:block">{stage.label.slice(0, 4)}</span>
                  </div>
                  {i < stages.length - 1 && <ChevronRight size={10} className="text-slate-300 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
          {bottleneckStatus && maxCount > 0 && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold">{maxCount}</span> in {bottleneckStatus.toLowerCase()}{getBottleneckAdvice(bottleneckStatus, maxCount)}
              <ArrowRight size={11} className="inline ml-1" />
            </p>
          )}
        </button>

        {/* ── Top Performer ──────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-amber-300 transition-colors">
          {metricsData?.topPerformer ? (
            <div className="flex h-full">
              <div className="w-28 md:w-36 shrink-0 relative overflow-hidden">
                {metricsData.topPerformer.thumbnailUrl ? (
                  <a href={(metricsData.topPerformer as Record<string, unknown>).videoUrl ? String((metricsData.topPerformer as Record<string, unknown>).videoUrl) : "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img src={metricsData.topPerformer.thumbnailUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.style.background = "linear-gradient(135deg, #f59e0b, #ea580c)"; }} />
                    {metricsData.topPerformer.outlierScore > 1 && (
                      <span className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white">{metricsData.topPerformer.outlierScore}x</span>
                    )}
                  </a>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center min-h-[120px]">
                    <Trophy size={24} className="text-white/60" />
                  </div>
                )}
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600 mb-1">Top Performer</p>
                  <p className="text-sm font-serif font-bold text-slate-800 leading-snug line-clamp-2">{metricsData.topPerformer.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <MetricBadge type="views" value={metricsData.topPerformer.views} />
                  <MetricBadge type="saves" value={metricsData.topPerformer.saves} />
                  <MetricBadge type="engagement" value={metricsData.topPerformer.engagementRate} />
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => onNavigate("METRICS")} className="w-full p-6 text-center">
              <Trophy size={20} className="text-amber-300 mx-auto mb-1" />
              <p className="text-xs font-bold text-slate-500">No performance data yet</p>
            </button>
          )}
        </div>
      </div>

      {/* ═══ Section 3: Discover (consolidated) ════════════════════════════ */}
      {(outlierVideos?.videos?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
              <Flame size={12} className="text-teal-500" />
              Discover
            </h2>
            <div className="flex items-center gap-3">
              <BlowingUpRefresh onDone={() => queryClient.invalidateQueries({ queryKey: ["outlier-videos-home"] })} />
              <button
                onClick={() => setShowTrackedCreators((v) => !v)}
                className="text-[10px] font-bold text-themed-muted hover:text-teal-600 transition-colors"
                title="Manage tracked creators"
              >
                <Settings size={12} />
              </button>
              <button
                onClick={() => onNavigate("DISCOVER_FEED")}
                className="text-[10px] font-bold text-teal-600 hover:text-teal-700 transition-colors"
              >
                See All →
              </button>
            </div>
          </div>
          <TrackedCreatorsPanel open={showTrackedCreators} onClose={() => setShowTrackedCreators(false)} />
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x scrollbar-hide">
            {outlierVideos!.videos.slice(0, 10).map((video) => (
              <div key={video.id} className="w-44 md:w-48 flex-shrink-0 snap-start">
                <VideoThumbnailCard
                  thumbnailUrl={video.thumbnailUrl}
                  videoUrl={video.videoUrl}
                  title={video.videoTitle || `@${video.creatorHandle}`}
                  subtitle={video.creatorHandle}
                  platform={video.platform}
                  views={video.views ?? undefined}
                  outlierScore={video.outlierScoreX100 ? video.outlierScoreX100 / 100 : undefined}
                  durationSeconds={video.durationSeconds ?? undefined}
                  createdAt={video.createdAt}
                  onClick={() => {
                    if (video.videoUrl && video.videoUrl !== "unknown") window.open(video.videoUrl, "_blank", "noopener");
                  }}
                />
              </div>
            ))}
          </div>
          {/* Trend chips (compressed from Trend Pulse) */}
          {pulseData?.digest && pulseData.digest.trendingTopics.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap px-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Trending</span>
              {pulseData.digest.trendingTopics.slice(0, 6).map((t, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate("SCRIPT_WIZARD")}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                >
                  {t.topic}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Section 4: Opportunities (compact) ════════════════════════════ */}
      {opportunities && (opportunities.opportunities?.length ?? 0) > 0 && (
        <button
          onClick={() => onNavigate("OPPORTUNITIES")}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-2xl hover:border-teal-300 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-teal-500" />
            <span className="text-sm font-semibold text-slate-700">
              {opportunities.opportunities?.length ?? 0} content opportunities found
            </span>
          </div>
          <span className="text-[10px] font-bold text-teal-600">Explore <ArrowRight size={11} className="inline" /></span>
        </button>
      )}

      {/* ═══ Section 5: Progress (collapsed gamification) ══════════════════ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setProgressExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Your Progress</span>
            <span className="text-xs font-semibold text-slate-600">Observer · Level 1 · 30/100 XP</span>
          </div>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${progressExpanded ? "rotate-90" : ""}`} />
        </button>
        {progressExpanded && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
            <CreatorLevelBadge variant="home" />
            <QuestChain onNavigate={onNavigate} />
          </div>
        )}
      </div>

      {/* Trend Pulse compressed into Discover chips; Trending Carousels moved to Carousel Lab */}
    </div>
  );
};
