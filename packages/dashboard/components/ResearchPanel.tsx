import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, AlertCircle, Plus, Check, TrendingUp, Users, ChevronDown, ChevronUp, Target, Copy, Clock, Zap, Download, History } from "lucide-react";
import { cn } from "../utils/cn.js";
import type { ViralScoutResult, CompetitorResearchResult } from "../shared/types.js";

type ResearchPanelProps = {
  open: boolean;
  onClose: () => void;
  type: "viral-scout" | "competitor-research" | null;
};

const LOADING_MESSAGES: Record<"viral-scout" | "competitor-research", string[]> = {
  "viral-scout": [
    "Scanning TikTok for viral mechanics...",
    "Analyzing Instagram Reels hook patterns...",
    "Measuring YouTube Shorts shelf life signals...",
    "Extracting what's working this week...",
    "Identifying trend windows closing soon...",
    "Writing your field report...",
  ],
  "competitor-research": [
    "Mapping the competitive landscape...",
    "Identifying unclaimed content territory...",
    "Profiling key creators in the niche...",
    "Locating positioning gaps...",
    "Building creator dossiers...",
    "Compiling your war room briefing...",
  ],
};

const FORMAT_NAMES: Record<string, string> = {
  A: "Explainer", B: "Checklist", C: "Demo", D: "Myth Buster",
  E: "Walkthrough", F: "Quick Tip", G: "Patient Story",
};

const FORMAT_COLORS: Record<string, string> = {
  A: "border-l-teal-500", B: "border-l-emerald-500", C: "border-l-sky-500",
  D: "border-l-rose-500", E: "border-l-violet-500", F: "border-l-orange-500", G: "border-l-pink-500",
};

const PLATFORM_BADGE: Record<string, string> = {
  TikTok: "bg-slate-900 text-white",
  Instagram: "bg-rose-500 text-white",
  YouTube: "bg-red-500 text-white",
};

const TREND_DOT: Record<string, string> = {
  emerging: "bg-emerald-500",
  peak: "bg-amber-400",
  cooling: "bg-rose-400",
};

const TREND_LABEL: Record<string, string> = {
  emerging: "Emerging",
  peak: "Peak",
  cooling: "Cooling",
};

const TREND_TEXT: Record<string, string> = {
  emerging: "text-emerald-600",
  peak: "text-amber-600",
  cooling: "text-rose-600",
};

export const ResearchPanel: React.FC<ResearchPanelProps> = ({ open, onClose, type }) => {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ViralScoutResult | CompetitorResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [addedIdeas, setAddedIdeas] = useState<Set<string>>(new Set());
  const [addedCreators, setAddedCreators] = useState<Set<string>>(new Set());
  const [expandedRadarPills, setExpandedRadarPills] = useState<Set<number>>(new Set());
  const [copiedHooks, setCopiedHooks] = useState<Set<number>>(new Set());

  const [savedId, setSavedId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isLoading = !result && !error;
  const abortRef = useRef<AbortController | null>(null);
  const [progressChars, setProgressChars] = useState(0);

  const isViralScout = type === "viral-scout";
  const vsResult = isViralScout ? (result as ViralScoutResult | null) : null;
  const crResult = !isViralScout ? (result as CompetitorResearchResult | null) : null;

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset and kick off research when panel opens
  useEffect(() => {
    if (open && type) {
      setResult(null);
      setError(null);
      setElapsedSec(0);
      setProgressChars(0);
      setSavedId(null);
      setMsgIndex(0);
      setAddedIdeas(new Set());
      setAddedCreators(new Set());
      setExpandedRadarPills(new Set());
      setCopiedHooks(new Set());
      runResearch(type);
    } else if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setHistoryOpen(false);
    }
  }, [open, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed counter
  useEffect(() => {
    if (!open || !isLoading) return;
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [open, isLoading]);

  // Rotate loading messages
  useEffect(() => {
    if (!open || !isLoading || !type) return;
    const msgs = LOADING_MESSAGES[type];
    const interval = setInterval(() => setMsgIndex((i) => (i + 1) % msgs.length), 3500);
    return () => clearInterval(interval);
  }, [open, isLoading, type]);

  const runResearch = useCallback(async (researchType: "viral-scout" | "competitor-research") => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    // Absolute backstop: if SSE never delivers a result (true server hang)
    const backstopTimer = setTimeout(() => {
      setError("Research is taking longer than expected. Please try again.");
    }, 120_000);

    try {
      const response = await fetch(`/api/research/${researchType}`, {
        method: "POST",
        signal: abort.signal,
      });

      // Handle non-SSE error responses (503 = no API key, etc.)
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
        throw new Error((body as { error?: string }).error || "Research failed");
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; chars?: number; data?: ViralScoutResult | CompetitorResearchResult; message?: string };
          try {
            event = JSON.parse(raw) as typeof event;
          } catch {
            continue; // skip malformed SSE lines
          }

          if (event.type === "progress" && event.chars) {
            setProgressChars(event.chars);
          } else if (event.type === "result" && event.data) {
            clearTimeout(backstopTimer);
            setResult(event.data);
            // Auto-save to SQLite
            fetch("/api/research/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: researchType, data: event.data }),
            }).then((r) => r.json()).then((body: { id?: number }) => {
              if (body.id) setSavedId(body.id);
            }).catch(() => {});
            return;
          } else if (event.type === "error") {
            throw new Error(event.message || "Research failed");
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Research failed";
      setError(msg);
    } finally {
      clearTimeout(backstopTimer);
    }
  }, []);

  const { data: historyList } = useQuery({
    queryKey: ["research-history", type],
    queryFn: async () => {
      const r = await fetch(`/api/research/history?type=${type}&limit=10`);
      return r.json() as Promise<Array<{ id: number; type: string; created_at: string }>>;
    },
    enabled: historyOpen && !!type,
  });

  const loadPastReport = useCallback(async (id: number) => {
    const r = await fetch(`/api/research/report/${id}`);
    const body = await r.json() as { data: ViralScoutResult | CompetitorResearchResult };
    setResult(body.data);
    setSavedId(id);
    setHistoryOpen(false);
  }, []);

  // Viral Scout: add weeklySteal item as idea
  const addStealMutation = useMutation({
    mutationFn: async (steal: ViralScoutResult["weeklySteal"][0]) => {
      const r = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: steal.videoTitle,
            suggestedFormat: steal.format,
            hookAngle: steal.hook,
            priority: "high",
            source: "Viral Scout — Weekly Steal",
            category: "trending",
          }],
        }),
      });
      if (!r.ok) throw new Error("Failed to add idea");
      return steal.videoTitle;
    },
    onSuccess: (title) => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      setAddedIdeas((prev) => new Set([...prev, title]));
    },
  });

  // Competitor Research: add creator dossier to watchlist
  const addToWatchlistMutation = useMutation({
    mutationFn: async (dossier: CompetitorResearchResult["creatorDossiers"][0]) => {
      const r = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: dossier.handle,
          platform: dossier.platform,
          followers: "Unknown",
          whyTracking: dossier.ourCounter,
          contentStyle: dossier.strength,
          frequency: "Unknown",
          section: "Health & Wellness Crossover",
        }),
      });
      if (!r.ok) throw new Error("Failed to add to watchlist");
      return dossier.handle;
    },
    onSuccess: (handle) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setAddedCreators((prev) => new Set([...prev, handle]));
    },
  });

  function generateMarkdown(): string {
    if (!result || !type) return "";
    const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const lines: string[] = [];

    if (type === "competitor-research") {
      const cr = result as CompetitorResearchResult;
      lines.push(`# Competitor Research — War Room Briefing\n*Generated: ${date}*\n`);
      lines.push(`## Summary\n\n${cr.summary}\n`);
      lines.push(`## Territory Map\n`);
      if (cr.territoryMap?.claim?.length) {
        lines.push(`### 🟢 CLAIM THIS\n`);
        cr.territoryMap.claim.forEach(t => {
          lines.push(`**${t.territory}**${t.seriesPotential ? " · Series" : ""} · Format ${t.format}\n`);
          lines.push(`*Why unclaimed:* ${t.whyUnclaimed}\n`);
          lines.push(`*Ownership angle:* ${t.ownershipAngle}\n\n---\n`);
        });
      }
      if (cr.territoryMap?.contest?.length) {
        lines.push(`### 🟡 CONTESTED\n`);
        cr.territoryMap.contest.forEach(t => {
          lines.push(`**${t.territory}**\n`);
          lines.push(`*Owned by:* ${t.whoOwnsIt}\n`);
          lines.push(`*Our differentiator:* ${t.ourDifferentiator}\n\n---\n`);
        });
      }
      if (cr.territoryMap?.avoid?.length) {
        lines.push(`### ⛔ AVOID — Oversaturated\n`);
        cr.territoryMap.avoid.forEach(t => {
          lines.push(`**${t.territory}**\n${t.why}\n\n---\n`);
        });
      }
      if (cr.positioningGaps?.length) {
        lines.push(`\n## Positioning Gaps\n`);
        cr.positioningGaps.forEach(g => {
          lines.push(`### ${g.gapName}\n**Time to own:** ${g.timeToOwn}\n`);
          lines.push(`${g.gapDescription}\n`);
          lines.push(`**Audience searches for:** "${g.audienceLanguage}"\n`);
          lines.push(`**Our play:** ${g.ourOwnershipPlay}\n`);
          if (g.whoMissesIt?.length) lines.push(`*Missing from:* ${g.whoMissesIt.join(", ")}\n`);
          lines.push(`\n---\n`);
        });
      }
      if (cr.creatorDossiers?.length) {
        lines.push(`\n## Creator Dossiers\n`);
        cr.creatorDossiers.forEach(d => {
          lines.push(`### ${d.handle} — ${d.platform}\n`);
          lines.push(`**Strength:** ${d.strength}\n`);
          lines.push(`**Blindspot:** ${d.blindspot}\n`);
          lines.push(`**Our move:** ${d.ourCounter}\n`);
          if (d.topicsTheyOwn?.length) lines.push(`*Topics they own:* ${d.topicsTheyOwn.join(", ")}`);
          if (d.topicsTheyIgnore?.length) lines.push(`*Topics they ignore:* ${d.topicsTheyIgnore.join(", ")}\n`);
          lines.push(`\n---\n`);
        });
      }
    } else {
      const vs = result as ViralScoutResult;
      lines.push(`# Viral Scout — Field Report\n*Generated: ${date}*\n`);
      lines.push(`## Summary\n\n${vs.summary}\n`);
      if (vs.reelTape?.length) {
        lines.push(`## Reel Tape — Field Observations\n`);
        vs.reelTape.forEach((item, i) => {
          lines.push(`### ${i + 1}. ${item.mechanic}\n**Platform:** ${item.platform} · **Format:** ${item.format} · **Time to execute:** ${item.timeToExecute}\n`);
          lines.push(`**What happens on screen:**\n${item.whatHappensOnScreen}\n`);
          lines.push(`**Hook:** "${item.hookText}"\n`);
          lines.push(`**Our version:** ${item.ourVersion}\n`);
          lines.push(`*Why it stops the scroll:* ${item.whyItStops}\n\n---\n`);
        });
      }
      if (vs.shelfLifeRadar?.length) {
        lines.push(`\n## Shelf Life Radar\n`);
        lines.push(`| Topic | Phase | Window | Audience | Best Platform |\n|-------|-------|---------|----------|---------------|`);
        vs.shelfLifeRadar.forEach(item => {
          lines.push(`| ${item.topic} | ${item.trendPhase} | ~${item.windowDays}d | ${item.audienceMatch} | ${item.platformBet} |`);
        });
        lines.push("");
        vs.shelfLifeRadar.forEach(item => {
          lines.push(`**${item.topic}** (${item.trendPhase}, ~${item.windowDays} days)\n*Signal:* ${item.signalSource}\n`);
        });
      }
      if (vs.weeklySteal?.length) {
        lines.push(`\n## This Week's Steal\n`);
        vs.weeklySteal.forEach((steal, i) => {
          lines.push(`### ${i + 1}. ${steal.videoTitle}\n**Platform:** ${steal.platform} · **Format:** ${steal.format} · **Runtime:** ${steal.estimatedRuntime}\n`);
          lines.push(`**Hook (first 3 seconds):** "${steal.hook}"\n`);
          lines.push(`**Structure:** ${steal.structure}\n`);
          lines.push(`*Why this week:* ${steal.whyThisWeek}\n\n---\n`);
        });
      }
    }
    return lines.join("\n");
  }

  function downloadReport() {
    if (!result || !type) return;
    const date = new Date().toISOString().split("T")[0];
    const filename = `${type}-${date}.md`;
    const blob = new Blob([generateMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyHook(text: string, index: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHooks((prev) => new Set([...prev, index]));
      setTimeout(() => setCopiedHooks((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      }), 2000);
    });
  }

  if (!open) return null;

  const msgs = type ? LOADING_MESSAGES[type] : [];
  const spinnerBorder = isViralScout ? "border-amber-100" : "border-violet-100";
  const spinnerTop = isViralScout ? "border-t-amber-500" : "border-t-violet-500";
  const IconComp = isViralScout ? TrendingUp : Target;
  const iconCls = isViralScout ? "text-amber-500" : "text-violet-500";
  const summaryBg = isViralScout ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-violet-50 border-violet-200 text-violet-800";
  const progressBg = isViralScout ? "bg-amber-500" : "bg-violet-500";

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[580px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <IconComp size={18} className={iconCls} />
            <h2 className="text-base font-bold text-slate-900">
              {isViralScout ? "Viral Scout" : "Competitor Research"}
            </h2>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full",
              isViralScout ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"
            )}>
              {isViralScout ? "Field Report" : "War Room"}
            </span>
            {isLoading && <span className="text-xs text-slate-400 font-mono ml-1">{elapsedSec}s</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryOpen((h) => !h)}
              title="Past reports"
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                historyOpen ? "text-teal-600 bg-teal-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <History size={16} />
            </button>
            {result && (
              <>
                {savedId && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mr-1">
                    <Check size={10} /> Saved
                  </span>
                )}
                <button
                  onClick={downloadReport}
                  title="Download as Markdown"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Download size={16} />
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* History panel */}
        {historyOpen && (
          <div className="border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="px-5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2.5">
                Saved Reports — {isViralScout ? "Viral Scout" : "Competitor Research"}
              </p>
              {!historyList ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <Loader2 size={12} className="animate-spin" /> Loading...
                </div>
              ) : historyList.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">No saved reports yet</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {historyList.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => loadPastReport(r.id)}
                      className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-slate-700">
                        {new Date(r.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(r.created_at + "Z").toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12">
              <div className="relative">
                <div className={cn("w-16 h-16 rounded-full border-4 animate-spin", spinnerBorder, spinnerTop)} />
                <IconComp size={22} className={cn("absolute inset-0 m-auto", iconCls)} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1">{msgs[msgIndex]}</p>
                <p className="text-xs text-slate-400">
                  {progressChars > 0
                    ? `Generating... (${progressChars >= 1000 ? `${(progressChars / 1000).toFixed(1)}k` : progressChars} chars)`
                    : "This may take 45-90 seconds"}
                </p>
              </div>
              <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5">
                <div
                  className={cn("h-1.5 rounded-full transition-all duration-1000", progressBg)}
                  style={{
                    width: `${progressChars > 0
                      ? Math.min(90, (progressChars / (isViralScout ? 5500 : 5000)) * 100)
                      : Math.min(10, (elapsedSec / 5) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-700">Research failed</p>
                  <p className="text-xs text-rose-600 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => { setError(null); setElapsedSec(0); setProgressChars(0); if (type) runResearch(type); }}
                className="self-start px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-full hover:bg-teal-700 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* ═══ VIRAL SCOUT RESULTS ═══ */}
          {vsResult && (
            <div className="p-5 flex flex-col gap-6">
              <div className={cn("p-4 border rounded-xl text-[11px] leading-relaxed font-medium", summaryBg)}>
                {vsResult.summary}
              </div>

              {/* Reel Tape */}
              {vsResult.reelTape?.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={13} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Reel Tape — Field Observations ({vsResult.reelTape.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {vsResult.reelTape.map((item, i) => (
                      <div key={i} className={cn("border-l-4 border border-slate-200 rounded-xl p-3 bg-white", FORMAT_COLORS[item.format] ?? "border-l-slate-300")}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-800">{item.mechanic}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PLATFORM_BADGE[item.platform] ?? "bg-slate-100 text-slate-600")}>
                              {item.platform}
                            </span>
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                              {item.format}
                            </span>
                          </div>
                        </div>
                        {/* What happens on screen — field note style */}
                        <p className="text-[10px] font-mono text-slate-500 leading-relaxed mb-2 bg-slate-50 rounded-lg px-2.5 py-2">{item.whatHappensOnScreen}</p>
                        {/* Hook with copy */}
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 shrink-0 mt-0.5">Hook</span>
                          <p className="text-[11px] text-slate-700 font-medium flex-1 leading-snug italic">"{item.hookText}"</p>
                          <button
                            onClick={() => copyHook(item.hookText, i)}
                            className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
                            title="Copy hook"
                          >
                            {copiedHooks.has(i)
                              ? <Check size={12} className="text-emerald-500" />
                              : <Copy size={12} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-teal-700 mb-2">
                          <span className="font-semibold">Our version:</span> {item.ourVersion}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Clock size={9} /> {item.timeToExecute}
                          </span>
                          <span className="text-[10px] text-slate-400 italic">{item.whyItStops}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Shelf Life Radar */}
              {vsResult.shelfLifeRadar?.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={13} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Shelf Life Radar ({vsResult.shelfLifeRadar.length} topics)
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {vsResult.shelfLifeRadar.map((item, i) => {
                      const expanded = expandedRadarPills.has(i);
                      return (
                        <div key={i}>
                          <button
                            onClick={() => setExpandedRadarPills((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                            className={cn(
                              "flex items-center gap-2 w-full px-3 py-2 rounded-xl border text-left transition-all",
                              expanded ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <span className={cn("w-2 h-2 rounded-full shrink-0", TREND_DOT[item.trendPhase] ?? "bg-slate-300")} />
                            <span className="text-[11px] font-semibold text-slate-700 flex-1">{item.topic}</span>
                            <span className={cn("text-[10px] font-bold", TREND_TEXT[item.trendPhase])}>{TREND_LABEL[item.trendPhase]}</span>
                            <span className="text-[10px] text-slate-400 font-mono">~{item.windowDays}d</span>
                            {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                          </button>
                          {expanded && (
                            <div className="ml-4 mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex flex-col gap-1.5">
                              <p><span className="font-semibold text-slate-700">Signal: </span>{item.signalSource}</p>
                              <p><span className="font-semibold text-slate-700">Audience: </span>{item.audienceMatch}</p>
                              <p><span className="font-semibold text-slate-700">Best platform now: </span>{item.platformBet}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* This Week's Steal */}
              {vsResult.weeklySteal?.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={13} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      This Week's Steal ({vsResult.weeklySteal.length} ready to film)
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {vsResult.weeklySteal.map((steal, i) => {
                      const added = addedIdeas.has(steal.videoTitle);
                      return (
                        <div key={i} className="border border-amber-200 rounded-xl p-4 bg-amber-50/40">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-xs font-bold text-slate-800 leading-snug">{steal.videoTitle}</p>
                            <button
                              onClick={() => !added && addStealMutation.mutate(steal)}
                              disabled={added || addStealMutation.isPending}
                              className={cn(
                                "shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors",
                                added ? "text-emerald-600 bg-emerald-50" : "text-amber-700 bg-amber-100 hover:bg-amber-200"
                              )}
                            >
                              {addStealMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : added ? <Check size={10} /> : <Plus size={10} />}
                              {added ? "Added" : "Add to Ideas"}
                            </button>
                          </div>
                          <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 mb-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-0.5">First 3 seconds</p>
                            <p className="text-[12px] font-semibold text-slate-800 leading-snug">"{steal.hook}"</p>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">{steal.structure}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                              Format {steal.format} — {FORMAT_NAMES[steal.format] ?? "Unknown"}
                            </span>
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PLATFORM_BADGE[steal.platform] ?? "bg-slate-100 text-slate-600")}>
                              {steal.platform}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{steal.estimatedRuntime}</span>
                          </div>
                          <p className="text-[10px] text-amber-700 mt-2 italic">{steal.whyThisWeek}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ═══ COMPETITOR RESEARCH RESULTS ═══ */}
          {crResult && (
            <div className="p-5 flex flex-col gap-6">
              <div className={cn("p-4 border rounded-xl text-[11px] leading-relaxed font-medium", summaryBg)}>
                {crResult.summary}
              </div>

              {/* Territory Map */}
              {crResult.territoryMap && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={13} className="text-violet-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Territory Map</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {/* CLAIM */}
                    {crResult.territoryMap.claim?.length > 0 && (
                      <div className="rounded-xl overflow-hidden border border-emerald-200">
                        <div className="bg-emerald-600 px-4 py-2 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Claim This</span>
                          <span className="text-[10px] text-emerald-200">{crResult.territoryMap.claim.length} territories open</span>
                        </div>
                        <div className="flex flex-col divide-y divide-emerald-100">
                          {crResult.territoryMap.claim.map((item, i) => (
                            <div key={i} className="p-3 bg-emerald-50">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-800">{item.territory}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {item.seriesPotential && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Series</span>
                                  )}
                                  <span className="text-[10px] font-bold text-teal-600 bg-white px-1.5 py-0.5 rounded">Format {item.format}</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 mb-1.5">{item.whyUnclaimed}</p>
                              <p className="text-[11px] text-emerald-700 font-medium">{item.ownershipAngle}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* CONTEST */}
                    {crResult.territoryMap.contest?.length > 0 && (
                      <div className="rounded-xl overflow-hidden border border-amber-200">
                        <div className="bg-amber-500 px-4 py-2 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Contested</span>
                          <span className="text-[10px] text-amber-100">{crResult.territoryMap.contest.length} territories</span>
                        </div>
                        <div className="flex flex-col divide-y divide-amber-100">
                          {crResult.territoryMap.contest.map((item, i) => (
                            <div key={i} className="p-3 bg-amber-50">
                              <span className="text-xs font-bold text-slate-800 block mb-0.5">{item.territory}</span>
                              <p className="text-[10px] text-slate-500 mb-1">Owned by: <span className="font-mono">{item.whoOwnsIt}</span></p>
                              <p className="text-[11px] text-teal-700 font-medium">{item.ourDifferentiator}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* AVOID */}
                    {crResult.territoryMap.avoid?.length > 0 && (
                      <div className="rounded-xl overflow-hidden border border-slate-300">
                        <div className="bg-slate-600 px-4 py-2 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Avoid — Oversaturated</span>
                          <span className="text-[10px] text-slate-300">{crResult.territoryMap.avoid.length} territories</span>
                        </div>
                        <div className="flex flex-col divide-y divide-slate-200">
                          {crResult.territoryMap.avoid.map((item, i) => (
                            <div key={i} className="p-3 bg-slate-100">
                              <span className="text-xs font-semibold text-slate-700 block mb-0.5">{item.territory}</span>
                              <p className="text-[11px] text-slate-500">{item.why}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Positioning Gaps */}
              {crResult.positioningGaps?.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={13} className="text-violet-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Positioning Gaps ({crResult.positioningGaps.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {crResult.positioningGaps.map((gap, i) => (
                      <div key={i} className="border-l-4 border-l-violet-500 border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-800">{gap.gapName}</span>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
                            gap.timeToOwn === "weeks" ? "text-emerald-700 bg-emerald-50" :
                            gap.timeToOwn === "months" ? "text-amber-700 bg-amber-50" :
                            "text-slate-600 bg-slate-100"
                          )}>
                            {gap.timeToOwn}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{gap.gapDescription}</p>
                        <div className="bg-slate-50 rounded-lg px-2.5 py-2 mb-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">They search for</p>
                          <p className="text-[11px] font-mono text-slate-600">"{gap.audienceLanguage}"</p>
                        </div>
                        <p className="text-[11px] text-violet-700 font-medium mb-2">{gap.ourOwnershipPlay}</p>
                        {gap.whoMissesIt?.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">Missing from:</span>
                            {gap.whoMissesIt.map((handle, j) => (
                              <span key={j} className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{handle}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Creator Dossiers */}
              {crResult.creatorDossiers?.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={13} className="text-violet-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Creator Dossiers ({crResult.creatorDossiers.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {crResult.creatorDossiers.map((dossier, i) => {
                      const added = addedCreators.has(dossier.handle);
                      return (
                        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{dossier.handle}</span>
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PLATFORM_BADGE[dossier.platform] ?? "bg-slate-100 text-slate-600")}>
                                {dossier.platform}
                              </span>
                            </div>
                            {dossier.addToWatchlist !== false && (
                              <button
                                onClick={() => !added && addToWatchlistMutation.mutate(dossier)}
                                disabled={added || addToWatchlistMutation.isPending}
                                className={cn(
                                  "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors",
                                  added ? "text-emerald-600 bg-emerald-50" : "text-violet-600 bg-violet-50 hover:bg-violet-100"
                                )}
                              >
                                {addToWatchlistMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : added ? <Check size={10} /> : <Plus size={10} />}
                                {added ? "Added" : "Add to Watchlist"}
                              </button>
                            )}
                          </div>
                          <div className="p-3 flex flex-col gap-2">
                            <p className="text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">Strength: </span>{dossier.strength}
                            </p>
                            <div className="bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-0.5">Blindspot</p>
                              <p className="text-[11px] text-rose-700">{dossier.blindspot}</p>
                            </div>
                            <div className="bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-teal-500 mb-0.5">Our Move</p>
                              <p className="text-[11px] text-teal-700">{dossier.ourCounter}</p>
                            </div>
                            {dossier.topicsTheyOwn?.length > 0 && (
                              <div>
                                <p className="text-[10px] text-slate-400 mb-1">Owns:</p>
                                <div className="flex flex-wrap gap-1">
                                  {dossier.topicsTheyOwn.map((t, j) => (
                                    <span key={j} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dossier.topicsTheyIgnore?.length > 0 && (
                              <div>
                                <p className="text-[10px] text-slate-400 mb-1">Ignores:</p>
                                <div className="flex flex-wrap gap-1">
                                  {dossier.topicsTheyIgnore.map((t, j) => (
                                    <span key={j} className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
