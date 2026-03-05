import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, FileText, Camera, Sparkles, Wand2, Loader2, CircleAlert, Download, Play, Layers, Pencil, Clock, ListChecks } from "lucide-react";
import type {
  VideoDetailResponse,
  RenderJob,
  RenderJobsResponse,
  ShotsResponse,
  VibeMotionComponent,
  TimelineResponse,
  ProductionPlan,
} from "../shared/types.js";
import { TimelineView } from "./TimelineView.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { AudienceBadge } from "./ui/AudienceBadge.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { CopyButton } from "./ui/CopyButton.js";
import { SkillButton } from "./ui/SkillButton.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { FEATURE_HINTS } from "../shared/help-content.js";
import { cn } from "../utils/cn.js";

type VideoDetailProps = {
  code: string;
  onClose: () => void;
  onOpenComposer?: (code: string) => void;
};

type Tab = "script" | "shots" | "info" | "timeline" | "production";

export const VideoDetail: React.FC<VideoDetailProps> = ({ code, onClose, onOpenComposer }) => {
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
    enabled: activeTab === "production",
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "script", label: "Script", icon: <FileText size={16} /> },
    { id: "shots", label: "Shots", icon: <Camera size={16} /> },
    { id: "timeline", label: "Timeline", icon: <Clock size={16} /> },
    { id: "production", label: "Production", icon: <ListChecks size={16} /> },
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
              {onOpenComposer && (
                <FeatureHint id="composer-button" content={FEATURE_HINTS["composer-button"].content} side="left">
                  <button
                    onClick={() => onOpenComposer(code)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors min-h-[36px] bg-violet-600 text-white hover:bg-violet-700"
                  >
                    <Pencil size={12} />
                    Composer
                  </button>
                </FeatureHint>
              )}
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
                <ShotCard
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
              {activeTab === "production" && (
                <ProductionTab code={code} plan={productionPlanData?.plan ?? null} isLoading={!productionPlanData} />
              )}
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

// ============================================
// Production Tab
// ============================================

const ProductionTab: React.FC<{ code: string; plan: ProductionPlan | null; isLoading: boolean }> = ({ code, plan, isLoading }) => {
  if (isLoading) return <div className="text-center py-12 text-slate-400">Loading...</div>;

  if (!plan) {
    return (
      <div className="text-center py-12">
        <ListChecks size={32} className="text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 mb-1">No production plan yet.</p>
        <p className="text-xs text-slate-400 mb-4">Generate one with the video-director skill.</p>
        <SkillButton skill="/video-director" args={code} label="Generate Plan" icon={<Wand2 size={12} />} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

      {plan.shotList.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Shot List ({plan.shotList.length})
            </p>
            <CopyButton text={plan.shotList.join("\n")} label="Copy All" />
          </div>
          <div className="space-y-2">
            {plan.shotList.map((shot, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700">{shot}</p>
                </div>
                <CopyButton text={shot} />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Generated {plan.generatedAt}
      </p>
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

const ShotCard: React.FC<{
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
