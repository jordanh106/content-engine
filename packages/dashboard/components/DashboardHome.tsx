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
  Wand2,
} from "lucide-react";
import type {
  PipelineResponse,
  ProductionStatus,
  DashboardView,
  OpportunitiesResponse,
  IntelDigest,
  CreatorVideo,
  CarouselRemixSeed,
  ScriptWizardSeed,
} from "../shared/types.js";
import { VideoThumbnailCard } from "./ui/VideoThumbnailCard.js";
import { ScrollReveal, CountUp } from "./ui/animations.js";
import { Sparkline } from "./ui/Sparkline.js";
import { MetricBadge } from "./ui/MetricBadge.js";
import { CreatorLevelBadge } from "./ui/CreatorLevelBadge.js";
import { Button, Heading, Eyebrow, Pill, HomeNowStrip, RecentGenerationsGrid, QuickStartGallery } from "./ui/index.js";
import { TonightsTopIdeas } from "./TonightsTopIdeas.js";
import { QuestChain } from "./ui/QuestChain.js";
import { GoalRing } from "./ui/GoalRing.js";

type DashboardHomeProps = {
  onSelectVideo: (code: string) => void;
  onNavigate: (view: DashboardView, payload?: CarouselRemixSeed | ScriptWizardSeed) => void;
  onOpenProject?: (projectId: string) => void;
  onOpenStorytellingReelForProject?: (projectId: string) => void;
  onOpenMarketingStudioForProject?: (projectId: string) => void;
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
  SCHEDULED: { bg: "bg-teal-100", text: "text-teal-700", ring: "ring-violet-300" },
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
        borderColor: "border-teal-200",
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
      borderColor: "border-teal-200",
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
      platform === "Instagram" ? "bg-rose-600 text-white" :
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
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Manage Tracked Creators</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">Suggested Creators</p>
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
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center gap-1"
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

      // Trigger n8n scan + ingest via server-side proxy (avoids CORS)
      const scanRes = await fetch("/api/creator-videos/blowing-up/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (scanRes.ok) {
        const data = await scanRes.json();
        if (data.inserted > 0) {
          setResult(`+${data.inserted} new`);
        } else if (data.updated > 0) {
          setResult(`${data.updated} updated`);
        } else {
          setResult("No new videos");
        }
      } else {
        const err = await scanRes.json().catch(() => ({ error: "Scan failed" }));
        setResult(err.error || "Scan failed");
      }

      onDone();
    } catch {
      setResult("Error");
    } finally {
      setScanning(false);
      setTimeout(() => setResult(null), 5000);
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
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-themed-muted flex items-center gap-1.5">
            <LayoutGrid size={12} className="text-teal-600" />
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
              className="text-[10px] font-bold text-themed-muted hover:text-teal-700 transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <TrendingUp size={10} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Scanning..." : "Refresh"}
            </button>
            <button
              onClick={() => onNavigate("CAROUSEL_LAB")}
              className="text-[10px] font-bold text-teal-700 hover:text-teal-700 transition-colors"
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
                      loading="lazy"
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
                    trend.platform === "tiktok" ? "bg-slate-900"
                    : trend.platform === "linkedin" ? "bg-slate-800"
                    : "bg-slate-900"
                  }`}>
                    <span className="text-white/90 text-lg font-black">@{trend.creatorHandle || "creator"}</span>
                    <div className="flex items-center gap-2">
                      <Zap size={10} className={trend.engagementSignal === "high" ? "text-amber-400" : "text-teal-300"} />
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
                  <p className="text-sm font-bold text-themed leading-snug line-clamp-2 group-hover:text-teal-700 transition-colors">
                    {trend.topic}
                  </p>
                  {trend.creatorHandle && (
                    <p className="text-[10px] text-themed-muted">@{trend.creatorHandle}</p>
                  )}
                  <p className="text-[11px] text-themed-muted line-clamp-1">{trend.proof}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
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
                      className="text-[9px] font-bold text-teal-700 hover:text-teal-700 flex items-center gap-0.5 ml-auto cursor-pointer"
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
  onOpenProject,
  onOpenStorytellingReelForProject,
  onOpenMarketingStudioForProject,
}) => {
  const queryClient = useQueryClient();
  const { data: pipeline, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: opportunities } = useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: () => fetch("/api/opportunities").then((r) => r.json()),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
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
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: lastPublishData } = useQuery<{ daysSinceLastPublish: number | null; lastPublishDate: string | null }>({
    queryKey: ["last-publish"],
    queryFn: () => fetch("/api/analytics/last-publish").then((r) => r.json()),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pulseData } = useQuery<{ digest: IntelDigest | null }>({
    queryKey: ["viral-insights-latest"],
    queryFn: () => fetch("/api/viral-insights/latest").then((r) => r.json()),
    refetchInterval: 30 * 60_000,
    staleTime: 1000 * 60 * 30,
  });

  const { data: outlierVideos } = useQuery<{ videos: CreatorVideo[]; total: number }>({
    queryKey: ["outlier-videos-home"],
    queryFn: () => fetch("/api/creator-videos?sort=outlierScore&limit=12").then((r) => r.json()),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60 * 1000,
  });

  const [copiedHook, setCopiedHook] = useState<string | null>(null);
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set());
  const [showTrackedCreators, setShowTrackedCreators] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(false);

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

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-10">

      {/* ═══ Now Strip (live signals) ═══════════════════════════════════════ */}
      <HomeNowStrip />

      {/* ═══ Editorial Header ═══════════════════════════════════════════════ */}
      <header className="flex items-baseline justify-between border-b border-slate-200/70 pb-6">
        <Heading level={1} eyebrow={greeting.date} display>
          {greeting.text}
        </Heading>
        <div className="hidden md:flex items-center gap-2">
          <BlueprintQuickAccess />
        </div>
      </header>

      {/* ═══ What's Next Hero ═══════════════════════════════════════════════ */}
      <WhatsNextHero whatsNext={whatsNext} onNavigate={onNavigate} />

      {/* ═══ Tonight's Top Ideas (audience-tagged, ranked) ══════════════════ */}
      <TonightsTopIdeas
        onDevelop={(_idea) => {
          // Route to IdeasView for now; a future pass wires one-click project creation pre-tagged with audience.
          onNavigate?.("IDEAS");
        }}
      />

      {/* ═══ Quick Start template gallery ═══════════════════════════════════ */}
      {onOpenProject && (
        <QuickStartGallery
          onOpenProject={onOpenProject}
          onNavigate={onNavigate}
          onOpenStorytellingReelForProject={onOpenStorytellingReelForProject}
          onOpenMarketingStudioForProject={onOpenMarketingStudioForProject}
        />
      )}

      {/* ═══ Recent generations (live Higgsfield activity) ══════════════════ */}
      <RecentGenerationsGrid />

      {/* ═══ Section 1: Performance Command Strip ═══════════════════════════ */}
      <section>
        <div className="flex items-baseline justify-between mb-5 px-1">
          <Eyebrow>Performance</Eyebrow>
          <span className="type-meta tabular-nums">Last 7 days</span>
        </div>

        {/* KPI Cards Row — refined hierarchy */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          {/* Views (hero card — spans 2 cols on desktop) */}
          <div className="md:col-span-2 surface-secondary group hover:border-teal-200 transition-colors">
            <Eyebrow className="mb-3">Total Views</Eyebrow>
            <p className="type-stat-hero leading-none">
              {metricsData?.totalViews ? metricsData.totalViews.toLocaleString() : "—"}
            </p>
            {metricsData?.viewsTrend && (
              <Sparkline data={metricsData.viewsTrend} width={220} height={36} color="#0d9488" fillOpacity={0.14} className="mt-4" />
            )}
          </div>

          {/* Week-over-Week */}
          <div className="surface-secondary flex flex-col justify-between hover:border-teal-200 transition-colors">
            <Eyebrow className="mb-3">vs Last Week</Eyebrow>
            {metricsData?.weekOverWeekDelta !== undefined ? (
              <p className={`type-stat-medium ${metricsData.weekOverWeekDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {metricsData.weekOverWeekDelta >= 0 ? "+" : ""}{metricsData.weekOverWeekDelta}%
              </p>
            ) : (
              <p className="type-stat-medium text-slate-300">—</p>
            )}
            <p className="type-meta mt-1">7-day delta</p>
          </div>

          {/* Engagement + Goal stacked */}
          <div className="flex flex-col gap-4">
            <div className="surface-secondary py-4 flex-1 hover:border-teal-200 transition-colors">
              <Eyebrow className="mb-2">Engagement</Eyebrow>
              <p className="type-stat-medium">
                {metricsData?.engagementRate ? `${metricsData.engagementRate}%` : "—"}
              </p>
            </div>
            <div className="surface-secondary py-4 flex-1 hover:border-teal-200 transition-colors">
              <Eyebrow className="mb-2">Monthly Goal</Eyebrow>
              {(() => {
                const goal = parseInt(localStorage.getItem("ce-monthly-views-goal") || "50000", 10);
                const current = metricsData?.thisWeek || metricsData?.totalViews || 0;
                const pct = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;
                const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
                return (
                  <>
                    <span className="type-stat-medium">{pct}%</span>
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="type-meta mt-1.5 tabular-nums">{formatNum(current)} / {formatNum(goal)}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Quick Actions — sentence case, premium typography */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Record tonight", icon: <Mic />, view: "SESSION" as const },
            { label: "Schedule post", icon: <CalendarCheck />, view: "CALENDAR" as const },
            { label: "Generate carousel", icon: <LayoutGrid />, view: "CAROUSEL_LAB" as const },
            { label: "View pipeline", icon: <Activity />, view: "PIPELINE" as const },
            { label: "Visual canvas", icon: <Shuffle />, view: "CANVAS" as const },
          ].map((a) => (
            <Button
              key={a.view}
              variant="secondary"
              size="md"
              icon={a.icon}
              onClick={() => onNavigate(a.view as DashboardView)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </section>

      {/* ═══ Section 2: Top Performer (full-width showcase) ═════════════════ */}
      {metricsData?.topPerformer ? (() => {
        const tp = metricsData.topPerformer;
        const videoUrl = (tp as Record<string, unknown>).videoUrl as string | null;
        const formatLabel = tp.format ? `Format ${tp.format}` : null;

        // Build a meaningful "why it worked" narrative from the data
        const avgViews = metricsData.totalViews && metricsData.totalTracked
          ? Math.round(metricsData.totalViews / Math.max(metricsData.totalTracked, 1))
          : 0;
        const avgEngagement = metricsData.engagementRate || 0;

        const insights: string[] = [];
        // Compare this video's metrics against your averages
        if (tp.outlierScore >= 2) {
          insights.push(`This video earned ${tp.outlierScore}x more views than your typical content`);
        } else if (tp.outlierScore >= 1.5) {
          insights.push(`Outperformed your average by ${Math.round((tp.outlierScore - 1) * 100)}%`);
        }
        if (tp.saveRate > 0.5) {
          insights.push(`${tp.saveRate}% save rate means people want to come back to this`);
        }
        if (tp.engagementRate > avgEngagement * 1.5 && avgEngagement > 0) {
          insights.push(`Engagement was ${Math.round((tp.engagementRate / avgEngagement - 1) * 100)}% above your average`);
        }
        if (tp.saves > 5 && tp.views > 0) {
          const savesToViews = ((tp.saves / tp.views) * 100).toFixed(1);
          if (parseFloat(savesToViews) > 0.3) {
            insights.push(`High save-to-view ratio (${savesToViews}%) signals strong rewatch value`);
          }
        }
        if (tp.audience) insights.push(`Resonated with the ${tp.audience} audience`);
        if (formatLabel) insights.push(`${formatLabel} continues to perform well for your channel`);

        // Fallback if we couldn't derive meaningful insights
        if (insights.length === 0) {
          insights.push("Strong overall performance across all engagement metrics");
        }

        return (
          <div className="surface-primary !p-0 overflow-hidden hover:shadow-md transition-all duration-200">
            <div className="flex flex-col md:flex-row">
              {/* Thumbnail */}
              <div className="w-full md:w-64 lg:w-72 shrink-0 relative overflow-hidden bg-slate-900">
                {tp.thumbnailUrl ? (
                  <a href={videoUrl || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img
                      src={tp.thumbnailUrl} alt=""
                      loading="lazy"
                      className="w-full h-full object-cover aspect-video md:aspect-[3/4] min-h-[200px] md:min-h-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </a>
                ) : (
                  <a href={videoUrl || "#"} target="_blank" rel="noopener noreferrer"
                    className="w-full h-full flex flex-col items-center justify-center min-h-[200px] md:min-h-0 gap-2 text-center px-6">
                    <Trophy size={28} className="text-amber-400/60" />
                    <p className="text-[11px] text-white/40 font-medium leading-snug">{tp.title}</p>
                  </a>
                )}
                {/* Platform badge */}
                <span className="absolute bottom-3 left-3 text-[9px] font-bold px-2 py-1 rounded-md bg-black/50 text-white/80 backdrop-blur-sm uppercase tracking-wider">
                  Instagram Reel
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 md:p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <Eyebrow tone="warning" icon={<Trophy size={13} />}>Your top performer</Eyebrow>
                  {formatLabel && <Pill variant="muted">{formatLabel}</Pill>}
                </div>

                {/* Title */}
                <h3 className="type-h3 mb-5">{tp.title}</h3>

                {/* Outlier score — the hero stat */}
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="type-stat-large text-amber-600">{tp.outlierScore}x</span>
                  <span className="type-body">your average views</span>
                </div>

                {/* Metrics grid with context */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
                  <div>
                    <Eyebrow className="mb-1.5">Views</Eyebrow>
                    <p className="type-stat-small">{tp.views.toLocaleString()}</p>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Likes</Eyebrow>
                    <p className="type-stat-small">{tp.likes.toLocaleString()}</p>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Saves</Eyebrow>
                    <p className="type-stat-small">{tp.saves}</p>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Engagement</Eyebrow>
                    <p className="type-stat-small text-teal-700">{tp.engagementRate}%</p>
                  </div>
                </div>

                {/* Why it worked insights */}
                {insights.length > 0 && (
                  <div className="mb-6 px-5 py-4 bg-amber-50 rounded-2xl border border-amber-200/70">
                    <Eyebrow tone="warning" icon={<Sparkles size={13} />} className="mb-2">Why this worked</Eyebrow>
                    <div className="space-y-1.5 mt-3">
                      {insights.slice(0, 3).map((insight, i) => (
                        <p key={i} className="text-[13px] text-amber-900/80 leading-relaxed">
                          {insight}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    variant="primary"
                    tone="teal"
                    size="md"
                    icon={<Sparkles />}
                    onClick={() => {
                      const coreTopic = tp.title;
                      const seed: import("../shared/types.js").ScriptWizardSeed = {
                        topic: coreTopic,
                        format: tp.format || undefined,
                        audience: tp.audience || undefined,
                        videoCode: tp.code,
                        sourceTitle: tp.title,
                        outlierScore: tp.outlierScore,
                        replicateContext: {
                          sourceTitle: tp.title,
                          outlierScore: tp.outlierScore,
                          views: tp.views,
                          saves: tp.saves,
                          engagementRate: tp.engagementRate,
                          saveRate: tp.saveRate,
                          format: tp.format || undefined,
                          audience: tp.audience || undefined,
                          insights,
                        },
                      };
                      onNavigate("SCRIPT_WIZARD", seed);
                    }}
                  >
                    Study & replicate
                  </Button>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-teal-600 transition-colors"
                    >
                      <Eye size={14} /> View original <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="bg-surface-elevated shadow-sm rounded-2xl p-8 text-center">
          <Trophy size={24} className="text-amber-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-themed-secondary">No performance data yet</p>
          <p className="text-xs text-themed-muted mt-1">Start tracking metrics to see your top performer here</p>
        </div>
      )}

      {/* ═══ Pipeline (compact full-width bar) ═══════════════════════════════ */}
      <button onClick={() => onNavigate("PIPELINE")} className="w-full surface-secondary hover:border-teal-200 px-6 py-5 text-left transition-all duration-200 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Eyebrow>Pipeline</Eyebrow>
            <div className="flex items-center gap-2">
              {stages.map((stage, i) => {
                const count = pipeline?.summary[stage.status] ?? 0;
                return (
                  <React.Fragment key={stage.status}>
                    <div className="flex items-center gap-2">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums transition-colors ${
                        count > 0 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {count}
                      </span>
                      <span className="type-meta hidden md:block">{stage.label}</span>
                    </div>
                    {i < stages.length - 1 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 tabular-nums">{inProgress + (pipeline?.summary.SCRIPTED ?? 0)} in flight</span>
            <ArrowRight size={14} className="text-slate-400 group-hover:text-teal-600 transition-colors" />
          </div>
        </div>
      </button>

      {/* ═══ Performance Insights (auto-generated feedback loop) ════════════ */}
      <PerformanceInsightsCard onNavigate={onNavigate} />

      {/* ═══ Section 3: Discover (consolidated) ════════════════════════════ */}
      {(outlierVideos?.videos?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <Eyebrow icon={<TrendingUp size={13} className="text-teal-500" />}>Trending now</Eyebrow>
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
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Trending</span>
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
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white shadow-sm hover:shadow-md rounded-2xl transition-all duration-200 text-left"
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

      {/* ═══ Master Blueprint Surface ═══════════════════════════════════════ */}
      <BlueprintCard onNavigate={onNavigate} />

    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// What's Next Hero — editorial CTA card
// ═══════════════════════════════════════════════════════════════════════════
const WhatsNextHero: React.FC<{ whatsNext: WhatsNextAction; onNavigate: (view: DashboardView) => void }> = ({ whatsNext, onNavigate }) => (
  <section className="surface-primary group hover:border-teal-200 transition-colors">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
      <div className="md:max-w-2xl">
        <Heading level={2} eyebrow="What's next" eyebrowTone="accent">
          {whatsNext.headline}
        </Heading>
        <p className="type-body mt-3">{whatsNext.description}</p>
      </div>
      <Button
        variant="primary"
        tone="slate"
        size="lg"
        onClick={() => onNavigate(whatsNext.target)}
        iconRight={<ArrowRight />}
        className="self-start md:self-end"
      >
        {whatsNext.cta}
      </Button>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════════
// Blueprint Quick Access — header chip
// ═══════════════════════════════════════════════════════════════════════════
const BlueprintQuickAccess: React.FC = () => {
  const { data } = useQuery<{ blueprint: { version: string; generated: string; hookArchetypes: string[] } }>({
    queryKey: ["master-blueprint"],
    queryFn: () => fetch("/api/blueprint").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.blueprint) return null;
  return (
    <Button
      as="a"
      href="/api/blueprint/raw"
      target="_blank"
      rel="noopener"
      variant="tag"
      tone="teal"
      size="sm"
      icon={<Sparkles />}
      title={`Blueprint v${data.blueprint.version} · ${data.blueprint.hookArchetypes.length} archetypes`}
    >
      Blueprint v{data.blueprint.version}
    </Button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Master Blueprint Card — replaces gamification, surfaces compliance system
// ═══════════════════════════════════════════════════════════════════════════
const BlueprintCard: React.FC<{ onNavigate: (view: DashboardView) => void }> = ({ onNavigate }) => {
  const { data } = useQuery<{ blueprint: { version: string; generated: string; hookArchetypes: string[]; antiPatterns: string[]; passingScore: number } }>({
    queryKey: ["master-blueprint"],
    queryFn: () => fetch("/api/blueprint").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.blueprint) return null;
  const bp = data.blueprint;
  return (
    <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Sparkles size={16} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Master Blueprint</p>
            <p className="text-base font-serif font-bold text-slate-900 leading-tight">v{bp.version} · pass ≥ {bp.passingScore}/100</p>
          </div>
        </div>
        <a
          href="/api/blueprint/raw"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-colors"
        >
          View Full
        </a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Hook Archetypes</p>
          <ul className="space-y-1.5">
            {bp.hookArchetypes.slice(0, 4).map((arch) => (
              <li key={arch} className="text-xs text-slate-700 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-teal-500" /> {arch}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-3">Anti-Patterns</p>
          <p className="text-2xl font-serif font-bold text-slate-900 tabular-nums leading-none">{bp.antiPatterns.length}</p>
          <p className="text-xs text-slate-500 mt-1">flagged as hard fails</p>
        </div>
        <div className="p-5 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Quick Convert</p>
            <p className="text-xs text-slate-600 leading-relaxed">Paste any URL or text and get a blueprint-compliant script.</p>
          </div>
          <button
            onClick={() => {
              // Trigger the FAB convert mode via keyboard shortcut
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-teal-700 transition-colors w-fit"
          >
            <Wand2 size={11} /> Open Convert
          </button>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Performance Insights Card — auto-generated feedback loop
// ═══════════════════════════════════════════════════════════════════════════
type Insight = { type: string; severity: "info" | "warning" | "success"; title: string; detail: string; data?: Record<string, unknown> };

const PerformanceInsightsCard: React.FC<{ onNavigate: (view: DashboardView) => void }> = ({ onNavigate }) => {
  const { data } = useQuery<{ insights: Insight[]; generatedAt: string; videoCount: number }>({
    queryKey: ["auto-insights"],
    queryFn: () => fetch("/api/metrics/auto-insights").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  if (!data?.insights?.length) return null;

  const severityStyles: Record<string, { bg: string; icon: string; border: string }> = {
    success: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-200" },
    warning: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200" },
    info: { bg: "bg-sky-50", icon: "text-sky-600", border: "border-sky-200" },
  };

  const severityIcons: Record<string, React.ReactNode> = {
    success: <TrendingUp size={14} />,
    warning: <Activity size={14} />,
    info: <Zap size={14} />,
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Activity size={12} className="text-teal-500" />
          Performance Insights
        </h2>
        <button
          onClick={() => onNavigate("STRATEGY")}
          className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
        >
          Full Analysis <ArrowRight size={10} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {data.insights.slice(0, 4).map((insight, i) => {
          const style = severityStyles[insight.severity] || severityStyles.info;
          return (
            <div key={i} className={`${style.bg} border ${style.border} rounded-xl px-4 py-3 transition-all duration-200 hover:shadow-sm`}>
              <div className="flex items-start gap-2.5">
                <span className={`${style.icon} mt-0.5 shrink-0`}>{severityIcons[insight.severity]}</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-800 leading-snug">{insight.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{insight.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
