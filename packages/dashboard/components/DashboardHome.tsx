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
} from "lucide-react";
import type {
  PipelineResponse,
  PipelineVideo,
  ProductionStatus,
} from "../shared/types.js";
import { PRODUCTION_STATUSES } from "../shared/types.js";
import { StatCard } from "./ui/StatCard.js";

type DashboardHomeProps = {
  onSelectVideo: (code: string) => void;
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

    // Group by audience, pick largest batch
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
}) => {
  const { data, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
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
    </div>
  );
};
