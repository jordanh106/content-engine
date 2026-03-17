import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  Loader2,
  Save,
  Trophy,
  Activity,
} from "lucide-react";
import type {
  DashboardView,
  PatternAnalysisResponse,
  StrategyAnalysisResponse,
  StrategyFinding,
  StrategyFindingVerdict,
  HookPatternStat,
} from "../shared/types.js";
import { HOOK_PATTERN_LABELS } from "../shared/types.js";

type Props = { onNavigate?: (view: DashboardView) => void };

const PLATFORMS = ["Instagram", "TikTok", "YouTube"];

const FORMAT_COLORS: Record<string, string> = {
  A: "#0d9488",
  B: "#10b981",
  C: "#0ea5e9",
  D: "#f43f5e",
  E: "#8b5cf6",
  F: "#f97316",
  G: "#ec4899",
};

const FORMAT_NAMES: Record<string, string> = {
  A: "Explainer",
  B: "Checklist",
  C: "Demo",
  D: "Myth Buster",
  E: "Walkthrough",
  F: "Quick Tip",
  G: "Patient Story",
};

const VERDICT_CONFIG: Record<StrategyFindingVerdict, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  KEEP:        { label: "Keep",        color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <CheckCircle2 size={16} className="text-emerald-600" /> },
  PROMOTE:     { label: "Promote",     color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <ArrowUpRight size={16} className="text-amber-600" /> },
  DEMOTE:      { label: "Demote",      color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <XCircle size={16} className="text-rose-600" /> },
  INVESTIGATE: { label: "Investigate", color: "text-slate-600",   bg: "bg-slate-50",    border: "border-slate-200",   icon: <HelpCircle size={16} className="text-slate-500" /> },
};

function confidenceLabel(c: HookPatternStat["confidence"]) {
  return c === "high" ? "●●●" : c === "medium" ? "●●○" : "●○○";
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export const PerformanceReviewView: React.FC<Props> = ({ onNavigate: _onNavigate }) => {
  const [aiResult, setAiResult] = useState<StrategyAnalysisResponse | null>(null);
  const [savedToLog, setSavedToLog] = useState(false);

  const { data, isLoading, isError } = useQuery<PatternAnalysisResponse>({
    queryKey: ["pattern-analysis"],
    queryFn: async () => {
      const res = await fetch("/api/metrics/pattern-analysis");
      if (!res.ok) throw new Error("Failed to fetch pattern analysis");
      return res.json();
    },
    staleTime: 60_000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/metrics/strategy-analysis", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Analysis failed");
      }
      return res.json() as Promise<StrategyAnalysisResponse>;
    },
    onSuccess: (result) => {
      setAiResult(result);
      setSavedToLog(false);
    },
  });

  const logMutation = useMutation({
    mutationFn: async (analysis: StrategyAnalysisResponse) => {
      const res = await fetch("/api/metrics/strategy-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings: analysis.findings, summary: analysis.summary }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => setSavedToLog(true),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-teal-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-rose-600 text-sm">Failed to load pattern analysis. Check server logs.</div>
    );
  }

  const { hookPatterns, byFormat, coverage, topOutliers, avgWeightedEngagement, dataRange } = data;

  // Build hook matrix: hookPattern → platform → stat
  const hookMatrix = new Map<string, Map<string, HookPatternStat>>();
  for (const stat of hookPatterns) {
    if (!hookMatrix.has(stat.hookPattern)) hookMatrix.set(stat.hookPattern, new Map());
    hookMatrix.get(stat.hookPattern)!.set(stat.platform, stat);
  }
  const matrixRows = Array.from(hookMatrix.entries()).sort((a, b) => {
    const aMax = Math.max(...Array.from(a[1].values()).map((s) => s.weightedEngagement));
    const bMax = Math.max(...Array.from(b[1].values()).map((s) => s.weightedEngagement));
    return bMax - aMax;
  });

  // Format bar chart data
  const formatChartData = byFormat
    .reduce((acc, f) => {
      const existing = acc.find((r) => r.formatId === f.formatId);
      if (existing) {
        existing[f.platform] = parseFloat((f.avgSaveRate * 100).toFixed(1));
      } else {
        acc.push({ formatId: f.formatId, name: `${f.formatId} – ${FORMAT_NAMES[f.formatId] ?? ""}`, [f.platform]: parseFloat((f.avgSaveRate * 100).toFixed(1)) });
      }
      return acc;
    }, [] as Array<Record<string, string | number>>)
    .sort((a, b) => String(a.formatId).localeCompare(String(b.formatId)));

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Strategy</h1>
        <p className="text-sm text-slate-500 mt-0.5">Performance patterns by hook type, format, and platform</p>
      </div>

      {/* Coverage Banner */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${coverage.hookCoveragePct < 30 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
        <Activity size={18} className={coverage.hookCoveragePct < 30 ? "text-amber-600 mt-0.5 shrink-0" : "text-teal-600 mt-0.5 shrink-0"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {coverage.totalVideos} metric {coverage.totalVideos === 1 ? "entry" : "entries"} analyzed
            {" · "}Hook coverage: {coverage.hookCoveragePct}%
            {" · "}Format coverage: {coverage.formatCoveragePct}%
          </p>
          {dataRange && (
            <p className="text-xs text-slate-500 mt-0.5">{dataRange.earliest} → {dataRange.latest} ({dataRange.days} days)</p>
          )}
          {coverage.hookCoveragePct < 30 && (
            <p className="text-xs text-amber-700 mt-1">Tag metric entries with hook pattern to improve coverage. Use the entry form in Metrics.</p>
          )}
        </div>
        {coverage.totalVideos > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Score</p>
            <p className="text-lg font-bold text-teal-700">{pct(avgWeightedEngagement)}</p>
          </div>
        )}
      </div>

      {/* Hook Pattern Matrix */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Hook Pattern Performance</h2>
        {matrixRows.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Brain size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hook pattern data yet.</p>
            <p className="text-xs mt-1">Tag metric entries with hookPatternUsed to populate this table.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-2 pr-4">Pattern</th>
                  {PLATFORMS.map((p) => (
                    <th key={p} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 pb-2 px-3 min-w-[90px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {matrixRows.map(([pattern, platformMap]) => {
                  const label = HOOK_PATTERN_LABELS[pattern as keyof typeof HOOK_PATTERN_LABELS] ?? pattern;
                  return (
                    <tr key={pattern} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">{label}</td>
                      {PLATFORMS.map((platform) => {
                        const stat = platformMap.get(platform) ?? platformMap.get(platform.toLowerCase()) ?? null;
                        if (!stat) {
                          return (
                            <td key={platform} className="py-2.5 px-3 text-center text-slate-300 text-xs">—</td>
                          );
                        }
                        const score = stat.weightedEngagement;
                        const isAboveAvg = score > avgWeightedEngagement;
                        return (
                          <td key={platform} className="py-2.5 px-3 text-center">
                            <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg ${isAboveAvg ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
                              <span className="font-bold text-sm">{pct(score)}</span>
                              <span className="text-[9px] font-black uppercase tracking-wider opacity-60">{confidenceLabel(stat.confidence)} n={stat.videoCount}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-3">Score = 0.4 × save rate + 0.3 × share rate + 0.3 × comment rate. Green = above average.</p>
          </div>
        )}
      </div>

      {/* Format Performance Bar Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Format Performance (Save Rate %)</h2>
        {formatChartData.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No format data yet. Add metrics entries to see format performance.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={formatChartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" width={36} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                formatter={(value, name) => [`${value}%`, name]}
              />
              {PLATFORMS.map((platform, i) => (
                <Bar key={platform} dataKey={platform} name={platform} radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {formatChartData.map((entry) => (
                    <Cell
                      key={entry.formatId as string}
                      fill={FORMAT_COLORS[entry.formatId as string] ?? "#94a3b8"}
                      opacity={i === 0 ? 1 : i === 1 ? 0.65 : 0.4}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Outlier Videos */}
      {topOutliers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Top Outliers by Save Rate</h2>
          <div className="space-y-2">
            {topOutliers.map((v, i) => (
              <div key={`${v.videoCode}-${v.platform}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{v.videoCode}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{v.platform}</span>
                    {v.hookPatternUsed && (
                      <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                        {HOOK_PATTERN_LABELS[v.hookPatternUsed as keyof typeof HOOK_PATTERN_LABELS] ?? v.hookPatternUsed}
                      </span>
                    )}
                    {v.formatId && (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Format {v.formatId}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{v.views.toLocaleString()} views · {v.saves.toLocaleString()} saves</p>
                </div>
                <div className="text-right shrink-0">
                  <Trophy size={12} className="text-amber-500 mx-auto mb-0.5" />
                  <p className="font-bold text-emerald-700 text-sm">{pct(v.saveRate)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Analysis AI Button */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">AI Strategy Analysis</h2>
            <p className="text-xs text-slate-500 mt-1">Compare your performance data against hook-patterns.md. Get KEEP / PROMOTE / DEMOTE recommendations.</p>
          </div>
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || coverage.totalVideos === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-xs font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {analyzeMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" />Analyzing...</>
            ) : (
              <><Brain size={14} />Analyze Strategy</>
            )}
          </button>
        </div>

        {coverage.totalVideos === 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle size={14} className="shrink-0" />
            No metric entries yet. Add some in the Metrics view first.
          </div>
        )}

        {analyzeMutation.isError && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            <AlertTriangle size={14} className="shrink-0" />
            {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : "Analysis failed"}
          </div>
        )}

        {aiResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{aiResult.summary}</p>
            </div>

            {/* Findings grouped by verdict */}
            {(["PROMOTE", "KEEP", "DEMOTE", "INVESTIGATE"] as StrategyFindingVerdict[]).map((verdict) => {
              const group = aiResult.findings.filter((f) => f.verdict === verdict);
              if (group.length === 0) return null;
              const cfg = VERDICT_CONFIG[verdict];
              return (
                <div key={verdict}>
                  <div className="flex items-center gap-2 mb-2">
                    {cfg.icon}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400">({group.length})</span>
                  </div>
                  <div className="space-y-2">
                    {group.map((f: StrategyFinding, i: number) => (
                      <div key={i} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm ${cfg.color}`}>
                                {HOOK_PATTERN_LABELS[f.hookPattern as keyof typeof HOOK_PATTERN_LABELS] ?? f.hookPattern}
                              </span>
                              <span className="text-[10px] text-slate-500">{f.platform}</span>
                              <span className="text-[10px] text-slate-400">{f.confidence}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{f.evidence}</p>
                            <p className="text-xs text-slate-700 mt-1.5 font-medium">{f.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Save to log button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => logMutation.mutate(aiResult)}
                disabled={logMutation.isPending || savedToLog}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" />Saving...</>
                ) : savedToLog ? (
                  <><CheckCircle2 size={14} />Saved to Results</>
                ) : (
                  <><Save size={14} />Save to Strategy Log</>
                )}
              </button>
              <span className="text-xs text-slate-400">{new Date(aiResult.generatedAt).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
