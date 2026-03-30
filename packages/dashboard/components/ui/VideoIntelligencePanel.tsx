import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Zap,
  AlignLeft,
  Palette,
  Wand2,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Bookmark,
  PenTool,
  TrendingUp,
  Clock,
} from "lucide-react";
import { MetricBadge } from "./MetricBadge.js";
import type { CreatorVideo, VideoBreakdown } from "../../shared/types.js";
import { useQuest } from "../context/QuestContext.js";

type Tab = "summary" | "content" | "hook" | "transcript" | "visual" | "adapt";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "summary", label: "Summary", icon: <Sparkles size={14} /> },
  { key: "content", label: "Content", icon: <FileText size={14} /> },
  { key: "hook", label: "Hook Analysis", icon: <Zap size={14} /> },
  { key: "transcript", label: "Transcript", icon: <AlignLeft size={14} /> },
  { key: "visual", label: "Visual Style", icon: <Palette size={14} /> },
  { key: "adapt", label: "Adapt", icon: <Wand2 size={14} /> },
];

type VideoIntelligencePanelProps = {
  video: CreatorVideo;
  onCreateScript?: (hook: string, topic: string) => void;
  onClose: () => void;
};

export const VideoIntelligencePanel: React.FC<VideoIntelligencePanelProps> = ({
  video,
  onCreateScript,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { trackAction } = useQuest();
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Fetch the video breakdown
  const { data: breakdownData, isLoading } = useQuery<{ breakdown: VideoBreakdown | null }>({
    queryKey: ["video-breakdown", video.id],
    queryFn: () => fetch(`/api/creator-videos/${video.id}/breakdown`).then((r) => r.json()),
  });

  const breakdown = breakdownData?.breakdown;

  // AI Summary generation
  const summaryMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/creator-videos/${video.id}/summarize`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to generate summary");
      return r.json() as Promise<{ summary: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-breakdown", video.id] });
    },
  });

  // Quick action: Save hook to vault
  const saveHookMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/vault/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: breakdown?.hookFormat || "custom",
          example: breakdown?.oneSentenceConcept || video.videoTitle,
          source: `${video.creatorHandle} on ${video.platform}`,
          sourceUrl: video.videoUrl || undefined,
        }),
      });
      if (!r.ok) throw new Error("Failed to save hook");
      return r.json();
    },
    onSuccess: () => { showFeedback("Hook saved to Vault"); trackAction("save_hook_vault"); },
  });

  // Quick action: Shortlist as idea
  const shortlistMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${breakdown?.topic || video.videoTitle} (inspired by ${video.creatorHandle})`,
          sourceUrl: video.videoUrl || undefined,
        }),
      });
      if (!r.ok) throw new Error("Failed to shortlist");
      return r.json();
    },
    onSuccess: () => showFeedback("Added to Inspiration Inbox"),
  });

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface-elevated border border-themed rounded-2xl overflow-hidden">
      {/* Header with video info */}
      <div className="p-4 border-b border-themed flex items-start gap-4">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt={video.videoTitle || ""}
            className="w-20 h-28 object-cover rounded-xl shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-themed line-clamp-2">{video.videoTitle}</h3>
          <p className="text-[11px] text-themed-tertiary mt-1">{video.creatorHandle} on {video.platform}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {typeof video.views === "number" && video.views > 0 && (
              <MetricBadge type="views" value={video.views} />
            )}
            {typeof video.likes === "number" && video.likes > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-500/20 text-pink-400">
                {video.likes >= 1000 ? `${(video.likes / 1000).toFixed(1)}K` : video.likes} likes
              </span>
            )}
            {typeof video.saves === "number" && video.saves > 0 && (
              <MetricBadge type="saves" value={video.saves} />
            )}
            {video.outlierScoreX100 != null && video.outlierScoreX100 > 0 && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                video.outlierScoreX100 >= 500 ? "bg-emerald-500/20 text-emerald-400" :
                video.outlierScoreX100 >= 200 ? "bg-amber-500/20 text-amber-400" :
                "bg-slate-500/20 text-slate-400"
              }`}>
                <TrendingUp size={10} />
                {(video.outlierScoreX100 / 100).toFixed(1)}x
              </span>
            )}
          </div>
        </div>
        {video.videoUrl && video.videoUrl !== "unknown" && (
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener"
            className="shrink-0 p-2 rounded-lg text-themed-muted hover:text-blue-400 hover:bg-surface-hover transition-colors"
          >
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      {/* Your Notes */}
      <VideoNotes videoId={video.id} initialNotes={video.notes} />

      {/* Tab bar */}
      <div className="flex border-b border-themed overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-themed-muted hover:text-themed-secondary"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-blue-400 animate-spin" />
          </div>
        ) : !breakdown ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-themed-tertiary">No analysis available yet.</p>
            <p className="text-[11px] text-themed-muted">
              Use "Deep Analyze" in the Watchlist to run AI analysis on this video.
            </p>
          </div>
        ) : (
          <>
            {activeTab === "summary" && (
              <div className="space-y-4">
                {/* AI Summary */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Summary</h4>
                  {breakdown?.summary ? (
                    <p className="text-sm text-themed-secondary leading-relaxed">{breakdown.summary}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-themed-tertiary italic">No summary generated yet.</p>
                      <button
                        onClick={() => summaryMutation.mutate()}
                        disabled={summaryMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {summaryMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {summaryMutation.isPending ? "Generating..." : "Generate Summary"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Key insights at a glance */}
                {breakdown?.hookFormat && (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-bold">
                      <Zap size={10} /> {breakdown.hookFormat}
                    </span>
                    {breakdown.visualFormat && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-[11px] font-bold">
                        <Palette size={10} /> {breakdown.visualFormat}
                      </span>
                    )}
                  </div>
                )}

                {/* Core concept quote */}
                {breakdown?.oneSentenceConcept && (
                  <blockquote className="border-l-2 border-blue-500 pl-3 text-sm text-themed italic leading-relaxed">
                    "{breakdown.oneSentenceConcept}"
                  </blockquote>
                )}

                {/* Quick topic/angle if available */}
                {breakdown?.topic && (
                  <div className="bg-surface-hover rounded-xl p-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Topic</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.topic}</p>
                    {breakdown.angle && (
                      <>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1 mt-3">Angle</h4>
                        <p className="text-sm text-themed-secondary">{breakdown.angle}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "content" && (
              <div className="space-y-4">
                {breakdown.topic && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Topic</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.topic}</p>
                  </div>
                )}
                {breakdown.angle && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Angle</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.angle}</p>
                  </div>
                )}
                {breakdown.storyStyle && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Story Structure</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.storyStyle}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "hook" && (
              <div className="space-y-4">
                {breakdown.hookFormat && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Hook Type</h4>
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">
                      {breakdown.hookFormat}
                    </span>
                  </div>
                )}
                {breakdown.oneSentenceConcept && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Core Concept</h4>
                    <blockquote className="border-l-2 border-blue-500 pl-3 text-sm text-themed italic">
                      "{breakdown.oneSentenceConcept}"
                    </blockquote>
                  </div>
                )}
                {breakdown.storyStructure && (() => {
                  const ACTS: { key: string; label: string; color: string }[] = [
                    { key: "hook", label: "Hook", color: "border-rose-300 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30" },
                    { key: "conflict", label: "Conflict", color: "border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30" },
                    { key: "build", label: "Build", color: "border-sky-300 bg-sky-50 dark:bg-sky-500/10 dark:border-sky-500/30" },
                    { key: "resolution", label: "Resolution", color: "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30" },
                    { key: "cta", label: "CTA", color: "border-violet-300 bg-violet-50 dark:bg-violet-500/10 dark:border-violet-500/30" },
                  ];
                  let parsed: Record<string, { description?: string; timestamp?: string }> = {};
                  try { parsed = JSON.parse(breakdown.storyStructure); } catch { return null; }
                  const acts = ACTS.filter((a) => parsed[a.key]);
                  if (acts.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-2">Story Structure</h4>
                      <div className="space-y-1.5">
                        {acts.map((act) => {
                          const data = parsed[act.key];
                          return (
                            <div key={act.key} className={`border rounded-xl px-3 py-2 ${act.color}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-themed-secondary">{act.label}</span>
                                {data?.timestamp && (
                                  <span className="text-[9px] font-mono text-themed-muted flex items-center gap-0.5">
                                    <Clock size={8} /> {data.timestamp}
                                  </span>
                                )}
                              </div>
                              {data?.description && (
                                <p className="text-[11px] text-themed-secondary mt-1 leading-relaxed">{data.description}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "transcript" && (
              <div className="space-y-3">
                {breakdown.rawNotes ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Analysis Notes</h4>
                      <button
                        onClick={() => copyToClipboard(breakdown.rawNotes || "")}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="bg-surface-hover rounded-xl p-4 text-sm text-themed-secondary leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                      {breakdown.rawNotes}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-themed-tertiary">No transcript available. Run "Deep Analyze" to extract.</p>
                )}
              </div>
            )}

            {activeTab === "visual" && (
              <div className="space-y-4">
                {breakdown.visualFormat && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Visual Format</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.visualFormat}</p>
                  </div>
                )}
                {breakdown.visuals && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Visual Details</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.visuals}</p>
                  </div>
                )}
                {breakdown.audio && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Audio</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.audio}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "adapt" && (
              <AdaptTab
                video={video}
                breakdown={breakdown}
                onCreateScript={onCreateScript}
              />
            )}
          </>
        )}
      </div>

      {/* Quick Actions Bar (Sandcastles-style) */}
      {breakdown && (
        <div className="px-4 py-3 border-t border-themed">
          {actionFeedback && (
            <p className="text-[11px] font-bold text-emerald-400 mb-2 flex items-center gap-1">
              <Check size={12} /> {actionFeedback}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {onCreateScript && breakdown.oneSentenceConcept && (
              <button
                onClick={() => onCreateScript(breakdown.oneSentenceConcept || "", breakdown.topic || "")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[11px] font-bold hover:bg-teal-700 transition-colors"
              >
                <PenTool size={12} /> Create Script
              </button>
            )}
            <button
              onClick={() => saveHookMutation.mutate()}
              disabled={saveHookMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover text-themed-secondary text-[11px] font-bold hover:bg-amber-500/15 hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              <Bookmark size={12} /> Save Hook
            </button>
            <button
              onClick={() => shortlistMutation.mutate()}
              disabled={shortlistMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover text-themed-secondary text-[11px] font-bold hover:bg-violet-500/15 hover:text-violet-400 transition-colors disabled:opacity-50"
            >
              <Lightbulb size={12} /> Shortlist Idea
            </button>
            <button
              onClick={() => {
                const text = [
                  breakdown.topic && `Topic: ${breakdown.topic}`,
                  breakdown.angle && `Angle: ${breakdown.angle}`,
                  breakdown.hookFormat && `Hook: ${breakdown.hookFormat}`,
                  breakdown.oneSentenceConcept && `Concept: ${breakdown.oneSentenceConcept}`,
                  breakdown.storyStyle && `Structure: ${breakdown.storyStyle}`,
                ].filter(Boolean).join("\n");
                copyToClipboard(text);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover text-themed-secondary text-[11px] font-bold hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy Analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Editable Notes ──────────────────────────────────────────────────────────

const VideoNotes: React.FC<{ videoId: number; initialNotes: string | null }> = ({ videoId, initialNotes }) => {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes || "");
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/creator-videos/${videoId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="px-4 py-3 border-b border-themed">
      <div className="flex items-center gap-2 mb-1.5">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Your Notes</h4>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
            Edit
          </button>
        )}
        {saved && <span className="text-[10px] text-emerald-400 font-bold">Saved</span>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your notes about this video..."
            rows={3}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveMutation.mutate(notes)}
              disabled={saveMutation.isPending}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setNotes(initialNotes || ""); }}
              className="px-3 py-1 rounded-lg text-[10px] font-bold text-themed-muted hover:text-themed-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={`text-sm leading-relaxed ${notes ? "text-themed-secondary" : "text-themed-muted italic"}`}>
          {notes || "Add your notes about this video..."}
        </p>
      )}
    </div>
  );
};

// ─── Adapt Tab with AI Niche Adaptations ─────────────────────────────────────

type AdaptTabProps = {
  video: CreatorVideo;
  breakdown: VideoBreakdown;
  onCreateScript?: (hook: string, topic: string) => void;
};

type NicheAdaptation = {
  title: string;
  description: string;
  hook: string;
};

const AdaptTab: React.FC<AdaptTabProps> = ({ video, breakdown, onCreateScript }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Generate 3 niche-specific adaptation options
  const adaptMutation = useMutation({
    mutationFn: async () => {
      const topic = breakdown.topic || video.videoTitle || "";
      const hook = breakdown.oneSentenceConcept || breakdown.hookFormat || "";
      const angle = breakdown.angle || "";

      // Try the AI endpoint first
      try {
        const r = await fetch("/api/video-director/adapt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, hook, angle, originalTitle: video.videoTitle }),
        });
        if (r.ok) {
          const data = await r.json();
          return data.adaptations as NicheAdaptation[];
        }
      } catch { /* fallback below */ }

      // Fallback: generate locally based on breakdown data
      return [
        {
          title: `Chiropractic approach to ${topic}`,
          description: `Replace the general advice with specific benefits of chiropractic adjustments, such as spinal alignment and nervous system regulation, to address ${topic}.`,
          hook: `Most people don't realize how chiropractic care can help with ${topic}...`,
        },
        {
          title: `Family wellness angle on ${topic}`,
          description: `Reframe for families -- highlight how this affects children and parents differently, and what gentle pediatric chiropractic care can do.`,
          hook: `If your family is dealing with ${topic}, here's what nobody tells you...`,
        },
        {
          title: `Myth-busting ${topic}`,
          description: `Use a contrarian approach -- challenge the common belief about ${topic} and present the chiropractic perspective as the unexpected solution.`,
          hook: `Everything you've been told about ${topic} is wrong. Here's why...`,
        },
      ] as NicheAdaptation[];
    },
  });

  // Auto-generate on mount
  React.useEffect(() => {
    if (!adaptMutation.data && !adaptMutation.isPending) {
      adaptMutation.mutate();
    }
  }, []);

  const adaptations = adaptMutation.data || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-themed flex items-center gap-2">
          <Sparkles size={16} className="text-blue-400" />
          How to Personalize for Your Content Niche
        </h3>
        <p className="text-[11px] text-themed-muted mt-1">
          3 ways to adapt this video's approach for your chiropractic content.
        </p>
      </div>

      {/* Loading state */}
      {adaptMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-blue-400 animate-spin mr-2" />
          <span className="text-sm text-themed-muted">Generating adaptations...</span>
        </div>
      )}

      {/* Adaptation options */}
      {adaptations.map((adaptation, i) => (
        <button
          key={i}
          onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selectedIdx === i
              ? "border-blue-500 bg-blue-500/5"
              : "border-themed hover:border-blue-500/30 bg-surface-hover"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
              selectedIdx === i ? "bg-blue-500 text-white" : "bg-surface-elevated text-themed-muted border border-themed"
            }`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[12px] font-bold text-themed uppercase tracking-wide">{adaptation.title}</h4>
              <p className="text-[11px] text-themed-secondary mt-1 leading-relaxed">{adaptation.description}</p>
              {selectedIdx === i && (
                <div className="mt-3 p-3 bg-surface-elevated rounded-lg border border-themed">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Suggested Hook</p>
                  <p className="text-sm text-themed italic">"{adaptation.hook}"</p>
                </div>
              )}
            </div>
          </div>
        </button>
      ))}

      {/* Create button */}
      {selectedIdx !== null && adaptations[selectedIdx] && (
        <button
          onClick={() => {
            const a = adaptations[selectedIdx];
            onCreateScript?.(a.hook, a.title);
          }}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Wand2 size={16} />
          Create Script from Option {selectedIdx + 1}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};
