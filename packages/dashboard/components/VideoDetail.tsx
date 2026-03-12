import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, FileText, Camera, Sparkles, Wand2, Loader2, CircleAlert, Download, Play, Layers, Clock, ListChecks, RefreshCw, Send, Copy, Check, GitBranch, Plus, Trash2, Zap, Film, Star, ChevronDown, ChevronRight, Video, Bot, AlertTriangle } from "lucide-react";
import type {
  VideoDetailResponse,
  RenderJob,
  RenderJobsResponse,
  ShotsResponse,
  VibeMotionComponent,
  TimelineResponse,
  ProductionPlan,
  SavedCaption,
  WaterfallEntry,
  Storyboard,
  StoryboardShot,
  AiGenerationPrompt,
  VaultVisualStyle,
  ProductionStyle,
  ProduceTabData,
  ShotProductionCard,
  ProductionChecklistItem,
} from "../shared/types.js";
import { ProductionStylePicker } from "./ui/ProductionStylePicker.js";
import { TimelineView } from "./TimelineView.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { AudienceBadge } from "./ui/AudienceBadge.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { CopyButton } from "./ui/CopyButton.js";

import { cn } from "../utils/cn.js";
import {
  CINEMA_DEFAULTS_BY_FORMAT,
  recommendToolAndModel,
  suggestCameraMovement,
} from "../shared/production-knowledge.js";

type VideoDetailProps = {
  code: string;
  onClose: () => void;
};

type Tab = "script" | "shots" | "info" | "timeline" | "produce" | "publish" | "waterfall" | "storyboard";

export const VideoDetail: React.FC<VideoDetailProps> = ({ code, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useQuery<VideoDetailResponse>({
    queryKey: ["video", code],
    queryFn: () => fetch(`/api/videos/${code}`).then((r) => r.json()),
  });

  const { data: renderJobs } = useQuery<RenderJobsResponse>({
    queryKey: ["render-jobs", code],
    queryFn: () => fetch(`/api/renders/${code}`).then((r) => r.json()),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const hasActive = jobs.some((job) => job.status === "queued" || job.status === "running");
      return hasActive ? 2000 : false;
    },
  });

  const { data: shotsData } = useQuery<ShotsResponse>({
    queryKey: ["shots", code],
    queryFn: () => fetch(`/api/renders/${code}/shots`).then((r) => r.json()),
    refetchInterval: (query) => {
      const jobs = query.state.data?.jobs ?? [];
      const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
      return hasActive ? 2000 : false;
    },
  });

  const { data: timelineData } = useQuery<TimelineResponse>({
    queryKey: ["timeline", code],
    queryFn: () => fetch(`/api/videos/${code}/timeline`).then((r) => r.json()),
    enabled: activeTab === "timeline",
  });

  const { data: productionPlanData } = useQuery<{ available: boolean; plan: ProductionPlan | null }>({
    queryKey: ["production-plan", code],
    queryFn: () => fetch(`/api/videos/${code}/production-plan`).then((r) => r.json()),
    enabled: activeTab === "produce",
  });

  const { data: produceData } = useQuery<ProduceTabData>({
    queryKey: ["produce", code],
    queryFn: () => fetch(`/api/produce/${code}`).then((r) => r.json()),
    enabled: activeTab === "produce",
  });

  const latestJob: RenderJob | null = renderJobs?.jobs?.[0] ?? null;
  const isRendering = latestJob ? latestJob.status === "queued" || latestJob.status === "running" : false;

  const hasActiveShotJobs = (shotsData?.jobs ?? []).some(
    (j) => j.status === "queued" || j.status === "running",
  );

  const renderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/renders/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (response.status === 404) {
          throw new Error("Render API not available. Restart dashboard server.");
        }
        if (contentType.includes("application/json")) {
          const error = await response.json().catch(() => ({ error: "Failed to start render" }));
          throw new Error(error.error || "Failed to start render");
        }
        const text = await response.text().catch(() => "");
        throw new Error(text.includes("Cannot POST")
          ? "Render API not available. Restart dashboard server."
          : "Failed to start render");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["render-jobs", code] });
    },
  });

  const renderShotMutation = useMutation({
    mutationFn: async (shotId: string) => {
      const response = await fetch(`/api/renders/${code}/shot/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to render shot" }));
        throw new Error(data.error || "Failed to render shot");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shots", code] });
      queryClient.invalidateQueries({ queryKey: ["render-jobs", code] });
    },
  });

  const renderAllShotsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/renders/${code}/all-shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Failed to render shots" }));
        throw new Error(data.error || "Failed to render shots");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shots", code] });
      queryClient.invalidateQueries({ queryKey: ["render-jobs", code] });
    },
  });

  const showPublishTab = video && ["ASSEMBLED", "SCHEDULED", "PUBLISHED"].includes(video.status);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "script", label: "Script", icon: <FileText size={16} /> },
    { id: "shots", label: "Shots", icon: <Camera size={16} /> },
    { id: "timeline", label: "Timeline", icon: <Clock size={16} /> },
    { id: "produce", label: "Produce", icon: <ListChecks size={16} /> },
    ...(showPublishTab ? [{ id: "publish" as Tab, label: "Publish", icon: <Send size={16} /> }] : []),
    { id: "storyboard", label: "Storyboard", icon: <Film size={16} /> },
    { id: "waterfall", label: "Waterfall", icon: <GitBranch size={16} /> },
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

        {/* Render panel */}
        <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-teal-50/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700 mb-1">
                Motion Graphics
              </p>
              <p className="text-xs text-slate-600">
                Generate individual clips for assembly in CapCut.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => renderAllShotsMutation.mutate()}
                disabled={renderAllShotsMutation.isPending || hasActiveShotJobs}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors min-h-[36px]",
                  renderAllShotsMutation.isPending || hasActiveShotJobs
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-teal-600 text-white hover:bg-teal-700",
                )}
              >
                {renderAllShotsMutation.isPending || hasActiveShotJobs ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Rendering
                  </>
                ) : (
                  <>
                    <Layers size={12} />
                    Render All
                  </>
                )}
              </button>
              <button
                onClick={() => renderMutation.mutate()}
                disabled={renderMutation.isPending || isRendering}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors min-h-[36px]",
                  renderMutation.isPending || isRendering
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-slate-600 text-white hover:bg-slate-700",
                )}
              >
                {renderMutation.isPending || isRendering ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Full
                  </>
                ) : (
                  <>
                    <Wand2 size={12} />
                    Full Comp
                  </>
                )}
              </button>
            </div>
          </div>

          {(renderAllShotsMutation.error as Error | null)?.message && (
            <p className="text-xs text-rose-600 mb-2">
              {(renderAllShotsMutation.error as Error).message}
            </p>
          )}
          {(renderMutation.error as Error | null)?.message && (
            <p className="text-xs text-rose-600 mb-2">
              {(renderMutation.error as Error).message}
            </p>
          )}

          {/* Shot component cards */}
          {shotsData?.components && shotsData.components.length > 0 && (
            <div className="space-y-2">
              {shotsData.components.map((comp) => (
                <RenderShotCard
                  key={comp.id}
                  component={comp}
                  job={findJobForShot(shotsData.jobs, comp.id)}
                  onRender={() => renderShotMutation.mutate(comp.id)}
                  isRendering={renderShotMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* Legacy full composition latest job */}
          {latestJob && !latestJob.shotId && (
            <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Full composition: <span className="font-mono text-slate-800">{latestJob.id.slice(0, 8)}</span>
                </p>
                <JobStatusBadge status={latestJob.status} />
              </div>
              {latestJob.outputUrl && (
                <div className="mt-2 flex gap-2">
                  <a href={latestJob.outputUrl} target="_blank" rel="noreferrer"
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800">
                    Open MP4
                  </a>
                  <a href={latestJob.outputUrl} download
                    className="text-xs font-semibold text-slate-600 hover:text-slate-800">
                    Download
                  </a>
                </div>
              )}
              {latestJob.error && (
                <div className="mt-2 flex items-start gap-1.5 text-rose-700">
                  <CircleAlert size={13} className="mt-0.5" />
                  <p className="text-xs whitespace-pre-wrap">{latestJob.error}</p>
                </div>
              )}
            </div>
          )}
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
              {activeTab === "timeline" && timelineData && (
                <TimelineView
                  items={timelineData.items}
                  formatTiming={timelineData.formatTiming}
                  totalDuration={timelineData.totalDuration}
                />
              )}
              {activeTab === "timeline" && !timelineData && (
                <div className="text-center py-12 text-slate-400">Loading timeline...</div>
              )}
              {activeTab === "produce" && (
                <ProduceTab code={code} plan={productionPlanData?.plan ?? null} produceData={produceData ?? null} />
              )}
              {activeTab === "publish" && <PublishTab code={code} />}
              {activeTab === "storyboard" && <StoryboardTab code={code} />}
              {activeTab === "waterfall" && <WaterfallTab code={code} />}
              {activeTab === "info" && <InfoTab video={video} code={code} />}
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

const ADAPT_PLATFORMS = [
  { key: "tiktok", label: "TikTok", note: "6-15s, hook in 0.5s, text-heavy" },
  { key: "instagram_reels", label: "IG Reels", note: "15-30s, visual hooks, slower cuts" },
  { key: "youtube_shorts", label: "YT Shorts", note: "Up to 60s, educational depth" },
  { key: "youtube_long", label: "YT Long", note: "3-5 min, expanded with B-roll cues" },
];

const ScriptTab: React.FC<{ video: VideoDetailResponse }> = ({ video }) => {
  const lines = video.script.split("\n");
  const [adaptedScript, setAdaptedScript] = useState<string | null>(null);
  const [adaptPlatform, setAdaptPlatform] = useState<string | null>(null);

  const adaptMutation = useMutation({
    mutationFn: async (platform: string) => {
      const r = await fetch(`/api/videos/${video.code}/adapt-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!r.ok) throw new Error("Adaptation failed");
      return r.json();
    },
    onSuccess: (data: { script: string; platform: string }) => {
      setAdaptedScript(data.script);
      setAdaptPlatform(data.platform);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Voiceover Script
        </p>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">
              <Wand2 size={10} />
              Adapt
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-10 hidden group-hover:block">
              {ADAPT_PLATFORMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => adaptMutation.mutate(p.key)}
                  disabled={adaptMutation.isPending}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-xs font-medium text-slate-800">{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.note}</span>
                </button>
              ))}
            </div>
          </div>
          <CopyButton text={adaptedScript || video.script} label="Copy Script" />
        </div>
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

      {/* Adapted Script */}
      {adaptMutation.isPending && (
        <div className="mt-4 flex items-center gap-2 text-sm text-violet-600">
          <Loader2 size={14} className="animate-spin" /> Adapting script...
        </div>
      )}
      {adaptedScript && adaptPlatform && (
        <div className="mt-4 border border-violet-200 bg-violet-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
              Adapted for {ADAPT_PLATFORMS.find((p) => p.key === adaptPlatform)?.label || adaptPlatform}
            </p>
            <div className="flex items-center gap-2">
              <CopyButton text={adaptedScript} label="Copy" />
              <button onClick={() => { setAdaptedScript(null); setAdaptPlatform(null); }} className="text-[10px] text-violet-400 hover:text-violet-600">
                Dismiss
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 space-y-2">
            {adaptedScript.split("\n").map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-2" />;
              const isCue = line.trim().startsWith("[") && line.trim().endsWith("]");
              return (
                <p key={i} className={cn("text-sm leading-relaxed", isCue ? "text-violet-600 font-semibold italic" : "text-slate-700")}>
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
      {adaptMutation.isError && (
        <p className="text-xs text-rose-500 mt-2">{(adaptMutation.error as Error)?.message}</p>
      )}

      {/* Consistency Check */}
      <ConsistencyCheck code={video.code} />
    </div>
  );
};

// ============================================
// Consistency Check Component
// ============================================

type ConsistencyResult = {
  scores: Record<string, number>;
  overallScore: number;
  issues: string[];
  strengths: string[];
};

const CONSISTENCY_LABELS: Record<string, string> = {
  voiceConsistency: "Voice",
  hookStrength: "Hook",
  toneMatch: "Tone",
  structureQuality: "Structure",
  deliveryCues: "Cues",
};

const ConsistencyCheck: React.FC<{ code: string }> = ({ code }) => {
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/videos/${code}/consistency-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Check failed");
      return r.json() as Promise<ConsistencyResult>;
    },
    onSuccess: (data) => setResult(data),
  });

  return (
    <div className="mt-4 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Voice Consistency
        </p>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold hover:bg-sky-200 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {result ? "Recheck" : "Check"}
        </button>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={cn("text-2xl font-black", result.overallScore >= 7 ? "text-emerald-600" : result.overallScore >= 5 ? "text-amber-600" : "text-rose-600")}>
              {result.overallScore}
            </span>
            <span className="text-xs text-slate-400">/10</span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {Object.entries(result.scores).map(([key, score]) => (
              <div key={key} className="text-center">
                <div className={cn("text-sm font-bold", score >= 7 ? "text-emerald-600" : score >= 5 ? "text-amber-600" : "text-rose-600")}>
                  {score}
                </div>
                <div className="text-[9px] text-slate-400 truncate">{CONSISTENCY_LABELS[key] || key}</div>
              </div>
            ))}
          </div>
          {result.issues.length > 0 && (
            <div className="text-xs text-rose-600 space-y-0.5">
              {result.issues.slice(0, 3).map((issue, i) => <p key={i}>- {issue}</p>)}
            </div>
          )}
          {result.strengths.length > 0 && (
            <div className="text-xs text-emerald-600 space-y-0.5">
              {result.strengths.slice(0, 2).map((s, i) => <p key={i}>+ {s}</p>)}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">AI checks voice, hook, tone, structure, and delivery cues.</p>
      )}
    </div>
  );
};

// ============================================
// Thumbnail Concepts Component
// ============================================

type ThumbnailConcept = {
  textOverlay: string;
  expression: string;
  background: string;
  colorScheme: string;
  style: string;
};

const ThumbnailConcepts: React.FC<{ code: string }> = ({ code }) => {
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);

  const { data: savedConcepts } = useQuery<{ concepts: ThumbnailConcept[] }>({
    queryKey: ["thumbnail-concepts", code],
    queryFn: () => fetch(`/api/videos/${code}/thumbnail-concepts`).then((r) => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/videos/${code}/thumbnail-concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Generation failed");
      return r.json() as Promise<{ concepts: ThumbnailConcept[] }>;
    },
    onSuccess: (data) => setConcepts(data.concepts),
  });

  const displayConcepts = concepts.length > 0 ? concepts : savedConcepts?.concepts || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-pink-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Thumbnail Concepts
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold hover:bg-pink-200 disabled:opacity-50 transition-colors"
        >
          {generateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {displayConcepts.length > 0 ? "Regenerate" : "Generate"}
        </button>
      </div>

      {displayConcepts.length > 0 ? (
        <div className="space-y-2 mt-2">
          {displayConcepts.map((c, i) => (
            <div key={i} className="bg-pink-50 rounded-lg p-3">
              <p className="text-sm font-bold text-slate-800">{c.textOverlay}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-slate-500">
                {c.expression && <span>Expression: {c.expression}</span>}
                {c.background && <span>BG: {c.background}</span>}
                {c.colorScheme && <span>Colors: {c.colorScheme}</span>}
                {c.style && <span>Style: {c.style}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">AI generates text overlays, expressions, and visual direction for thumbnails.</p>
      )}
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

      {video.remotionGraphicsNotes && (
        <div className="mt-4 bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-2">
            Remotion Graphics Notes
          </p>
          <p className="text-sm text-violet-800">{video.remotionGraphicsNotes}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Info Tab
// ============================================

const InfoTab: React.FC<{ video: VideoDetailResponse; code: string }> = ({ video, code }) => {
  const queryClient = useQueryClient();
  const styleMutation = useMutation({
    mutationFn: async (style: ProductionStyle) => {
      const r = await fetch(`/api/videos/${code}/production-style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      if (!r.ok) throw new Error("Failed to set production style");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video", code] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
          Production Style
        </p>
        <ProductionStylePicker
          value={video.productionStyle}
          onChange={(style) => styleMutation.mutate(style)}
          disabled={styleMutation.isPending}
        />
      </div>

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

// ============================================
// Produce Tab (Production Companion)
// ============================================

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  real: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  ai_enhanced: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  ai_generated: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  motion_graphic: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

const METHOD_LABELS: Record<string, string> = {
  real: "Real",
  ai_enhanced: "AI Enhanced",
  ai_generated: "AI Generated",
  motion_graphic: "Motion Graphic",
};

const ACT_COLORS: Record<string, string> = {
  hook: "bg-rose-100 text-rose-700",
  conflict: "bg-amber-100 text-amber-700",
  build: "bg-sky-100 text-sky-700",
  resolution: "bg-emerald-100 text-emerald-700",
  cta: "bg-violet-100 text-violet-700",
};

const ProduceChecklist: React.FC<{
  title: string;
  items: Array<ProductionChecklistItem & { completed: boolean }>;
  videoCode: string;
  checklistType: string;
  defaultOpen?: boolean;
}> = ({ title, items, videoCode, checklistType, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ itemKey, completed }: { itemKey: string; completed: boolean }) => {
      const r = await fetch(`/api/produce/${videoCode}/check`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, checklistType, completed }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produce", videoCode] });
    },
  });

  const completed = items.filter((i) => i.completed).length;
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 100;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold", pct === 100 ? "text-emerald-600" : "text-slate-400")}>
            {completed}/{items.length}
          </span>
          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-teal-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3 space-y-1.5">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleMutation.mutate({ itemKey: item.key, completed: !item.completed })}
              className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                item.completed
                  ? "bg-teal-600 border-teal-600"
                  : item.critical
                    ? "border-amber-400"
                    : "border-slate-300",
              )}>
                {item.completed && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm", item.completed ? "text-slate-400 line-through" : "text-slate-700")}>
                  {item.label}
                </span>
                {item.critical && !item.completed && (
                  <span className="ml-1.5 text-[9px] font-bold text-amber-500 uppercase">Critical</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ShotCard: React.FC<{
  shot: ShotProductionCard;
  videoCode: string;
}> = ({ shot, videoCode }) => {
  const queryClient = useQueryClient();
  const colors = METHOD_COLORS[shot.productionMethod] || METHOD_COLORS.real;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/produce/${videoCode}/check`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemKey: `shot_${shot.shotNumber}`,
          checklistType: "shot_completion",
          completed: !shot.completed,
        }),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produce", videoCode] });
    },
  });

  return (
    <div className={cn(
      "border rounded-xl p-3 transition-all",
      shot.completed ? "bg-slate-50 border-slate-200 opacity-70" : cn(colors.bg, colors.border),
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 font-mono">#{shot.shotNumber}</span>
          {shot.act && (
            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full", ACT_COLORS[shot.act] || "bg-slate-100 text-slate-600")}>
              {shot.act}
            </span>
          )}
          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", colors.border, colors.text, colors.bg)}>
            {METHOD_LABELS[shot.productionMethod]}
          </span>
          <span className="text-[10px] text-slate-400">{shot.durationSeconds}s</span>
        </div>
        <button
          onClick={() => toggleMutation.mutate()}
          className={cn(
            "w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
            shot.completed ? "bg-teal-600 border-teal-600" : "border-slate-300 hover:border-teal-400",
          )}
        >
          {shot.completed && <Check size={14} className="text-white" />}
        </button>
      </div>

      {/* Script line */}
      {shot.scriptLine && (
        <p className="text-xs text-slate-600 italic mb-2 leading-relaxed">"{shot.scriptLine}"</p>
      )}

      {/* Technique guidance */}
      <div className="space-y-1.5">
        {/* Tool + Model */}
        {shot.toolRecommendation && (
          <div className="flex items-center gap-1.5">
            <Wand2 size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">
              <span className="font-bold">{shot.toolRecommendation}</span>
              {shot.modelRecommendation && shot.modelRecommendation !== "N/A" && (
                <> / {shot.modelRecommendation}</>
              )}
            </span>
          </div>
        )}

        {/* VFX Trick */}
        {shot.vfxTrick && (
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-amber-500 flex-shrink-0" />
            <span className="text-[10px] font-bold text-amber-600">{shot.vfxTrick}</span>
          </div>
        )}

        {/* Camera defaults */}
        {shot.cameraDefaults && (
          <div className="flex items-center gap-1.5">
            <Camera size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">
              {shot.cameraDefaults.camera} / {shot.cameraDefaults.lens} / {shot.cameraDefaults.focalLength} / {shot.cameraDefaults.genre}
            </span>
          </div>
        )}

        {/* Suggested movement */}
        {shot.suggestedMovement && (
          <div className="flex items-center gap-1.5">
            <Film size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">
              Movement: <span className="font-bold">{shot.suggestedMovement}</span>
              {shot.suggestedMovementReason && <span className="text-slate-400"> - {shot.suggestedMovementReason}</span>}
            </span>
          </div>
        )}

        {/* Color grade notes */}
        {shot.colorGradeNotes && (
          <div className="flex items-center gap-1.5">
            <Layers size={10} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">Color: {shot.colorGradeNotes}</span>
          </div>
        )}

        {/* Cinema Studio prompt */}
        {shot.cinemaStudioPrompt && (
          <div className="mt-2 bg-white/60 border border-slate-200 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cinema Studio Prompt</span>
              <CopyButton text={shot.cinemaStudioPrompt} />
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">{shot.cinemaStudioPrompt}</p>
          </div>
        )}

        {/* AI Enhancement notes */}
        {shot.aiEnhancementNotes && (
          <div className="flex items-center gap-1.5">
            <Wand2 size={10} className="text-amber-500 flex-shrink-0" />
            <span className="text-[10px] text-amber-600">{shot.aiEnhancementNotes}</span>
          </div>
        )}

        {/* Remotion component */}
        {shot.remotionComponent && (
          <div className="flex items-center gap-1.5">
            <Bot size={10} className="text-violet-500 flex-shrink-0" />
            <span className="text-[10px] text-violet-600 font-mono">{shot.remotionComponent}</span>
          </div>
        )}
      </div>

      {/* Filming tips (collapsed by default) */}
      {shot.filmingTips.length > 0 && !shot.completed && (
        <details className="mt-2">
          <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">
            Tips ({shot.filmingTips.length})
          </summary>
          <ul className="mt-1 space-y-0.5">
            {shot.filmingTips.map((tip, i) => (
              <li key={i} className="text-[10px] text-slate-500 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-slate-300">
                {tip}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const ProduceTab: React.FC<{
  code: string;
  plan: ProductionPlan | null;
  produceData: ProduceTabData | null;
}> = ({ code, plan, produceData }) => {
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (videoCode: string) => {
      const r = await fetch(`/api/video-director/${videoCode}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: `Server error: ${r.status}` }));
        throw new Error(d.error || "Generation failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-plan", code] });
    },
  });

  return (
    <div className="space-y-5">
      {/* Overall completion */}
      {produceData && produceData.shotCards.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                produceData.completion.overall === 100 ? "bg-emerald-500" : "bg-teal-500",
              )}
              style={{ width: `${produceData.completion.overall}%` }}
            />
          </div>
          <span className={cn(
            "text-xs font-bold",
            produceData.completion.overall === 100 ? "text-emerald-600" : "text-slate-500",
          )}>
            {produceData.completion.overall}%
          </span>
        </div>
      )}

      {/* Pre-production checklist */}
      {produceData && produceData.preProduction.length > 0 && (
        <ProduceChecklist
          title="Pre-Production"
          items={produceData.preProduction}
          videoCode={code}
          checklistType="pre_production"
          defaultOpen={produceData.completion.pre < 100}
        />
      )}

      {/* Shot-by-shot production cards */}
      {produceData && produceData.shotCards.length > 0 ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            Shot Guide ({produceData.shotCards.filter((s) => s.completed).length}/{produceData.shotCards.length})
          </p>
          <div className="space-y-2">
            {produceData.shotCards.map((shot) => (
              <ShotCard key={shot.shotNumber} shot={shot} videoCode={code} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
          <Film size={24} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-1">No storyboard yet.</p>
          <p className="text-xs text-slate-400">Generate a storyboard first to get shot-by-shot production guidance.</p>
        </div>
      )}

      {/* Post-production quality checklist */}
      {produceData && produceData.postProduction.length > 0 && (
        <ProduceChecklist
          title="Post-Production Quality"
          items={produceData.postProduction}
          videoCode={code}
          checklistType="post_production"
          defaultOpen={false}
        />
      )}

      {/* Production Plan (hook variations, platform notes) */}
      {plan && (
        <>
          {plan.hookVariations.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                Hook Variations ({plan.hookVariations.length})
              </p>
              <div className="space-y-2">
                {plan.hookVariations.map((hook, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700">{hook}</p>
                    <CopyButton text={hook} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(plan.platformOptimization).length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                Platform Optimization
              </p>
              <div className="grid gap-2">
                {Object.entries(plan.platformOptimization).map(([platform, notes]) => (
                  <div key={platform} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1">{platform}</p>
                    <p className="text-sm text-slate-600">{notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!plan && (
        <div className="text-center py-4">
          <button
            onClick={() => generateMutation.mutate(code)}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Generating...</>
            ) : (
              <><Wand2 size={12} /> Generate Hook Variations</>
            )}
          </button>
          {generateMutation.isError && (
            <p className="text-xs text-rose-500 mt-3">{(generateMutation.error as Error)?.message}</p>
          )}
        </div>
      )}

      {/* Assembly Checklist */}
      <AssemblyChecklist code={code} />
    </div>
  );
};

// ============================================
// Assembly Checklist (4.5)
// ============================================

type AssemblyItem = { key: string; label: string; completed: boolean };

const AssemblyChecklist: React.FC<{ code: string }> = ({ code }) => {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ items: AssemblyItem[]; completedCount: number; totalCount: number; allComplete: boolean }>({
    queryKey: ["assembly-checklist", code],
    queryFn: () => fetch(`/api/videos/${code}/assembly-checklist`).then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, completed }: { key: string; completed: boolean }) => {
      const r = await fetch(`/api/videos/${code}/assembly-checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, completed }),
      });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assembly-checklist", code] }),
  });

  if (!data) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Assembly Checklist</p>
        <span className="text-[10px] font-bold text-amber-600">{data.completedCount}/{data.totalCount}</span>
      </div>
      <div className="space-y-2">
        {data.items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleMutation.mutate({ key: item.key, completed: !item.completed })}
              className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span className={`text-xs ${item.completed ? "text-amber-500 line-through" : "text-amber-800 font-medium"}`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
      {data.allComplete && (
        <p className="text-[10px] text-emerald-600 font-bold mt-2">All assembly steps complete. Ready to schedule.</p>
      )}
    </div>
  );
};

// ============================================
// Publish Tab
// ============================================

const PUBLISH_PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: "Instagram Reels",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube Long",
};

const PUBLISH_PLATFORM_COLORS: Record<string, string> = {
  instagram_reels: "border-pink-200 bg-pink-50",
  tiktok: "border-slate-300 bg-slate-50",
  youtube_shorts: "border-red-200 bg-red-50",
  youtube_long: "border-red-200 bg-red-50",
};

type PublishKitResponse = {
  video: { code: string; title: string; format: string; scriptPreview: string; tags: string[]; audience: string };
  captions: SavedCaption[];
  calendarEntries: Array<{ id: number; date: string; platform: string; status: string }>;
  missingPlatforms: string[];
  coveredCount: number;
  totalPlatforms: number;
};

type ViralityScore = {
  score: number;
  dimensions: Record<string, { score: number; note: string }>;
  suggestion: string;
};

const VIRALITY_DIMENSION_LABELS: Record<string, string> = {
  hookStrength: "Hook Strength",
  topicRelevance: "Topic Relevance",
  formatFit: "Format Fit",
  shareability: "Shareability",
  platformPotential: "Platform Potential",
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

function scoreBg(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

const PublishTab: React.FC<{ code: string }> = ({ code }) => {
  const queryClient = useQueryClient();
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [viralityScore, setViralityScore] = useState<ViralityScore | null>(null);

  const viralityMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/videos/${code}/virality-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Score generation failed");
      return r.json();
    },
    onSuccess: (data: ViralityScore) => {
      setViralityScore(data);
    },
  });

  const { data: kit, isLoading } = useQuery<PublishKitResponse>({
    queryKey: ["publish-kit", code],
    queryFn: () => fetch(`/api/captions/publish-kit/${code}`).then((r) => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode: code }),
      });
      if (!r.ok) throw new Error("Generation failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publish-kit", code] });
      queryClient.invalidateQueries({ queryKey: ["captions", code] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/pipeline/${code}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      if (!r.ok) throw new Error("Status update failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video", code] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["publish-kit", code] });
    },
  });

  const handleCopy = (platform: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  if (isLoading) return <div className="text-center py-12 text-slate-400">Loading...</div>;
  if (!kit) return <div className="text-center py-12 text-slate-400">Could not load publish data</div>;

  const platforms = ["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Publish Checklist
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {kit.coveredCount}/{kit.totalPlatforms} platforms have captions
          </p>
        </div>
        <div className="flex gap-2">
          {kit.missingPlatforms.length > 0 && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generate Missing
            </button>
          )}
        </div>
      </div>

      {/* Virality Score */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Virality Score
            </p>
          </div>
          <button
            onClick={() => viralityMutation.mutate()}
            disabled={viralityMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-200 disabled:opacity-50 transition-colors"
          >
            {viralityMutation.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Scoring...</>
            ) : viralityScore ? (
              <><RefreshCw size={12} /> Rescore</>
            ) : (
              <><Zap size={12} /> Score</>
            )}
          </button>
        </div>

        {viralityScore ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={cn("text-3xl font-black", scoreColor(viralityScore.score))}>
                {viralityScore.score}
              </span>
              <span className="text-sm text-slate-400">/100</span>
            </div>

            <div className="space-y-1.5">
              {Object.entries(viralityScore.dimensions).map(([key, dim]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-28 shrink-0 truncate">
                    {VIRALITY_DIMENSION_LABELS[key] || key}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", scoreBg(dim.score * 5))}
                      style={{ width: `${(dim.score / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-6 text-right">{dim.score}</span>
                </div>
              ))}
            </div>

            {viralityScore.suggestion && (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 mt-2">
                <Sparkles size={12} className="inline mr-1 text-amber-500" />
                {viralityScore.suggestion}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            AI evaluates hook strength, topic relevance, format fit, shareability, and platform potential.
          </p>
        )}

        {viralityMutation.isError && (
          <p className="text-xs text-rose-500 mt-2">{(viralityMutation.error as Error)?.message}</p>
        )}
      </div>

      {/* Thumbnail Concepts */}
      <ThumbnailConcepts code={code} />

      {/* Platform checklist */}
      {platforms.map((platform) => {
        const caption = kit.captions.find((c) => c.platform === platform && c.status === "approved")
          || kit.captions.find((c) => c.platform === platform);
        const calEntry = kit.calendarEntries.find((e) => e.platform === platform);

        return (
          <div key={platform} className={cn("border rounded-xl p-4", PUBLISH_PLATFORM_COLORS[platform] || "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-800">
                {PUBLISH_PLATFORM_LABELS[platform] || platform}
              </p>
              <div className="flex items-center gap-2">
                {caption && (
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    caption.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                    caption.status === "posted" ? "bg-teal-100 text-teal-700" :
                    "bg-slate-100 text-slate-600",
                  )}>
                    {caption.status}
                  </span>
                )}
                {calEntry && (
                  <span className="text-[10px] font-bold text-slate-500">
                    {calEntry.date}
                  </span>
                )}
              </div>
            </div>

            {caption ? (
              <div className="relative">
                <p className="text-sm text-slate-600 whitespace-pre-wrap pr-10 line-clamp-4">{caption.caption}</p>
                <button
                  onClick={() => handleCopy(platform, caption.caption)}
                  className="absolute top-0 right-0 p-2 rounded-lg hover:bg-white/60 transition-colors"
                  title="Copy caption"
                >
                  {copiedPlatform === platform ? (
                    <Check size={16} className="text-teal-500" />
                  ) : (
                    <Copy size={16} className="text-slate-400" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No caption generated</p>
            )}

            {!calEntry && (
              <p className="text-[10px] text-slate-400 mt-2">Not scheduled</p>
            )}
          </div>
        );
      })}

      {/* Mark Published */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => publishMutation.mutate()}
          disabled={publishMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Mark as Published
        </button>
      </div>
      {generateMutation.isError && (
        <p className="text-xs text-rose-500 text-center">{(generateMutation.error as Error)?.message}</p>
      )}
    </div>
  );
};

// ============================================
// Shot Components
// ============================================

const COMPONENT_TYPE_COLORS: Record<string, string> = {
  TitleCard: "bg-violet-100 text-violet-700",
  StatCard: "bg-blue-100 text-blue-700",
  SectionCard: "bg-teal-100 text-teal-700",
  HookText: "bg-amber-100 text-amber-700",
  ChecklistOverlay: "bg-emerald-100 text-emerald-700",
  MythTruthReveal: "bg-rose-100 text-rose-700",
  StepIndicator: "bg-indigo-100 text-indigo-700",
  FrequencyCard: "bg-cyan-100 text-cyan-700",
  CallToAction: "bg-orange-100 text-orange-700",
  KineticText: "bg-fuchsia-100 text-fuchsia-700",
};

function findJobForShot(jobs: RenderJob[], shotId: string): RenderJob | null {
  return jobs.find((j) => j.shotId === shotId) ?? null;
}

const JobStatusBadge: React.FC<{ status: RenderJob["status"] }> = ({ status }) => (
  <span
    className={cn(
      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
      status === "completed" && "bg-emerald-100 text-emerald-700",
      status === "failed" && "bg-rose-100 text-rose-700",
      (status === "queued" || status === "running") && "bg-amber-100 text-amber-700",
    )}
  >
    {status}
  </span>
);

const RenderShotCard: React.FC<{
  component: VibeMotionComponent;
  job: RenderJob | null;
  onRender: () => void;
  isRendering: boolean;
}> = ({ component, job, onRender, isRendering }) => {
  const typeColor = COMPONENT_TYPE_COLORS[component.componentType] || "bg-slate-100 text-slate-700";
  const isActive = job && (job.status === "queued" || job.status === "running");

  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", typeColor)}>
            {component.componentType}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {component.durationInSeconds}s
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {job && <JobStatusBadge status={job.status} />}
          {job?.outputUrl && (
            <a
              href={job.outputUrl}
              download
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
              title="Download"
            >
              <Download size={14} />
            </a>
          )}
          <button
            onClick={onRender}
            disabled={isRendering || !!isActive}
            className={cn(
              "p-1 rounded transition-colors",
              isRendering || isActive
                ? "text-slate-300 cursor-not-allowed"
                : "text-teal-600 hover:bg-teal-50",
            )}
            title="Render this clip"
          >
            {isActive ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-1.5 truncate" title={component.label}>
        {component.label}
      </p>
      {job?.error && (
        <div className="mt-1.5 flex items-start gap-1 text-rose-600">
          <CircleAlert size={11} className="mt-0.5 flex-shrink-0" />
          <p className="text-[10px] line-clamp-2">{job.error}</p>
        </div>
      )}
    </div>
  );
};

// ─── Waterfall Tab ───────────────────────────────────────────────────────────

const TIER_META: Record<string, { label: string; color: string }> = {
  source: { label: "Source", color: "bg-teal-100 text-teal-700" },
  cutdown: { label: "Cutdown", color: "bg-sky-100 text-sky-700" },
  short: { label: "Short", color: "bg-violet-100 text-violet-700" },
  text: { label: "Text", color: "bg-amber-100 text-amber-700" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  idea: { label: "Idea", color: "text-slate-500" },
  created: { label: "Created", color: "text-sky-600" },
  published: { label: "Published", color: "text-emerald-600" },
};

type RepurposeSuggestion = {
  tier: string;
  platform: string;
  description: string;
  content: string;
};

const WaterfallTab: React.FC<{ code: string }> = ({ code }) => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTier, setNewTier] = useState("short");
  const [newPlatform, setNewPlatform] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [suggestions, setSuggestions] = useState<RepurposeSuggestion[]>([]);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{ items: WaterfallEntry[] }>({
    queryKey: ["waterfall", code],
    queryFn: () => fetch(`/api/videos/${code}/waterfall`).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/videos/${code}/waterfall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier, platform: newPlatform || null, description: newDesc || null }),
      });
      if (!r.ok) throw new Error("Failed to add");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waterfall", code] });
      setShowAdd(false);
      setNewDesc("");
      setNewPlatform("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/videos/${code}/waterfall/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Failed to update");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waterfall", code] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/videos/${code}/waterfall/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waterfall", code] });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/videos/${code}/repurpose-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Failed to generate suggestions");
      return r.json();
    },
    onSuccess: (data: { suggestions: RepurposeSuggestion[] }) => {
      setSuggestions(data.suggestions || []);
      setAddedSuggestions(new Set());
    },
  });

  const addSuggestionMutation = useMutation({
    mutationFn: async (s: RepurposeSuggestion) => {
      const r = await fetch(`/api/videos/${code}/waterfall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: s.tier, platform: s.platform, description: `${s.description}: ${s.content}` }),
      });
      if (!r.ok) throw new Error("Failed to add");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waterfall", code] });
    },
  });

  const handleAddSuggestion = (index: number, s: RepurposeSuggestion) => {
    addSuggestionMutation.mutate(s);
    setAddedSuggestions((prev) => new Set(prev).add(index));
  };

  const items = data?.items ?? [];

  // Group by tier
  const grouped = {
    source: items.filter((i) => i.tier === "source"),
    cutdown: items.filter((i) => i.tier === "cutdown"),
    short: items.filter((i) => i.tier === "short"),
    text: items.filter((i) => i.tier === "text"),
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Content Waterfall
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Track derivative content from this source video
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50 transition-colors"
          >
            {suggestMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            AI Suggest
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            <Plus size={10} />
            Add
          </button>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="border border-violet-200 bg-violet-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">
              AI Suggestions ({suggestions.length})
            </p>
            <button onClick={() => setSuggestions([])} className="text-[10px] text-violet-400 hover:text-violet-600">
              Dismiss
            </button>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="bg-white border border-violet-100 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase text-violet-500">{s.tier}</span>
                    {s.platform && <span className="text-[9px] text-slate-400">{s.platform}</span>}
                  </div>
                  <p className="text-xs font-medium text-slate-800">{s.description}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{s.content}</p>
                </div>
                <button
                  onClick={() => handleAddSuggestion(i, s)}
                  disabled={addedSuggestions.has(i)}
                  className={cn(
                    "shrink-0 px-2 py-1 rounded-full text-[10px] font-bold transition-colors",
                    addedSuggestions.has(i)
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-violet-100 text-violet-700 hover:bg-violet-200",
                  )}
                >
                  {addedSuggestions.has(i) ? <Check size={10} /> : <Plus size={10} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {suggestMutation.isError && (
        <p className="text-xs text-rose-500">{(suggestMutation.error as Error)?.message}</p>
      )}

      {showAdd && (
        <div className="border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-500">Tier</label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
              >
                <option value="cutdown">Cutdown (5-10min)</option>
                <option value="short">Short (15-60s)</option>
                <option value="text">Text (thread/post)</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-slate-500">Platform</label>
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
              >
                <option value="">Any</option>
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube Shorts</option>
                <option>X/Twitter</option>
                <option>LinkedIn</option>
              </select>
            </div>
          </div>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description..."
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="px-3 py-1 rounded-full bg-teal-600 text-white text-[10px] font-bold disabled:opacity-50"
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <GitBranch size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No derivatives tracked yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Add cutdowns, shorts, and text posts derived from this video
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Source video indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-xs font-bold text-teal-700">Source: {code}</span>
          </div>

          {/* Tier groups */}
          {(["cutdown", "short", "text"] as const).map((tier) => {
            const tierItems = grouped[tier];
            if (tierItems.length === 0) return null;
            const meta = TIER_META[tier];
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", meta.color)}>
                    {meta.label} ({tierItems.length})
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="space-y-1.5">
                  {tierItems.map((item) => {
                    const statusMeta = STATUS_META[item.status] || STATUS_META.idea;
                    return (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 truncate">{item.description || "Untitled derivative"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.platform && (
                              <span className="text-[9px] font-bold text-slate-400">{item.platform}</span>
                            )}
                            <button
                              onClick={() => {
                                const next = item.status === "idea" ? "created" : item.status === "created" ? "published" : "idea";
                                updateStatusMutation.mutate({ id: item.id, status: next });
                              }}
                              className={cn("text-[9px] font-bold", statusMeta.color)}
                            >
                              {statusMeta.label}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================
// Storyboard Tab
// ============================================

const SB_METHOD_COLORS: Record<string, { dot: string; label: string; text: string }> = {
  real: { dot: "bg-emerald-500", label: "text-emerald-700 bg-emerald-50", text: "Film" },
  ai_enhanced: { dot: "bg-blue-500", label: "text-blue-700 bg-blue-50", text: "AI Enhanced" },
  ai_generated: { dot: "bg-violet-500", label: "text-violet-700 bg-violet-50", text: "AI Generated" },
  motion_graphic: { dot: "bg-teal-500", label: "text-teal-700 bg-teal-50", text: "Motion Graphic" },
};

const SB_ACT_COLORS: Record<string, string> = {
  hook: "bg-rose-100 text-rose-700",
  conflict: "bg-amber-100 text-amber-700",
  build: "bg-sky-100 text-sky-700",
  resolution: "bg-emerald-100 text-emerald-700",
  cta: "bg-violet-100 text-violet-700",
};

const TECHNIQUE_COLORS: Record<string, string> = {
  set_enhancement: "bg-emerald-50 text-emerald-700",
  ai_transition: "bg-sky-50 text-sky-700",
  scene_extension: "bg-amber-50 text-amber-700",
  full_generation: "bg-violet-50 text-violet-700",
};

const StoryboardTab: React.FC<{ code: string }> = ({ code }) => {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [aiPrompts, setAiPrompts] = useState<AiGenerationPrompt[]>([]);
  const [visualStyles, setVisualStyles] = useState<VaultVisualStyle[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingPromptShot, setGeneratingPromptShot] = useState<number | null>(null);

  // Fetch storyboard, prompts, and visual styles on mount
  React.useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [sbRes, promptsRes, stylesRes] = await Promise.all([
          fetch(`/api/storyboards/${code}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/ai-prompts/${code}`).then((r) => (r.ok ? r.json() : { prompts: [] })),
          fetch(`/api/vault/visual-styles`).then((r) => (r.ok ? r.json() : { styles: [] })),
        ]);
        setStoryboard(sbRes?.storyboard ?? null);
        setAiPrompts(promptsRes?.prompts ?? []);
        setVisualStyles(stylesRes?.styles ?? []);
      } catch {
        // silently handle
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [code]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/storyboards/${code}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visualStyleId: selectedStyleId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStoryboard(data.storyboard ?? data);
        // Refresh prompts
        const promptsRes = await fetch(`/api/ai-prompts/${code}`).then((r) =>
          r.ok ? r.json() : { prompts: [] },
        );
        setAiPrompts(promptsRes?.prompts ?? []);
      }
    } catch {
      // silently handle
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePrompt = async (shotNumber: number) => {
    setGeneratingPromptShot(shotNumber);
    try {
      const res = await fetch(`/api/ai-prompts/generate-for-shot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCode: code, shotNumber }),
      });
      if (res.ok) {
        const promptsRes = await fetch(`/api/ai-prompts/${code}`).then((r) =>
          r.ok ? r.json() : { prompts: [] },
        );
        setAiPrompts(promptsRes?.prompts ?? []);
      }
    } catch {
      // silently handle
    } finally {
      setGeneratingPromptShot(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleShotExpand = (shotNumber: number) => {
    setExpandedShots((prev) => {
      const next = new Set(prev);
      if (next.has(shotNumber)) next.delete(shotNumber);
      else next.add(shotNumber);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading storyboard...
      </div>
    );
  }

  const shots = storyboard?.shots ?? [];
  const methodCounts = shots.reduce<Record<string, number>>((acc, s) => {
    acc[s.productionMethod] = (acc[s.productionMethod] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Generation Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Generate Storyboard
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {visualStyles.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                Visual Style (optional)
              </label>
              <select
                value={selectedStyleId ?? ""}
                onChange={(e) => setSelectedStyleId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
              >
                <option value="">Default</option>
                {visualStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {storyboard ? "Regenerate" : "Generate"} Storyboard
          </button>
        </div>
      </div>

      {/* Storyboard Display */}
      {storyboard && (
        <>
          {/* Summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Storyboard
              </p>
              <span
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full",
                  storyboard.status === "draft" && "bg-slate-100 text-slate-600",
                  storyboard.status === "approved" && "bg-emerald-50 text-emerald-700",
                  storyboard.status === "in_production" && "bg-amber-50 text-amber-700",
                  storyboard.status === "completed" && "bg-teal-50 text-teal-700",
                )}
              >
                {storyboard.status?.replace("_", " ") ?? storyboard.status}
              </span>
            </div>
            {storyboard.oneSentenceConcept && (
              <p className="text-sm text-slate-600 mb-3 italic">
                {storyboard.oneSentenceConcept}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {shots.length} shots
              {Object.keys(methodCounts).length > 0 && ": "}
              {Object.entries(methodCounts)
                .map(([method, count]) => `${count} ${SB_METHOD_COLORS[method]?.text.toLowerCase() ?? method}`)
                .join(", ")}
              {storyboard.totalDurationSeconds != null && (
                <> &middot; {storyboard.totalDurationSeconds}s total</>
              )}
            </p>
          </div>

          {/* Shot Cards */}
          <div className="space-y-3">
            {shots
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((shot) => {
                const method = SB_METHOD_COLORS[shot.productionMethod] ?? SB_METHOD_COLORS.real;
                const shotPrompts = aiPrompts.filter((p) => p.shotNumber === shot.shotNumber);
                const isExpanded = expandedShots.has(shot.shotNumber);

                return (
                  <div
                    key={shot.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5"
                  >
                    {/* Shot Header */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">
                        Shot {shot.shotNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {shot.durationSeconds}s
                      </span>
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", method.dot)} />
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full",
                          method.label,
                        )}
                      >
                        {method.text}
                      </span>
                      {shot.act && (
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full",
                            SB_ACT_COLORS[shot.act] ?? "bg-slate-100 text-slate-600",
                          )}
                        >
                          {shot.act}
                        </span>
                      )}
                      {shot.brollType && (
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          B-roll: {shot.brollType}
                        </span>
                      )}
                    </div>

                    {/* Technique Context Badges */}
                    {(() => {
                      const formatId = code.charAt(0);
                      const badges: React.ReactNode[] = [];
                      if (shot.productionMethod === "ai_generated") {
                        const defaults = CINEMA_DEFAULTS_BY_FORMAT[formatId];
                        if (defaults) {
                          badges.push(
                            <span key="cam" className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                              {defaults.camera} &middot; {defaults.lens} {defaults.focalLength}
                            </span>,
                          );
                        }
                      }
                      if (shot.productionMethod === "ai_enhanced" || shot.productionMethod === "ai_generated") {
                        const rec = recommendToolAndModel(shot.productionMethod, shot.shotType ?? null, shot.act ?? null);
                        if (rec) {
                          badges.push(
                            <span key="tool" className="text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                              {rec.tool} &middot; {rec.model}
                            </span>,
                          );
                        }
                      }
                      if (badges.length > 0) {
                        const moveSuggestion = suggestCameraMovement(
                          shot.shotType ?? null,
                          shot.act ?? null,
                          shot.productionMethod,
                          formatId,
                        );
                        if (moveSuggestion && shot.cameraMovement !== moveSuggestion.movement) {
                          badges.push(
                            <span key="move" className="text-[10px] font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5" title={moveSuggestion.reason}>
                              Suggested: {moveSuggestion.movement}
                            </span>,
                          );
                        }
                      }
                      return badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mb-2">{badges}</div>
                      ) : null;
                    })()}

                    {/* Script Line */}
                    {shot.scriptLine && (
                      <p className="text-sm text-slate-600 mb-2">{shot.scriptLine}</p>
                    )}

                    {/* Cinema Studio Prompt (for AI generated shots) */}
                    {shot.cinemaStudioPrompt && shot.productionMethod === "ai_generated" && (
                      <div className="bg-slate-50 rounded-lg p-3 mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-600 font-mono flex-1">
                            {shot.cinemaStudioPrompt}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(shot.cinemaStudioPrompt!, `cinema-${shot.id}`)
                            }
                            className="flex-shrink-0 text-slate-400 hover:text-teal-600 transition-colors"
                          >
                            {copiedId === `cinema-${shot.id}` ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* AI Enhancement Notes (for AI enhanced shots) */}
                    {shot.aiEnhancementNotes && shot.productionMethod === "ai_enhanced" && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">
                          Enhancement Notes
                        </p>
                        <p className="text-xs text-blue-700">{shot.aiEnhancementNotes}</p>
                      </div>
                    )}

                    {/* Remotion Component (for motion graphic shots) */}
                    {shot.remotionComponent && shot.productionMethod === "motion_graphic" && (
                      <div className="bg-teal-50 rounded-lg p-3 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-1">
                          Remotion Component
                        </p>
                        <p className="text-xs text-teal-700 font-mono">{shot.remotionComponent}</p>
                      </div>
                    )}

                    {/* AI Prompts Section */}
                    {shot.productionMethod !== "real" && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => toggleShotExpand(shot.shotNumber)}
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Sparkles size={12} />
                          AI Prompts ({shotPrompts.length})
                          <span className="text-[8px]">{isExpanded ? "▲" : "▼"}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-3">
                            {shotPrompts.map((prompt) => (
                              <div
                                key={prompt.id}
                                className="bg-slate-50 rounded-lg p-3"
                              >
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span
                                    className={cn(
                                      "text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full",
                                      TECHNIQUE_COLORS[prompt.technique] ?? "bg-slate-100 text-slate-600",
                                    )}
                                  >
                                    {prompt.technique.replace(/_/g, " ")}
                                  </span>
                                  {prompt.tool && (
                                    <span className="text-[10px] text-slate-400">{prompt.tool}</span>
                                  )}
                                  {prompt.model && (
                                    <span className="text-[10px] text-slate-400">{prompt.model}</span>
                                  )}
                                  {prompt.resultRating != null && (
                                    <span className="flex items-center gap-0.5">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                          key={i}
                                          size={10}
                                          className={
                                            i < prompt.resultRating!
                                              ? "fill-amber-400 text-amber-400"
                                              : "text-slate-200"
                                          }
                                        />
                                      ))}
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  readOnly
                                  value={prompt.promptText}
                                  className="w-full text-xs text-slate-600 font-mono bg-white border border-slate-200 rounded-lg p-2 resize-none"
                                  rows={3}
                                />
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() =>
                                      copyToClipboard(prompt.promptText, `prompt-${prompt.id}`)
                                    }
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                  >
                                    {copiedId === `prompt-${prompt.id}` ? (
                                      <Check size={12} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                    Copy Prompt
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Generate Prompt Button */}
                            <button
                              onClick={() => handleGeneratePrompt(shot.shotNumber)}
                              disabled={generatingPromptShot === shot.shotNumber}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                            >
                              {generatingPromptShot === shot.shotNumber ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Wand2 size={12} />
                              )}
                              Generate Prompt
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Empty State */}
      {!storyboard && !isGenerating && (
        <div className="text-center py-12">
          <Film size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">No storyboard yet</p>
          <p className="text-xs text-slate-400">
            Generate a storyboard to plan your shots, production methods, and AI prompts.
          </p>
        </div>
      )}
    </div>
  );
};
