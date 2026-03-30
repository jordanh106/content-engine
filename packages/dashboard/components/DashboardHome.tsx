import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import type {
  PipelineResponse,
  ProductionStatus,
  DashboardView,
  OpportunitiesResponse,
  IntelDigest,
  CreatorVideo,
} from "../shared/types.js";
import { VideoThumbnailCard } from "./ui/VideoThumbnailCard.js";
import { ScrollReveal, CountUp } from "./ui/animations.js";
import { CreatorLevelBadge } from "./ui/CreatorLevelBadge.js";
import { QuestChain } from "./ui/QuestChain.js";

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

// ─── Trending Carousels Widget ───────────────────────────────────────────────

function TrendingCarousels({ onNavigate }: { onNavigate: (view: DashboardView) => void }) {
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
                  onClick={() => onNavigate("CAROUSEL_LAB")}
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
                      onClick={(e) => { e.stopPropagation(); onNavigate("CAROUSEL_LAB"); }}
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
  const { data: pipeline, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
  });

  const { data: opportunities } = useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: () => fetch("/api/opportunities").then((r) => r.json()),
  });

  const { data: metricsData } = useQuery<{ totalViews: number; thisWeek: number; topPerformer: { code: string; title: string; views: number } | null }>({
    queryKey: ["home-stats"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/metrics/summary");
        if (!res.ok) return { totalViews: 0, thisWeek: 0, topPerformer: null };
        return res.json();
      } catch {
        return { totalViews: 0, thisWeek: 0, topPerformer: null };
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
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Greeting + What's Next Hero Card */}
      <ScrollReveal delay={0}>
      <section>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="text-base font-serif font-bold text-themed">
            {greeting.text}
          </h2>
          <span className="text-[10px] text-themed-muted hidden md:block">{greeting.date}</span>
        </div>
        <div className={`bg-gradient-to-r ${whatsNext.gradient} border ${whatsNext.borderColor} rounded-2xl p-6`}>
          <h3 className="text-lg font-serif font-bold text-themed mb-2">
            {whatsNext.headline}
          </h3>
          <p className="text-sm text-themed-secondary mb-4 max-w-xl">
            {whatsNext.description}
          </p>
          <button
            onClick={() => onNavigate(whatsNext.target)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-full text-sm font-bold hover:bg-teal-700 transition-colors shadow-sm"
          >
            {whatsNext.cta}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      </ScrollReveal>

      {/* Creator Growth: Level + Active Quest */}
      <ScrollReveal delay={60}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <CreatorLevelBadge variant="home" />
        <QuestChain onNavigate={onNavigate} />
      </div>
      </ScrollReveal>

      {/* Bento Row: Pipeline + Smart Stats */}
      <ScrollReveal delay={120}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* Pipeline Stepper — 2/3 width */}
        <div className="md:col-span-2 bg-surface-elevated border border-themed rounded-2xl overflow-hidden">
          {/* Progress micro-bar */}
          {(() => {
            const total = Object.values(pipeline?.summary ?? {}).reduce((a, b) => a + b, 0);
            const published = pipeline?.summary.PUBLISHED ?? 0;
            const pct = total > 0 ? Math.round((published / total) * 100) : 0;
            return (
              <div className="h-1 bg-surface-hover">
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            );
          })()}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Pipeline</p>
              <span className="text-[10px] font-bold text-themed-tertiary">
                {Object.entries(pipeline?.summary ?? {}).reduce((acc, [k, v]) => k !== "PUBLISHED" ? acc + (v as number) : acc, 0)} in flight
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 py-1">
              {stages.map((stage, i) => {
                const count = pipeline?.summary[stage.status] ?? 0;
                const colors = STATUS_COLORS[stage.status];
                const isBottleneck = stage.status === bottleneckStatus && maxCount > 0;

                return (
                  <React.Fragment key={stage.status}>
                    <button
                      onClick={() => onNavigate(STATUS_NAV[stage.status])}
                      className="flex flex-col items-center gap-1.5 min-w-[52px] group"
                    >
                      <div
                        className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center transition-transform group-hover:scale-110 ${
                          isBottleneck ? `ring-2 ${colors.ring} ring-offset-2` : ""
                        }`}
                      >
                        {count > 0 ? (
                          <span className="text-sm font-bold">{count}</span>
                        ) : (
                          STATUS_ICONS[stage.status]
                        )}
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-themed-tertiary group-hover:text-themed-secondary transition-colors">
                        {stage.label}
                      </span>
                    </button>
                    {i < stages.length - 1 && (
                      <ChevronRight size={12} className="text-slate-300 shrink-0 mt-[-16px]" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {/* Actionable bottleneck guidance */}
            {bottleneckStatus && maxCount > 0 && (
              <button
                onClick={() => onNavigate(STATUS_NAV[bottleneckStatus])}
                className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-surface-hover rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group text-left"
              >
                <span className="text-xs text-themed-secondary">
                  <span className="font-semibold">{maxCount}</span> in {bottleneckStatus.toLowerCase()}
                  {getBottleneckAdvice(bottleneckStatus, maxCount)}
                </span>
                <ArrowRight size={13} className="text-themed-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Smart Stats — 1/3 width, clickable cards */}
        <div className="space-y-3">
          {/* In Progress */}
          <button
            onClick={() => onNavigate("PIPELINE")}
            className="w-full text-left bg-surface-elevated border border-themed rounded-2xl p-4 hover:border-sky-300 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-themed"><CountUp to={inProgress} /></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mt-0.5">In Progress</p>
            {inProgress > 0 && (
              <p className="text-[10px] text-themed-tertiary mt-1">
                {[
                  pipeline?.summary.RECORDING && `${pipeline.summary.RECORDING} recording`,
                  pipeline?.summary.GENERATING && `${pipeline.summary.GENERATING} generating`,
                  pipeline?.summary.ASSEMBLED && `${pipeline.summary.ASSEMBLED} assembled`,
                  pipeline?.summary.SCHEDULED && `${pipeline.summary.SCHEDULED} scheduled`,
                ].filter(Boolean).join(", ")}
              </p>
            )}
          </button>

          {/* Total Views */}
          <button
            onClick={() => onNavigate("INTELLIGENCE")}
            className="w-full text-left bg-surface-elevated border border-themed rounded-2xl p-4 hover:border-emerald-300 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Eye size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-themed">
              {metricsData?.totalViews ? (metricsData.totalViews >= 1000 ? `${(metricsData.totalViews / 1000).toFixed(1)}K` : metricsData.totalViews) : "---"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mt-0.5">Total Views</p>
          </button>

          {/* Top Performer */}
          <button
            onClick={() => onNavigate("INTELLIGENCE")}
            className="w-full text-left bg-surface-elevated border border-themed rounded-2xl p-4 hover:border-amber-300 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Trophy size={14} />
              </div>
            </div>
            {metricsData?.topPerformer ? (
              <>
                <p className="text-sm font-bold text-themed line-clamp-1">{metricsData.topPerformer.code}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mt-0.5">Top Performer</p>
              </>
            ) : (
              <>
                <p className="text-xs text-themed-tertiary">Publish to start tracking</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-themed-muted mt-0.5">Top Performer</p>
              </>
            )}
          </button>
        </div>
      </div>
      </ScrollReveal>

      {/* Blowing Up Right Now — Outlier Videos */}
      {(outlierVideos?.videos?.length ?? 0) > 0 && (
        <ScrollReveal delay={160}>
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted flex items-center gap-1.5">
              <Flame size={12} className="text-orange-500" />
              Blowing Up Right Now
            </h2>
            <button
              onClick={() => onNavigate("DISCOVER_FEED")}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-700 transition-colors"
            >
              See All →
            </button>
          </div>
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
        </section>
        </ScrollReveal>
      )}

      {/* Trending Carousels */}
      <TrendingCarousels onNavigate={onNavigate} />

      {/* Trend Pulse */}
      {pulseData?.digest && (() => {
        const digest = pulseData.digest;
        const topics = digest.trendingTopics.slice(0, 4);
        const hooks = digest.hookPatterns.slice(0, 2);
        const gaps = digest.contentGaps.slice(0, 2);
        const dateLabel = digest.date
          ? new Date(digest.date).toLocaleDateString("en-US", { month: "long", day: "numeric" })
          : "";
        return (
          <ScrollReveal delay={240}>
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-3 px-1 flex items-center gap-1.5">
              <Signal size={12} className="text-teal-500" />
              Trend Pulse
            </h2>
            <div className="bg-surface-elevated border border-themed rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-themed-subtle bg-surface-hover">
                <span className="text-[10px] text-themed-muted">
                  {dateLabel ? `From ${dateLabel} digest` : "Latest digest"} · n8n auto-updated
                </span>
                <button
                  onClick={() => onNavigate("IDEAS")}
                  className="text-[10px] font-bold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  View All Ideas →
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {/* Trending Topics */}
                {topics.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-themed-muted mb-2">Trending Now</p>
                    <div className="space-y-2">
                      {topics.map((t, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-themed">{t.topic}</span>
                            {t.platforms.length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {t.platforms.map((p) => (
                                  <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 uppercase tracking-wide dark:bg-teal-500/10">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => addIdeaMutation.mutate(t.topic)}
                            disabled={addIdeaMutation.isPending || addedTopics.has(t.topic)}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors disabled:opacity-50 bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20"
                          >
                            {addedTopics.has(t.topic) ? <Check size={10} /> : <Plus size={10} />}
                            {addedTopics.has(t.topic) ? "Added" : "Idea"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hook Patterns */}
                {hooks.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-themed-muted mb-2">Hook Patterns Spotted</p>
                    <div className="space-y-2">
                      {hooks.map((h, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-themed-secondary italic line-clamp-1">"{h.text}"</p>
                            <div className="flex gap-1 mt-0.5">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 uppercase dark:bg-violet-500/10">{h.type}</span>
                              <span className="text-[9px] text-themed-muted">{h.platform}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(h.text);
                              setCopiedHook(h.text);
                              setTimeout(() => setCopiedHook(null), 2000);
                            }}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-surface-hover text-themed-tertiary hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            {copiedHook === h.text ? <Check size={10} /> : <Copy size={10} />}
                            {copiedHook === h.text ? "Copied" : "Copy"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Gaps */}
                {gaps.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-themed-muted mb-2">Content Gaps</p>
                    <div className="space-y-2">
                      {gaps.map((g, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-themed">{g.area}</span>
                            {g.description && (
                              <p className="text-[10px] text-themed-muted mt-0.5 line-clamp-1">{g.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => addIdeaMutation.mutate(g.area)}
                            disabled={addIdeaMutation.isPending || addedTopics.has(g.area)}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-colors disabled:opacity-50 bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20"
                          >
                            {addedTopics.has(g.area) ? <Check size={10} /> : <Plus size={10} />}
                            {addedTopics.has(g.area) ? "Added" : "Idea"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          </ScrollReveal>
        );
      })()}
    </div>
  );
};
