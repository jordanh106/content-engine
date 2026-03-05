import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Mic,
  Sparkles,
  Film,
  CalendarCheck,
  CircleCheck,
  Zap,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Radar,
  Calendar,
  Search,
  Activity,
} from "lucide-react";
import type {
  PipelineResponse,
  PipelineVideo,
  ProductionStatus,
  DashboardView,
  OpportunitiesResponse,
  VelocityResponse,
} from "../shared/types.js";
import { PRODUCTION_STATUSES } from "../shared/types.js";
import { StatCard } from "./ui/StatCard.js";
import { SkillButton } from "./ui/SkillButton.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

type DashboardHomeProps = {
  onSelectVideo: (code: string) => void;
  onNavigate?: (view: DashboardView) => void;
};

// Status -> icon, bg, text color
const STATUS_META: Record<
  ProductionStatus,
  { icon: React.ReactNode; iconBg: string; iconText: string }
> = {
  SCRIPTED: { icon: <FileText size={16} />, iconBg: "bg-slate-100", iconText: "text-slate-600" },
  RECORDING: { icon: <Mic size={16} />, iconBg: "bg-amber-50", iconText: "text-amber-600" },
  GENERATING: { icon: <Sparkles size={16} />, iconBg: "bg-sky-50", iconText: "text-sky-600" },
  ASSEMBLED: { icon: <Film size={16} />, iconBg: "bg-teal-50", iconText: "text-teal-600" },
  SCHEDULED: { icon: <CalendarCheck size={16} />, iconBg: "bg-violet-50", iconText: "text-violet-600" },
  PUBLISHED: { icon: <CircleCheck size={16} />, iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
};

const STAGE_ACTIONS: Record<ProductionStatus, string> = {
  SCRIPTED: "Record voiceovers for",
  RECORDING: "Generate motion graphics for",
  GENERATING: "Assemble final cuts for",
  ASSEMBLED: "Schedule",
  SCHEDULED: "Publish",
  PUBLISHED: "",
};

type SessionRecommendation = {
  action: string;
  stage: ProductionStatus;
  audienceLabel: string;
  videoCodes: string[];
  totalInStage: number;
};

function generateRecommendation(
  stages: Record<ProductionStatus, PipelineVideo[]>,
): SessionRecommendation | null {
  const actionableStatuses: ProductionStatus[] = [
    "SCRIPTED",
    "RECORDING",
    "GENERATING",
    "ASSEMBLED",
    "SCHEDULED",
  ];

  for (const status of actionableStatuses) {
    const videos = stages[status];
    if (!videos || videos.length === 0) continue;

    const byAudience = new Map<string, PipelineVideo[]>();
    for (const v of videos) {
      const group = byAudience.get(v.audience) || [];
      group.push(v);
      byAudience.set(v.audience, group);
    }

    let bestLabel = "";
    let bestCodes: string[] = [];
    for (const [, vids] of byAudience) {
      if (vids.length > bestCodes.length) {
        bestLabel = vids[0].audienceLabel;
        bestCodes = vids.map((v) => v.code);
      }
    }

    return {
      action: STAGE_ACTIONS[status],
      stage: status,
      audienceLabel: bestLabel,
      videoCodes: bestCodes,
      totalInStage: videos.length,
    };
  }

  return null;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onSelectVideo,
  onNavigate,
}) => {
  const { data, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
  });

  const { data: opportunitiesData } = useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: () => fetch("/api/opportunities").then((r) => r.json()),
  });

  const { data: velocityData } = useQuery<VelocityResponse>({
    queryKey: ["analytics-velocity"],
    queryFn: () => fetch("/api/analytics/velocity").then((r) => r.json()).catch(() => null),
  });

  if (isLoading || !data) {
    return (
      <div className="text-center py-12 text-slate-400">Loading...</div>
    );
  }

  const publishedCount = data.summary.PUBLISHED || 0;
  const progressPct =
    data.total > 0 ? Math.round((publishedCount / data.total) * 100) : 0;
  const recommendation = generateRecommendation(data.stages);

  // Intelligence data
  const topOpportunity = opportunitiesData?.opportunities?.[0] ?? null;
  const staleWarnings = opportunitiesData?.staleWarnings ?? [];
  const hasStaleWarnings = staleWarnings.length > 0 && opportunitiesData?.opportunities?.length !== 0;

  // Pipeline bottleneck
  const bottleneckStage = (() => {
    let maxCount = 0;
    let maxStage: ProductionStatus | null = null;
    for (const status of PRODUCTION_STATUSES) {
      if (status === "PUBLISHED") continue;
      const count = data.stages[status]?.length ?? 0;
      if (count > maxCount) {
        maxCount = count;
        maxStage = status;
      }
    }
    if (!maxStage || maxCount === 0) return null;
    const avgDays = data.stages[maxStage].reduce((s, v) => s + v.daysInStage, 0) / maxCount;
    return { stage: maxStage, count: maxCount, avgDays: Math.round(avgDays) };
  })();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
          Production Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {data.total} videos, {progressPct}% published
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {PRODUCTION_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          return (
            <StatCard
              key={status}
              label={status}
              value={data.summary[status] || 0}
              icon={meta.icon}
              iconBg={meta.iconBg}
              iconText={meta.iconText}
            />
          );
        })}
      </div>

      {/* Intelligence Cards */}
      <section className="mb-6">
        <FeatureHint id="intelligence-cards" content={FEATURE_HINTS["intelligence-cards"].content} side="bottom">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
            Intelligence
          </h2>
        </FeatureHint>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stale Data / Data Health */}
          <div className={`border rounded-2xl p-4 ${hasStaleWarnings ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className={hasStaleWarnings ? "text-amber-600" : "text-emerald-600"} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Data Health</span>
            </div>
            {hasStaleWarnings ? (
              <ul className="space-y-1">
                {staleWarnings.slice(0, 2).map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-700 font-medium">All data sources fresh</p>
            )}
          </div>

          {/* Top Opportunity */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Radar size={14} className="text-teal-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Top Opportunity</span>
            </div>
            {topOpportunity ? (
              <div>
                <p className="text-xs font-semibold text-slate-900 line-clamp-2 mb-1">{topOpportunity.topic}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-600">Score: {topOpportunity.overallScore}</span>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate("OPPORTUNITIES")}
                      className="text-[10px] font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-0.5"
                    >
                      View <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Generate opportunities to see top picks</p>
            )}
          </div>

          {/* Pipeline Bottleneck */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-slate-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Bottleneck</span>
            </div>
            {bottleneckStage ? (
              <div>
                <p className="text-xs font-semibold text-slate-900">{bottleneckStage.count} videos in {bottleneckStage.stage}</p>
                <p className="text-[10px] text-slate-500">{bottleneckStage.avgDays}d avg time in stage</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No bottlenecks detected</p>
            )}
          </div>

          {/* Content Velocity */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-violet-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Velocity</span>
            </div>
            {velocityData && velocityData.completedVideos > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-900">{velocityData.avgDaysTotal}d avg to publish</p>
                <p className="text-[10px] text-slate-500">{velocityData.completedVideos} videos completed</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Move videos through pipeline to see velocity</p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-6">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <FeatureHint id="skill-buttons" content={FEATURE_HINTS["skill-buttons"].content} side="bottom">
            <SkillButton skill="/viral-scout" args="chiropractic" label="Viral Scout" icon={<Radar size={14} />} />
          </FeatureHint>
          <SkillButton skill="/content-planner" label="Content Planner" icon={<Calendar size={14} />} />
          <SkillButton skill="/last30days" args="chiropractic" label="Research" icon={<Search size={14} />} />
        </div>
      </section>

      {/* Tonight's Session */}
      {recommendation && (
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
            Tonight's Session
          </h2>
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 mb-1">
                  {recommendation.action} {recommendation.audienceLabel}
                </p>
                <p className="text-xs text-slate-600 mb-3">
                  {recommendation.videoCodes.length} of{" "}
                  {recommendation.totalInStage} videos in{" "}
                  {recommendation.stage.toLowerCase()} stage. Batch by audience
                  for the most efficient session.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendation.videoCodes.map((code) => (
                    <button
                      key={code}
                      onClick={() => onSelectVideo(code)}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!recommendation && (
        <section>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
            <CircleCheck className="mx-auto mb-2 text-emerald-600" size={24} />
            <p className="text-sm font-semibold text-slate-900">
              All videos published
            </p>
          </div>
        </section>
      )}

      <ViewHelp {...VIEW_HELP.HOME} />
    </div>
  );
};
