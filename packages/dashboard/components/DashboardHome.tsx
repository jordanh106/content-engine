import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileText,
  Mic,
  Sparkles,
  Film,
  CalendarCheck,
  CircleCheck,
  ArrowRight,
  Radar,
  ChevronRight,
  TrendingUp,
  Trophy,
  Eye,
  Heart,
  Clock,
  Zap,
} from "lucide-react";
import type {
  PipelineResponse,
  ProductionStatus,
  DashboardView,
  OpportunitiesResponse,
} from "../shared/types.js";

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
  SCRIPTED: { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-300" },
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

function determineWhatsNext(
  pipeline: PipelineResponse | undefined,
  opportunities: OpportunitiesResponse | undefined,
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

  const scripted = pipeline.summary.SCRIPTED ?? 0;
  const recording = pipeline.summary.RECORDING ?? 0;
  const assembled = pipeline.summary.ASSEMBLED ?? 0;
  const scheduled = pipeline.summary.SCHEDULED ?? 0;
  const ideas = pipeline.summary.SCRIPTED ?? 0; // Ideas that have scripts

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

// ============================
// Production Timeline
// ============================

const FORMAT_COLORS_MAP: Record<string, string> = {
  A: "bg-teal-500", B: "bg-emerald-500", C: "bg-sky-500",
  D: "bg-rose-500", E: "bg-violet-500", F: "bg-orange-500", G: "bg-pink-500",
};

type TimelineVideo = {
  code: string;
  title: string;
  format: string;
  audienceLabel: string;
  currentStatus: string;
  stageIndex: number;
  totalStages: number;
  projectedDaysRemaining: number;
  projectedComplete: string;
};

// Render Queue Status
type RenderQueueData = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  jobs: Array<{ id: string; videoCode: string; compositionId: string; status: string; createdAt: string; error: string | null }>;
};

type AutomationWorkflow = {
  id: string;
  label: string;
  schedule: string;
  active: boolean;
  lastRun: string | null;
  lastStatus: string;
  lastFinished: string | null;
  recentExecutions: Array<{ id: string; status: string; startedAt: string; stoppedAt: string }>;
  error?: string;
};

type AutomationData = {
  configured: boolean;
  workflows: AutomationWorkflow[];
  message?: string;
};

const AutomationStatus: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<AutomationData>({
    queryKey: ["automation-status"],
    queryFn: () => fetch("/api/automation/status").then((r) => r.json()),
    refetchInterval: 60000,
  });

  if (!data?.configured || data.workflows.length === 0) return null;

  const allOk = data.workflows.every((w) => w.lastStatus === "success");
  const anyError = data.workflows.some((w) => w.lastStatus === "error");

  function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-teal-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Automations</p>
        </div>
        <div className="flex items-center gap-2">
          {allOk && <span className="text-[10px] font-bold text-emerald-600">All healthy</span>}
          {anyError && <span className="text-[10px] font-bold text-rose-600">Error detected</span>}
          <ChevronRight size={12} className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {data.workflows.map((wf) => (
            <div key={wf.id} className={`flex items-center gap-3 p-3 rounded-lg ${wf.lastStatus === "error" ? "bg-rose-50" : wf.active ? "bg-emerald-50" : "bg-slate-50"}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.lastStatus === "error" ? "bg-rose-500" : wf.active ? "bg-emerald-500" : "bg-slate-400"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{wf.label}</p>
                <p className="text-[10px] text-slate-500">{wf.schedule} {wf.active ? "" : "(inactive)"}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-[10px] font-bold ${wf.lastStatus === "success" ? "text-emerald-600" : wf.lastStatus === "error" ? "text-rose-600" : "text-slate-500"}`}>
                  {wf.lastStatus}
                </p>
                <p className="text-[10px] text-slate-400">{timeAgo(wf.lastRun)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const RenderQueueStatus: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<RenderQueueData>({
    queryKey: ["render-queue"],
    queryFn: () => fetch("/api/renders/queue").then((r) => r.json()),
    refetchInterval: 10000,
  });

  if (!data || (data.queued === 0 && data.running === 0 && data.completed === 0 && data.failed === 0)) return null;

  const activeJobs = data.jobs.filter((j) => j.status === "running" || j.status === "queued");
  const recentJobs = data.jobs.filter((j) => j.status === "completed" || j.status === "failed").slice(0, 5);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Render Queue</p>
        </div>
        <div className="flex items-center gap-3">
          {data.running > 0 && <span className="text-[10px] font-bold text-amber-600">{data.running} running</span>}
          {data.queued > 0 && <span className="text-[10px] font-bold text-slate-500">{data.queued} queued</span>}
          <span className="text-[10px] text-emerald-600">{data.completed} done</span>
          {data.failed > 0 && <span className="text-[10px] text-rose-500">{data.failed} failed</span>}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {activeJobs.map((j) => (
            <div key={j.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-700">{j.videoCode}</span>
              <span className="text-[10px] text-slate-500">{j.compositionId}</span>
              <span className="ml-auto text-[10px] font-bold text-amber-600 uppercase">{j.status}</span>
            </div>
          ))}
          {recentJobs.map((j) => (
            <div key={j.id} className={`flex items-center gap-2 p-2 rounded-lg ${j.status === "completed" ? "bg-emerald-50" : "bg-rose-50"}`}>
              <div className={`w-2 h-2 rounded-full ${j.status === "completed" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-xs font-medium text-slate-700">{j.videoCode}</span>
              <span className="text-[10px] text-slate-500">{j.compositionId}</span>
              <span className={`ml-auto text-[10px] font-bold uppercase ${j.status === "completed" ? "text-emerald-600" : "text-rose-600"}`}>{j.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const ProductionTimeline: React.FC<{ onSelectVideo: (code: string) => void }> = ({ onSelectVideo }) => {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery<{ timeline: TimelineVideo[] }>({
    queryKey: ["production-timeline"],
    queryFn: () => fetch("/api/analytics/production-timeline").then((r) => r.json()),
  });

  if (!data || data.timeline.length === 0) return null;

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1 flex items-center gap-1.5 hover:text-slate-600 transition-colors"
      >
        <Clock size={12} />
        Production Timeline ({data.timeline.length})
        <ChevronRight size={12} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          {data.timeline.slice(0, 8).map((v) => (
            <button
              key={v.code}
              onClick={() => onSelectVideo(v.code)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
            >
              <div className={`w-2 h-8 rounded-full ${FORMAT_COLORS_MAP[v.format] || "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{v.code}: {v.title}</p>
                <p className="text-[10px] text-slate-400">{v.currentStatus} - {v.audienceLabel}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${(v.stageIndex / (v.totalStages - 1)) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                  {v.projectedDaysRemaining}d
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

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

  type HealthDim = { score: number; max: number; detail: string };
  const { data: healthData } = useQuery<{ score: number; dimensions: Record<string, HealthDim> }>({
    queryKey: ["health-score"],
    queryFn: () => fetch("/api/analytics/health-score").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-slate-400">Loading...</div>
    );
  }

  const whatsNext = determineWhatsNext(pipeline, opportunities);

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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* What's Next Hero Card */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
          What's Next
        </h2>
        <div className={`bg-gradient-to-r ${whatsNext.gradient} border ${whatsNext.borderColor} rounded-2xl p-6`}>
          <h3 className="text-lg font-serif font-bold text-slate-900 mb-2">
            {whatsNext.headline}
          </h3>
          <p className="text-sm text-slate-600 mb-4 max-w-xl">
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

      {/* Pipeline Stepper */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
          Content Pipeline
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between overflow-x-auto gap-1">
            {stages.map((stage, i) => {
              const count = pipeline?.summary[stage.status] ?? 0;
              const colors = STATUS_COLORS[stage.status];
              const isBottleneck = stage.status === bottleneckStatus && maxCount > 0;

              return (
                <React.Fragment key={stage.status}>
                  <button
                    onClick={() => onNavigate(STATUS_NAV[stage.status])}
                    className="flex flex-col items-center gap-1.5 min-w-[60px] group"
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors">
                      {stage.label}
                    </span>
                  </button>
                  {i < stages.length - 1 && (
                    <ChevronRight size={14} className="text-slate-300 shrink-0 mt-[-18px]" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {bottleneckStatus && maxCount > 0 && (
            <p className="text-xs text-slate-500 mt-3 text-center">
              <span className="font-semibold text-slate-700">{maxCount} video{maxCount > 1 ? "s" : ""}</span> in {bottleneckStatus.toLowerCase()} stage
            </p>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
          Quick Stats
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{pipeline?.summary.PUBLISHED ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Published</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Eye size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsData?.totalViews ? (metricsData.totalViews >= 1000 ? `${(metricsData.totalViews / 1000).toFixed(1)}K` : metricsData.totalViews) : "---"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Total Views</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Trophy size={14} />
              </div>
            </div>
            {metricsData?.topPerformer ? (
              <>
                <p className="text-sm font-bold text-slate-900 line-clamp-1">{metricsData.topPerformer.code}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Top Performer</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400 italic">No data yet</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Top Performer</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Superfan Pipeline (Kallaway 90-Minute Rule) */}
      {(() => {
        const published = pipeline?.summary.PUBLISHED ?? 0;
        const TARGET = 270;
        const pct = Math.min(Math.round((published / TARGET) * 100), 100);
        const estMinutes = Math.round(published * 25 / 60); // ~25s avg short-form video
        return (
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1 flex items-center gap-1.5">
              <Zap size={12} className="text-violet-500" />
              Superfan Pipeline
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-700">{published} / {TARGET} videos</p>
                <p className="text-sm font-bold text-violet-600">{pct}%</p>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-slate-400">~{estMinutes} min of content published</p>
                <p className="text-[10px] text-slate-400">Goal: 90 min (superfan territory)</p>
              </div>
              {published === 0 ? (
                <button
                  onClick={() => onNavigate("PIPELINE")}
                  className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors group text-left"
                >
                  <span className="text-xs font-semibold text-violet-700">Publish your first video to start your superfan journey</span>
                  <ArrowRight size={13} className="text-violet-500 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                </button>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">
                  270 short-form videos ≈ 90 min of watched content. That's when casual viewers become superfans.
                </p>
              )}
            </div>
          </section>
        );
      })()}

      {/* Content Health Score */}
      {healthData && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1 flex items-center gap-1.5">
            <Heart size={12} className="text-rose-500" />
            Content Health
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-4 mb-3">
              <span className={`text-3xl font-black ${healthData.score >= 75 ? "text-emerald-600" : healthData.score >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                {healthData.score}
              </span>
              <span className="text-sm text-slate-400">/100</span>
            </div>
            <div className="space-y-3">
              {Object.entries(healthData.dimensions).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-slate-600 capitalize">{key}</span>
                    <span className="text-[10px] text-slate-400">{dim.detail}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dim.score >= dim.max * 0.75 ? "bg-emerald-500" : dim.score >= dim.max * 0.5 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${(dim.score / dim.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Production Timeline */}
      <ProductionTimeline onSelectVideo={onSelectVideo} />

      {/* Render Queue Status */}
      <RenderQueueStatus />

      {/* Automation Status */}
      <AutomationStatus />

      {/* Keyboard shortcut hint */}
      <div className="hidden md:flex justify-center pt-2">
        <p className="text-xs text-slate-400">
          Press{" "}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">
            {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+K
          </kbd>{" "}
          for command palette.{" "}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">
            1-9
          </kbd>{" "}
          for quick nav.
        </p>
      </div>
    </div>
  );
};
