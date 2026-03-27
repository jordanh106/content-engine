import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { MetricBadge } from "./MetricBadge.js";
import type { CreatorVideo, VideoBreakdown } from "../../shared/types.js";

type Tab = "content" | "hook" | "transcript" | "visual" | "adapt";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
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
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [copied, setCopied] = useState(false);

  // Fetch the video breakdown (uses existing analyze-url endpoint data)
  const { data: breakdownData, isLoading } = useQuery<{ breakdown: VideoBreakdown | null }>({
    queryKey: ["video-breakdown", video.id],
    queryFn: () => fetch(`/api/creator-videos/${video.id}/breakdown`).then((r) => r.json()),
  });

  const breakdown = breakdownData?.breakdown;

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
          <div className="flex gap-1.5 mt-2">
            <MetricBadge type="views" value={video.views || 0} />
            <MetricBadge type="engagement" value={video.likes || 0} />
            <MetricBadge type="saves" value={video.saves || 0} />
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
                {breakdown.storyStructure && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-1">Story Structure</h4>
                    <p className="text-sm text-themed-secondary">{breakdown.storyStructure}</p>
                  </div>
                )}
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
