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
  Cell,
} from "recharts";
import {
  Radar,
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowUpRight,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Plus,
  Check,
  MessageCircle,
  Globe,
  Hash,
  Zap,
  Target,
  TrendingUp,
  Shield,
  Layers,
  Radio,
  Users,
  BarChart3,
  Rocket,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { FORMATS } from "../shared/types.js";
import type {
  ContentOpportunity,
  OpportunitiesResponse,
  OpportunityDimension,
  FormatId,
  DashboardView,
} from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

const FORMAT_COLORS: Record<string, string> = {
  A: "#0d9488",
  B: "#059669",
  C: "#0284c7",
  D: "#e11d48",
  E: "#7c3aed",
  F: "#ea580c",
  G: "#db2777",
};

const DIMENSION_META: Record<
  OpportunityDimension,
  { label: string; weight: number; color: string; icon: React.ReactNode }
> = {
  audienceDemand: { label: "Audience Demand", weight: 15, color: "#0d9488", icon: <Users size={14} /> },
  competitionGap: { label: "Competition Gap", weight: 25, color: "#7c3aed", icon: <Target size={14} /> },
  trendMomentum: { label: "Trend Momentum", weight: 10, color: "#ea580c", icon: <TrendingUp size={14} /> },
  formatFit: { label: "Format Fit", weight: 10, color: "#0284c7", icon: <Layers size={14} /> },
  hookAvailability: { label: "Hook Availability", weight: 10, color: "#059669", icon: <Zap size={14} /> },
  platformAlignment: { label: "Platform Alignment", weight: 10, color: "#db2777", icon: <Radio size={14} /> },
  audienceDiversity: { label: "Audience Diversity", weight: 20, color: "#e11d48", icon: <BarChart3 size={14} /> },
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "overallScore", label: "Overall Score" },
  { value: "audienceDemand", label: "Audience Demand" },
  { value: "competitionGap", label: "Competition Gap" },
  { value: "trendMomentum", label: "Trend Momentum" },
  { value: "formatFit", label: "Format Fit" },
  { value: "hookAvailability", label: "Hook Availability" },
  { value: "platformAlignment", label: "Platform Alignment" },
  { value: "audienceDiversity", label: "Audience Diversity" },
];

const EVIDENCE_ICONS: Record<string, React.ReactNode> = {
  reddit: <MessageCircle size={14} className="text-orange-500" />,
  x: <Hash size={14} className="text-sky-500" />,
  web: <Globe size={14} className="text-emerald-500" />,
  "viral-digest": <Sparkles size={14} className="text-violet-500" />,
  performance: <BarChart3 size={14} className="text-teal-500" />,
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 40) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-rose-600 bg-rose-50 border-rose-200";
}

function scoreBgClass(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function getValidationTags(opp: ContentOpportunity): string[] {
  return opp.dimensions
    .filter((d) => d.score >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((d) => DIMENSION_META[d.dimension]?.label ?? d.dimension);
}

function formatPlatformName(platform: string): string {
  return platform
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================
// Score Badge Component
// ============================

const ScoreBadge: React.FC<{ score: number; size?: "sm" | "lg" }> = ({ score, size = "sm" }) => {
  const sizeClasses = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-sm";
  return (
    <div
      className={cn(
        "rounded-full border-2 font-black flex items-center justify-center shrink-0",
        scoreColor(score),
        sizeClasses,
      )}
    >
      {score}
    </div>
  );
};

// ============================
// Mini Spark Bar (7 segments)
// ============================

const SparkBar: React.FC<{ dimensions: ContentOpportunity["dimensions"] }> = ({ dimensions }) => {
  const ordered: OpportunityDimension[] = [
    "audienceDemand",
    "competitionGap",
    "trendMomentum",
    "formatFit",
    "hookAvailability",
    "platformAlignment",
    "audienceDiversity",
  ];
  const dimMap = new Map(dimensions.map((d) => [d.dimension, d.score]));

  return (
    <div className="flex gap-0.5 items-end h-4">
      {ordered.map((dim) => {
        const score = dimMap.get(dim) ?? 0;
        const height = Math.max(2, Math.round((score / 100) * 16));
        return (
          <div
            key={dim}
            className="w-1.5 rounded-full"
            style={{
              height: `${height}px`,
              backgroundColor: DIMENSION_META[dim].color,
              opacity: score >= 50 ? 1 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
};

// ============================
// Opportunity Card (List View)
// ============================

const OpportunityCard: React.FC<{
  opportunity: ContentOpportunity;
  onClick: () => void;
}> = ({ opportunity, onClick }) => {
  const tags = getValidationTags(opportunity);
  const formatInfo = FORMATS[opportunity.suggestedFormat as FormatId];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 md:p-5 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <ScoreBadge score={opportunity.overallScore} />
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-bold text-slate-900 text-sm md:text-base leading-tight">
            {opportunity.topic}
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{opportunity.whyNow}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {formatInfo && (
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: FORMAT_COLORS[opportunity.suggestedFormat] ?? "#94a3b8" }}
              >
                {opportunity.suggestedFormat}: {formatInfo.shortName}
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {formatPlatformName(opportunity.targetPlatform)}
            </span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <SparkBar dimensions={opportunity.dimensions} />
      </div>
    </button>
  );
};

// ============================
// Detail View Components
// ============================

const DimensionBar: React.FC<{
  dimension: OpportunityDimension;
  score: number;
  rationale: string;
}> = ({ dimension, score, rationale }) => {
  const meta = DIMENSION_META[dimension];
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{meta.icon}</span>
          <span className="text-xs font-bold text-slate-700">{meta.label}</span>
          <span className="text-[10px] text-slate-400">({meta.weight}%)</span>
        </div>
        <span className="text-sm font-black text-slate-800">{score}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: meta.color }}
        />
      </div>
      <p className="text-[11px] text-slate-500 mt-1">{rationale}</p>
    </div>
  );
};

const EvidenceCard: React.FC<{
  evidence: ContentOpportunity["evidence"][0];
}> = ({ evidence }) => (
  <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
    <div className="mt-0.5">{EVIDENCE_ICONS[evidence.type] ?? <Globe size={14} />}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-700 truncate">{evidence.title}</span>
        {evidence.engagement?.score && (
          <span className="text-[10px] font-bold text-slate-400 shrink-0">
            Score: {evidence.engagement.score}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5">{evidence.detail}</p>
      {evidence.url && (
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-700 mt-1"
        >
          <ExternalLink size={10} /> View source
        </a>
      )}
    </div>
  </div>
);

const OpportunityDetail: React.FC<{
  opportunity: ContentOpportunity;
  onBack: () => void;
}> = ({ opportunity, onBack }) => {
  const queryClient = useQueryClient();
  const [added, setAdded] = useState(false);
  const [produced, setProduced] = useState(false);
  const [producedCode, setProducedCode] = useState<string | null>(null);

  const addToIdeasMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/opportunities/${opportunity.id}/add-to-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: opportunity.topic,
          suggestedFormat: opportunity.suggestedFormat,
          suggestedHook: opportunity.suggestedHook,
          targetAudience: opportunity.targetAudience,
          whyNow: opportunity.whyNow,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setAdded(true);
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
    },
  });

  const startProductionMutation = useMutation({
    mutationFn: () =>
      fetch("/api/ideas/start-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: opportunity.topic,
          format: opportunity.suggestedFormat,
          hookAngle: opportunity.suggestedHook.example,
          source: "Opportunities AI",
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setProduced(true);
      setProducedCode(data.videoCode);
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const tags = getValidationTags(opportunity);
  const formatInfo = FORMATS[opportunity.suggestedFormat as FormatId];

  // Group evidence by type
  const evidenceGroups: Record<string, ContentOpportunity["evidence"]> = {};
  for (const e of opportunity.evidence) {
    if (!evidenceGroups[e.type]) evidenceGroups[e.type] = [];
    evidenceGroups[e.type].push(e);
  }

  // Chart data for scoring breakdown
  const chartData = opportunity.dimensions
    .sort(
      (a, b) =>
        (DIMENSION_META[b.dimension]?.weight ?? 0) - (DIMENSION_META[a.dimension]?.weight ?? 0),
    )
    .map((d) => ({
      name: DIMENSION_META[d.dimension]?.label ?? d.dimension,
      score: d.score,
      color: DIMENSION_META[d.dimension]?.color ?? "#94a3b8",
    }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
      >
        <ArrowLeft size={16} /> All Opportunities
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Main Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <div className="flex items-start gap-4">
              <ScoreBadge score={opportunity.overallScore} size="lg" />
              <div className="flex-1">
                <h1 className="font-serif font-bold text-xl md:text-2xl text-slate-900 leading-tight">
                  {opportunity.topic}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Why Now */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Why Now?
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">{opportunity.whyNow}</p>
          </div>

          {/* Proof & Signals */}
          {opportunity.evidence.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                Proof & Signals
              </h2>
              <div className="space-y-4">
                {Object.entries(evidenceGroups).map(([type, items]) => (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      {EVIDENCE_ICONS[type]}
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {type === "viral-digest" ? "Market Intel" : type}
                      </span>
                      <span className="text-[10px] text-slate-400">({items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((e, i) => (
                        <EvidenceCard key={i} evidence={e} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competition Check */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              The Content Gap
            </h2>
            <div className="flex items-start gap-3 mb-3">
              <div
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  opportunity.competitionCheck.coverageLevel === "none"
                    ? "bg-emerald-50 text-emerald-700"
                    : opportunity.competitionCheck.coverageLevel === "partial"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700",
                )}
              >
                {opportunity.competitionCheck.coverageLevel === "none"
                  ? "Open Opportunity"
                  : opportunity.competitionCheck.coverageLevel === "partial"
                    ? "Partial Coverage"
                    : "Well Covered"}
              </div>
            </div>
            <p className="text-sm text-slate-700">{opportunity.competitionCheck.gapDescription}</p>
            {opportunity.competitionCheck.coveredVideos.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Related videos:
                </span>
                {opportunity.competitionCheck.coveredVideos.map((code) => (
                  <span
                    key={code}
                    className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Execution Plan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
              Execution Plan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Format */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Suggested Format
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {formatInfo && (
                    <span
                      className="text-xs font-black text-white px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: FORMAT_COLORS[opportunity.suggestedFormat] ?? "#94a3b8",
                      }}
                    >
                      {opportunity.suggestedFormat}: {formatInfo.name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600">{opportunity.formatRationale}</p>
              </div>

              {/* Hook */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Suggested Hook
                </div>
                <p className="text-sm font-medium text-slate-800 italic mb-1">
                  "{opportunity.suggestedHook.example}"
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-500">
                    Pattern: {opportunity.suggestedHook.pattern}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Optimizes: {opportunity.suggestedHook.optimizes}
                  </span>
                </div>
              </div>

              {/* Platform & Audience */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Target Platform
                </div>
                <span className="text-sm font-medium text-slate-800">
                  {formatPlatformName(opportunity.targetPlatform)}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Target Audience
                </div>
                <span className="text-sm font-medium text-slate-800">
                  {opportunity.targetAudience}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              {produced && producedCode && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-sm text-emerald-700 font-medium">
                    Video {producedCode} created in content library
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Find it in Pipeline (SCRIPTED) or Library.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startProductionMutation.mutate()}
                  disabled={produced || startProductionMutation.isPending}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors",
                    produced
                      ? "bg-emerald-100 text-emerald-700 cursor-default"
                      : startProductionMutation.isPending
                        ? "bg-slate-100 text-slate-400 cursor-wait"
                        : "bg-violet-600 text-white hover:bg-violet-700",
                  )}
                >
                  {produced ? (
                    <>
                      <Check size={14} /> Production Started
                    </>
                  ) : startProductionMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Rocket size={14} /> Start Production
                    </>
                  )}
                </button>
                <button
                  onClick={() => addToIdeasMutation.mutate()}
                  disabled={added || addToIdeasMutation.isPending}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors",
                    added
                      ? "bg-emerald-100 text-emerald-700 cursor-default"
                      : addToIdeasMutation.isPending
                        ? "bg-slate-100 text-slate-400 cursor-wait"
                        : "bg-teal-600 text-white hover:bg-teal-700",
                  )}
                >
                  {added ? (
                    <>
                      <Check size={14} /> Added to Idea Bank
                    </>
                  ) : addToIdeasMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Add to Idea Bank
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Scoring Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
              Scoring Breakdown
            </h2>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl font-black text-slate-900">{opportunity.overallScore}</span>
              <span className="text-xs text-slate-500">/100 weighted score</span>
            </div>

            {/* Chart */}
            <div className="mb-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={115}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0}/100`, "Score"]}
                  />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed bars with rationale */}
            <div className="space-y-1">
              {opportunity.dimensions
                .sort(
                  (a, b) =>
                    (DIMENSION_META[b.dimension]?.weight ?? 0) -
                    (DIMENSION_META[a.dimension]?.weight ?? 0),
                )
                .map((d) => (
                  <DimensionBar
                    key={d.dimension}
                    dimension={d.dimension}
                    score={d.score}
                    rationale={d.rationale}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => startProductionMutation.mutate()}
                disabled={produced || startProductionMutation.isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors",
                  produced
                    ? "bg-emerald-100 text-emerald-700"
                    : startProductionMutation.isPending
                      ? "bg-slate-100 text-slate-400"
                      : "bg-violet-600 text-white hover:bg-violet-700",
                )}
              >
                {produced ? (
                  <>
                    <Check size={12} /> {producedCode}
                  </>
                ) : (
                  <>
                    <Rocket size={12} /> Start Production
                  </>
                )}
              </button>
              <button
                onClick={() => addToIdeasMutation.mutate()}
                disabled={added || addToIdeasMutation.isPending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors",
                  added
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-teal-600 text-white hover:bg-teal-700",
                )}
              >
                {added ? (
                  <>
                    <Check size={12} /> Added
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Add to Idea Bank
                  </>
                )}
              </button>
              <button
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft size={12} /> Back to List
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <div className="text-2xl font-black text-slate-900">{opportunity.overallScore}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {opportunity.overallScore >= 70
                  ? "High Priority"
                  : opportunity.overallScore >= 40
                    ? "Worth Exploring"
                    : "Lower Priority"}
              </div>
            </div>
          </div>

          {/* Content Fit */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Content Fit
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Format</span>
                {formatInfo && (
                  <span
                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: FORMAT_COLORS[opportunity.suggestedFormat] ?? "#94a3b8",
                    }}
                  >
                    {opportunity.suggestedFormat}: {formatInfo.shortName}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Platform</span>
                <span className="text-[11px] font-medium text-slate-700">
                  {formatPlatformName(opportunity.targetPlatform)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Audience</span>
                <span className="text-[11px] font-medium text-slate-700">
                  {opportunity.targetAudience}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Hook</span>
                <span className="text-[11px] font-medium text-slate-700">
                  {opportunity.suggestedHook.category}
                </span>
              </div>
              {opportunity.similarTopPerformer && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold">
                    <Trophy size={10} />
                    Similar to top performer: {opportunity.similarTopPerformer}
                  </span>
                </div>
              )}
              {opportunity.ideaBankMatch && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-violet-600 font-bold">
                    Matches idea: {opportunity.ideaBankMatch}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Community Signals */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Community Signals
            </h3>
            <div className="space-y-3">
              {opportunity.communitySignals.redditThreads > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageCircle size={12} className="text-orange-500" />
                      <span className="text-[11px] font-medium text-slate-700">Reddit</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {opportunity.communitySignals.topRedditScore}/100
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {opportunity.communitySignals.redditThreads} threads
                    {opportunity.communitySignals.topRedditTitle && (
                      <span className="block truncate">
                        Top: "{opportunity.communitySignals.topRedditTitle}"
                      </span>
                    )}
                  </div>
                </div>
              )}
              {opportunity.communitySignals.xPosts > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Hash size={12} className="text-sky-500" />
                      <span className="text-[11px] font-medium text-slate-700">X/Twitter</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {opportunity.communitySignals.topXScore}/100
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {opportunity.communitySignals.xPosts} posts
                    {opportunity.communitySignals.topXPreview && (
                      <span className="block truncate">
                        Top: "{opportunity.communitySignals.topXPreview}"
                      </span>
                    )}
                  </div>
                </div>
              )}
              {opportunity.communitySignals.webArticles > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe size={12} className="text-emerald-500" />
                    <span className="text-[11px] font-medium text-slate-700">Web</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {opportunity.communitySignals.webArticles} articles
                  </span>
                </div>
              )}
              {opportunity.communitySignals.redditThreads === 0 &&
                opportunity.communitySignals.xPosts === 0 &&
                opportunity.communitySignals.webArticles === 0 && (
                  <p className="text-[11px] text-slate-400">No community signals for this topic.</p>
                )}
            </div>
          </div>

          {/* Dimension Quick Scores */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              Dimension Scores
            </h3>
            <div className="space-y-2">
              {[...opportunity.dimensions]
                .sort((a, b) => b.score - a.score)
                .map((d) => {
                  const meta = DIMENSION_META[d.dimension];
                  return (
                    <div key={d.dimension} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta?.color ?? "#94a3b8" }}
                      />
                      <span className="text-[11px] text-slate-600 flex-1 truncate">
                        {meta?.label ?? d.dimension}
                      </span>
                      <span className="text-[11px] font-bold text-slate-800">{d.score}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================
// Main OpportunitiesView
// ============================

type OpportunitiesViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const [selectedOpp, setSelectedOpp] = useState<ContentOpportunity | null>(null);
  const [sortBy, setSortBy] = useState("overallScore");
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterAudience, setFilterAudience] = useState<string | null>(null);

  const { data, isLoading } = useQuery<OpportunitiesResponse>({
    queryKey: ["opportunities"],
    queryFn: () => fetch("/api/opportunities").then((r) => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch("/api/opportunities/generate", { method: "POST" }).then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(new Error(e.error)));
        return r.json();
      }),
    onSuccess: (result: OpportunitiesResponse) => {
      queryClient.setQueryData(["opportunities"], result);
    },
  });

  // If showing detail view
  if (selectedOpp) {
    return <OpportunityDetail opportunity={selectedOpp} onBack={() => setSelectedOpp(null)} />;
  }

  const opportunities = data?.opportunities ?? [];
  const summary = data?.dataSourceSummary;
  const warnings = data?.staleWarnings ?? [];

  // Sort
  const sorted = [...opportunities].sort((a, b) => {
    if (sortBy === "overallScore") return b.overallScore - a.overallScore;
    const aDim = a.dimensions.find((d) => d.dimension === sortBy);
    const bDim = b.dimensions.find((d) => d.dimension === sortBy);
    return (bDim?.score ?? 0) - (aDim?.score ?? 0);
  });

  // Filter
  const filtered = sorted.filter((opp) => {
    if (filterFormat && opp.suggestedFormat !== filterFormat) return false;
    if (filterPlatform && opp.targetPlatform !== filterPlatform) return false;
    if (filterAudience && opp.targetAudience !== filterAudience) return false;
    return true;
  });

  // Unique values for filters
  const uniqueFormats = [...new Set(opportunities.map((o) => o.suggestedFormat))];
  const uniquePlatforms = [...new Set(opportunities.map((o) => o.targetPlatform))];
  const uniqueAudiences = [...new Set(opportunities.map((o) => o.targetAudience))];

  // Time since generation
  const generatedAgo = data?.generatedAt
    ? (() => {
        const mins = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.round(hrs / 24)}d ago`;
      })()
    : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Opportunities</h1>
          <p className="text-xs text-slate-500 mt-1">
            AI-scored content opportunities ranked by potential impact
            {generatedAgo && (
              <span className="text-slate-400 ml-2">Generated {generatedAgo}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors shrink-0",
            generateMutation.isPending
              ? "bg-slate-100 text-slate-400 cursor-wait"
              : "bg-teal-600 text-white hover:bg-teal-700",
          )}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <Sparkles size={14} /> Generate Opportunities
            </>
          )}
        </button>
      </div>

      {/* Data source badges */}
      {summary && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {summary.hasDigest && (
            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
              Market Intel
            </span>
          )}
          {summary.xPosts > 0 && (
            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
              {summary.xPosts} X Posts
            </span>
          )}
          {summary.redditThreads > 0 && (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
              {summary.redditThreads} Reddit
            </span>
          )}
          {summary.webResults > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              {summary.webResults} Web
            </span>
          )}
          {(summary.instagramResults ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full">
              {summary.instagramResults} IG
            </span>
          )}
          {(summary.tiktokResults ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
              {summary.tiktokResults} TikTok
            </span>
          )}
          {(summary.facebookResults ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              {summary.facebookResults} FB
            </span>
          )}
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {summary.hookPatterns} Hooks
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {summary.existingVideos} Videos
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {summary.ideasInBank} Ideas
          </span>
        </div>
      )}

      {/* Stale warnings */}
      {warnings.length > 0 && opportunities.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">
                  {w}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generation error */}
      {generateMutation.isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4">
          <p className="text-xs text-rose-700">
            {generateMutation.error instanceof Error
              ? generateMutation.error.message
              : "Failed to generate opportunities"}
          </p>
        </div>
      )}

      {/* Generating state */}
      {generateMutation.isPending && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mb-4">
          <Loader2 size={32} className="animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-700">Analyzing data sources...</p>
          <p className="text-xs text-slate-500 mt-1">
            Cross-referencing research, hooks, and content library
          </p>
        </div>
      )}

      {/* Sort + Filter controls */}
      {opportunities.length > 0 && !generateMutation.isPending && <FeatureHint id="opportunity-dims" content={FEATURE_HINTS["opportunity-dims"].content} side="bottom"><span className="text-[10px] text-slate-400 mb-1 block">Tap any opportunity to see the full 7-dimension breakdown</span></FeatureHint>}
      {opportunities.length > 0 && !generateMutation.isPending && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-full px-3 py-1.5 pr-8 text-[11px] font-bold text-slate-600 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* Format filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterFormat(null)}
              className={cn(
                "text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors",
                filterFormat === null
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              )}
            >
              All Formats
            </button>
            {uniqueFormats.map((f) => (
              <button
                key={f}
                onClick={() => setFilterFormat(filterFormat === f ? null : f)}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors",
                  filterFormat === f
                    ? "text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                )}
                style={filterFormat === f ? { backgroundColor: FORMAT_COLORS[f] ?? "#94a3b8" } : {}}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Platform filter */}
          {uniquePlatforms.length > 1 && (
            <div className="flex items-center gap-1.5">
              {uniquePlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPlatform(filterPlatform === p ? null : p)}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors",
                    filterPlatform === p
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                >
                  {formatPlatformName(p)}
                </button>
              ))}
            </div>
          )}

          {/* Audience filter */}
          {uniqueAudiences.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Audience:</span>
              {uniqueAudiences.map((a) => (
                <button
                  key={a}
                  onClick={() => setFilterAudience(filterAudience === a ? null : a)}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors",
                    filterAudience === a
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Opportunity cards */}
      {!generateMutation.isPending && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !generateMutation.isPending && opportunities.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Radar size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="font-serif font-bold text-lg text-slate-900 mb-2">
            Discover Content Opportunities
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click "Generate Opportunities" to analyze your research data, hook library, and content
            library. The AI will score and rank the best content topics to create next.
          </p>
        </div>
      )}

      {/* Stale warnings below results */}
      {warnings.length > 0 && opportunities.length > 0 && (
        <div className="mt-4 flex items-start gap-2 text-[11px] text-amber-600">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>{warnings.join(" ")}</div>
        </div>
      )}

      {/* Generated timestamp */}
      {data?.generatedAt && opportunities.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-3 text-center">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}

      {/* Workflow CTA */}
      {onNavigate && opportunities.length >= 5 && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("CALENDAR")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Plan This Week's Content</span>
              <span className="block text-xs text-teal-600 mt-0.5">Turn these insights into your content calendar</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.OPPORTUNITIES} />
    </div>
  );
};
