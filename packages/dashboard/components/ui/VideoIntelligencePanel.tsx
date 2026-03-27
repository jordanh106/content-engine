import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
              <div className="space-y-4 text-center py-6">
                <Wand2 size={32} className="text-blue-400 mx-auto" />
                <h3 className="text-base font-bold text-themed">Create Your Version</h3>
                <p className="text-sm text-themed-tertiary max-w-md mx-auto">
                  Adapt this video's hook and structure for your brand. We'll rewrite it in your voice
                  with your audience in mind.
                </p>
                <button
                  onClick={() => {
                    if (onCreateScript) {
                      onCreateScript(
                        breakdown.oneSentenceConcept || breakdown.hookFormat || video.videoTitle || "",
                        breakdown.topic || video.videoTitle || ""
                      );
                    }
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <Wand2 size={16} />
                  Create My Version
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
