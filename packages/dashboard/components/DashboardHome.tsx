import React from "react";
import { useQuery } from "@tanstack/react-query";
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

  // Priority 3: Scripts ready but not recording
  if (scripted >= 3) {
    return {
      headline: `${scripted} scripts ready for recording`,
      description: "Batch record voiceovers in one focused session. Group by audience category for the most efficient workflow.",
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
                <p className="text-2xl font-bold text-slate-900">---</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Top Performer</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Keyboard shortcut hint */}
      <div className="hidden md:flex justify-center pt-2">
        <p className="text-xs text-slate-400">
          Press{" "}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">
            {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+K
          </kbd>{" "}
          to quickly navigate anywhere
        </p>
      </div>
    </div>
  );
};
