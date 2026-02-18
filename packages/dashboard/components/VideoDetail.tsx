import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, FileText, Camera, Sparkles } from "lucide-react";
import type { VideoDetailResponse } from "../shared/types.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { AudienceBadge } from "./ui/AudienceBadge.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { CopyButton } from "./ui/CopyButton.js";
import { cn } from "../utils/cn.js";

type VideoDetailProps = {
  code: string;
  onClose: () => void;
};

type Tab = "script" | "shots" | "info";

export const VideoDetail: React.FC<VideoDetailProps> = ({ code, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>("script");

  const { data: video, isLoading } = useQuery<VideoDetailResponse>({
    queryKey: ["video", code],
    queryFn: () => fetch(`/api/videos/${code}`).then((r) => r.json()),
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "script", label: "Script", icon: <FileText size={16} /> },
    { id: "shots", label: "Shots", icon: <Camera size={16} /> },
    { id: "info", label: "Info", icon: <Sparkles size={16} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel - full screen on mobile, slide-out on desktop */}
      <div className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[560px] bg-white z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            {video && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-teal-700 font-mono">
                    {video.code}
                  </span>
                  <StatusBadge status={video.status} />
                </div>
                <h2 className="text-lg font-serif font-bold text-slate-900 leading-snug">
                  {video.title}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <FormatBadge format={video.format} />
                  <AudienceBadge
                    audience={video.audience}
                    label={video.audienceLabel}
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                    {video.duration}s
                  </span>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 md:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Loading...</div>
          ) : !video ? (
            <div className="text-center py-12 text-slate-400">Video not found</div>
          ) : (
            <>
              {activeTab === "script" && <ScriptTab video={video} />}
              {activeTab === "shots" && <ShotsTab video={video} />}
              {activeTab === "info" && <InfoTab video={video} />}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================
// Script Tab
// ============================================

const ScriptTab: React.FC<{ video: VideoDetailResponse }> = ({ video }) => {
  const lines = video.script.split("\n");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Voiceover Script
        </p>
        <CopyButton text={video.script} label="Copy Script" />
      </div>

      {video.deliveryCues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {video.deliveryCues.map((cue, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-full"
            >
              {cue}
            </span>
          ))}
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-3" />;

          // Highlight delivery cues
          const isCue = line.trim().startsWith("[") && line.trim().endsWith("]");

          return (
            <p
              key={i}
              className={cn(
                "text-sm leading-relaxed",
                isCue
                  ? "text-amber-600 font-semibold italic"
                  : "text-slate-700",
              )}
            >
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Shots Tab
// ============================================

const ShotsTab: React.FC<{ video: VideoDetailResponse }> = ({ video }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Cinema Studio Shots ({video.shots.length})
        </p>
        <CopyButton
          text={video.shots.map((s) => s.prompt).join("\n\n")}
          label="Copy All"
        />
      </div>

      <div className="space-y-3">
        {video.shots.map((shot) => (
          <div
            key={shot.number}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center">
                  {shot.number}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {shot.duration}s
                </span>
                <span className="text-xs text-slate-400">
                  {shot.cameraMovement}
                </span>
              </div>
              <CopyButton text={shot.prompt} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {shot.prompt}
            </p>
          </div>
        ))}
      </div>

      {video.vibeMotion && (
        <div className="mt-4 bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-2">
            Vibe Motion Graphics
          </p>
          <p className="text-sm text-violet-800">{video.vibeMotion}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Info Tab
// ============================================

const InfoTab: React.FC<{ video: VideoDetailResponse }> = ({ video }) => {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
          Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {video.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
          Format
        </p>
        <p className="text-sm text-slate-700">
          {video.format}: {video.formatName} ({video.duration}s)
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
          Audience
        </p>
        <p className="text-sm text-slate-700">{video.audienceLabel}</p>
      </div>

      {video.notes && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            Notes
          </p>
          <p className="text-sm text-slate-700">{video.notes}</p>
        </div>
      )}
    </div>
  );
};
