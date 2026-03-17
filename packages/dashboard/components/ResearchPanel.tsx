import React, { useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Radar, Loader2, AlertCircle, Plus, Check, TrendingUp, Lightbulb, Users, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utils/cn.js";
import type { ResearchResult } from "../shared/types.js";

type ResearchPanelProps = {
  open: boolean;
  onClose: () => void;
  type: "viral-scout" | "competitor-research" | null;
};

const LOADING_MESSAGES: Record<"viral-scout" | "competitor-research", string[]> = {
  "viral-scout": [
    "Searching TikTok for viral chiropractic content...",
    "Scanning Instagram Reels for trending hooks...",
    "Analyzing YouTube Shorts performance...",
    "Extracting top hook patterns...",
    "Identifying content gaps...",
    "Generating actionable ideas...",
  ],
  "competitor-research": [
    "Researching chiropractic creators...",
    "Scanning prenatal/pediatric content space...",
    "Analyzing local competitor social presence...",
    "Identifying rising creators in the niche...",
    "Spotting content gaps competitors miss...",
    "Compiling competitive intelligence...",
  ],
};

const FORMAT_NAMES: Record<string, string> = {
  A: "Explainer", B: "Checklist", C: "Demo", D: "Myth Buster",
  E: "Walkthrough", F: "Quick Tip", G: "Patient Story",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-rose-600 bg-rose-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-slate-500 bg-slate-100",
};

export const ResearchPanel: React.FC<ResearchPanelProps> = ({ open, onClose, type }) => {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [addedIdeas, setAddedIdeas] = useState<Set<string>>(new Set());
  const [addedCreators, setAddedCreators] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState({ patterns: true, hotspots: true, ideas: true, watchlist: true });

  const isLoading = !result && !error;

  // Escape key + body scroll
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset state when panel opens with a new type
  useEffect(() => {
    if (open && type) {
      setResult(null);
      setError(null);
      setElapsedSec(0);
      setMsgIndex(0);
      setAddedIdeas(new Set());
      setAddedCreators(new Set());
    }
  }, [open, type]);

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

  // Kick off research when panel opens
  const runResearch = useCallback(async (researchType: "viral-scout" | "competitor-research") => {
    try {
      const r = await fetch(`/api/research/${researchType}`, { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
        throw new Error((body as { error?: string }).error || `Research failed: ${r.status}`);
      }
      const data = await r.json() as ResearchResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    }
  }, []);

  useEffect(() => {
    if (open && type && isLoading) {
      runResearch(type);
    }
  }, [open, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const addIdeaMutation = useMutation({
    mutationFn: async (idea: ResearchResult["contentIdeas"][0]) => {
      const r = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: idea.topic,
            suggestedFormat: idea.format,
            hookAngle: idea.hookAngle,
            priority: idea.priority,
            source: type === "viral-scout" ? "Viral Scout" : "Competitor Research",
            category: type === "viral-scout" ? "trending" : "competitor",
          }],
        }),
      });
      if (!r.ok) throw new Error("Failed to add idea");
      return idea.topic;
    },
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      setAddedIdeas((prev) => new Set([...prev, topic]));
    },
  });

  const addAllIdeasMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const newIdeas = result.contentIdeas.filter((i) => !addedIdeas.has(i.topic));
      const r = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: newIdeas.map((i) => ({
            topic: i.topic,
            suggestedFormat: i.format,
            hookAngle: i.hookAngle,
            priority: i.priority,
            source: type === "viral-scout" ? "Viral Scout" : "Competitor Research",
            category: type === "viral-scout" ? "trending" : "competitor",
          })),
        }),
      });
      if (!r.ok) throw new Error("Failed to add ideas");
      return newIdeas.map((i) => i.topic);
    },
    onSuccess: (topics) => {
      if (!topics) return;
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      setAddedIdeas((prev) => new Set([...prev, ...topics]));
    },
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (suggestion: NonNullable<ResearchResult["watchlistSuggestions"]>[0]) => {
      const r = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: suggestion.handle,
          platform: suggestion.platform,
          followers: "Unknown",
          whyTracking: suggestion.why,
          contentStyle: "Unknown",
          frequency: "Unknown",
          section: "Health & Wellness Crossover",
        }),
      });
      if (!r.ok) throw new Error("Failed to add to watchlist");
      return suggestion.handle;
    },
    onSuccess: (handle) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setAddedCreators((prev) => new Set([...prev, handle]));
    },
  });

  if (!open) return null;

  const title = type === "viral-scout" ? "Viral Scout" : "Competitor Research";
  const msgs = type ? LOADING_MESSAGES[type] : [];

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/30 transition-opacity" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[560px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Radar size={18} className="text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {isLoading && (
              <span className="text-xs text-slate-400 font-mono">{elapsedSec}s</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-8 py-12">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-teal-100 border-t-teal-500 animate-spin" />
                <Radar size={22} className="text-teal-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1 transition-all">
                  {msgs[msgIndex]}
                </p>
                <p className="text-xs text-slate-400">This takes 30-60 seconds</p>
              </div>
              <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-teal-500 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(95, (elapsedSec / 60) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Error state */}
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
                onClick={() => { setError(null); if (type) runResearch(type); }}
                className="self-start px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-full hover:bg-teal-700 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="p-5 flex flex-col gap-5">
              {/* Summary */}
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                <p className="text-xs text-teal-700 leading-relaxed">{result.summary}</p>
              </div>

              {/* Patterns */}
              <section>
                <button
                  className="flex items-center justify-between w-full mb-3"
                  onClick={() => toggleSection("patterns")}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-teal-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Hook Patterns ({result.patterns.length})
                    </span>
                  </div>
                  {expandedSections.patterns ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
                {expandedSections.patterns && (
                  <div className="flex flex-col gap-2">
                    {result.patterns.map((p, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PRIORITY_COLORS[p.priority] ?? "text-slate-500 bg-slate-100")}>
                              {p.priority}
                            </span>
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{p.platform}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic mb-1.5">"{p.example}"</p>
                        <p className="text-[11px] text-teal-700">{p.ourAdaptation}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-slate-400">Format {p.formatMatch} — {FORMAT_NAMES[p.formatMatch] ?? "Unknown"}</span>
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] text-slate-400 capitalize">{p.hookType}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Topic Hotspots */}
              <section>
                <button
                  className="flex items-center justify-between w-full mb-3"
                  onClick={() => toggleSection("hotspots")}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Topic Hotspots ({result.topicHotspots.length})
                    </span>
                  </div>
                  {expandedSections.hotspots ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>
                {expandedSections.hotspots && (
                  <div className="flex flex-col gap-2">
                    {result.topicHotspots.map((h, i) => (
                      <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-800">{h.topic}</span>
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">{h.platform}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1">{h.whyHot}</p>
                        <p className="text-[11px] text-teal-700">Audience: {h.audienceMatch}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Content Ideas */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <button
                    className="flex items-center gap-2"
                    onClick={() => toggleSection("ideas")}
                  >
                    <Lightbulb size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Content Ideas ({result.contentIdeas.length})
                    </span>
                    {expandedSections.ideas ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>
                  {expandedSections.ideas && result.contentIdeas.some((i) => !addedIdeas.has(i.topic)) && (
                    <button
                      onClick={() => addAllIdeasMutation.mutate()}
                      disabled={addAllIdeasMutation.isPending}
                      className="text-[10px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors"
                    >
                      {addAllIdeasMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      Add All
                    </button>
                  )}
                </div>
                {expandedSections.ideas && (
                  <div className="flex flex-col gap-2">
                    {result.contentIdeas.map((idea, i) => {
                      const added = addedIdeas.has(idea.topic);
                      return (
                        <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 leading-snug mb-1">{idea.topic}</p>
                              <p className="text-[11px] text-slate-500 italic mb-2">"{idea.hookAngle}"</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                                  Format {idea.format} — {FORMAT_NAMES[idea.format] ?? "Unknown"}
                                </span>
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PRIORITY_COLORS[idea.priority] ?? "text-slate-500 bg-slate-100")}>
                                  {idea.priority}
                                </span>
                                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{idea.platform}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => !added && addIdeaMutation.mutate(idea)}
                              disabled={added || addIdeaMutation.isPending}
                              className={cn(
                                "shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors",
                                added
                                  ? "text-emerald-600 bg-emerald-50"
                                  : "text-teal-600 bg-teal-50 hover:bg-teal-100",
                              )}
                            >
                              {added ? <Check size={10} /> : <Plus size={10} />}
                              {added ? "Added" : "Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Watchlist Suggestions (competitor-research only) */}
              {result.watchlistSuggestions && result.watchlistSuggestions.length > 0 && (
                <section>
                  <button
                    className="flex items-center gap-2 mb-3 w-full"
                    onClick={() => toggleSection("watchlist")}
                  >
                    <Users size={14} className="text-violet-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Watchlist Suggestions ({result.watchlistSuggestions.length})
                    </span>
                    {expandedSections.watchlist ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>
                  {expandedSections.watchlist && (
                    <div className="flex flex-col gap-2">
                      {result.watchlistSuggestions.map((s, i) => {
                        const added = addedCreators.has(s.handle);
                        return (
                          <div key={i} className="border border-slate-200 rounded-xl p-3 bg-white">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-slate-800">{s.handle}</span>
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{s.platform}</span>
                                </div>
                                <p className="text-[11px] text-slate-500">{s.why}</p>
                              </div>
                              <button
                                onClick={() => !added && addToWatchlistMutation.mutate(s)}
                                disabled={added || addToWatchlistMutation.isPending}
                                className={cn(
                                  "shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors",
                                  added
                                    ? "text-emerald-600 bg-emerald-50"
                                    : "text-violet-600 bg-violet-50 hover:bg-violet-100",
                                )}
                              >
                                {added ? <Check size={10} /> : <Plus size={10} />}
                                {added ? "Added" : "Add"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
