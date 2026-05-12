import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, ExternalLink, AlertCircle, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { Eyebrow } from "./Eyebrow.js";

type Job = {
  id: string;
  status: string;
  modelKey: string | null;
  resultUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string;
  createdAt: string | null;
  type: string | null;
};
type RecentJobs = { jobs: Job[]; inFlightCount: number; error?: string };

/**
 * Recent Higgsfield generations grid — visual reel of the last ~12 jobs.
 * Shows running, completed, and failed states. Click a tile to preview / open in a new tab.
 *
 * Renders nothing when Higgsfield isn't configured.
 */
export const RecentGenerationsGrid: React.FC = () => {
  const { data, isLoading } = useQuery<RecentJobs>({
    queryKey: ["hf-recent-jobs-grid"],
    queryFn: () => fetch("/api/higgsfield/recent-jobs?limit=12").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const [previewJob, setPreviewJob] = useState<Job | null>(null);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Eyebrow>Recent generations</Eyebrow>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (data?.error || !data?.jobs?.length) {
    if (data?.error) {
      return (
        <section className="space-y-3">
          <Eyebrow>Recent generations</Eyebrow>
          <div className="surface-tertiary text-sm text-slate-500 flex items-center gap-2.5">
            <AlertCircle size={15} className="text-slate-400" />
            <span>Higgsfield is unreachable right now — recent jobs unavailable.</span>
          </div>
        </section>
      );
    }
    return (
      <section className="space-y-3">
        <Eyebrow>Recent generations</Eyebrow>
        <div className="surface-tertiary text-sm text-slate-500 flex items-center gap-2.5">
          <Sparkles size={15} className="text-slate-400" />
          <span>No recent generations yet. Start a quick-start template to see results here.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Recent generations</Eyebrow>
        <span className="type-meta">{data.jobs.length} shown · auto-refreshes every 30s</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {data.jobs.map((job) => (
          <GenerationTile key={job.id} job={job} onClick={() => setPreviewJob(job)} />
        ))}
      </div>

      {previewJob && <GenerationPreview job={previewJob} onClose={() => setPreviewJob(null)} />}
    </section>
  );
};

const GenerationTile: React.FC<{ job: Job; onClick: () => void }> = ({ job, onClick }) => {
  const isVideo = job.type === "video";
  const isRunning = job.status === "running" || job.status === "pending" || job.status === "queued";
  const isFailed = job.status === "failed" || job.status === "error";
  const isCompleted = job.status === "completed" || job.status === "succeeded" || job.resultUrl;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "aspect-square rounded-xl overflow-hidden border transition-all relative group bg-slate-100",
        isFailed ? "border-rose-200" : "border-slate-200 hover:border-teal-300 hover:shadow-md",
      )}
      title={job.prompt}
    >
      {isCompleted && job.thumbnailUrl ? (
        <>
          <img src={job.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          {isVideo && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={28} className="text-white drop-shadow-lg" fill="currentColor" />
            </span>
          )}
        </>
      ) : isRunning ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-100">
          <Loader2 size={16} className="animate-spin text-teal-500" />
          <span className="type-meta">{job.status}</span>
        </div>
      ) : isFailed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500" />
          <span className="type-meta text-rose-700">failed</span>
        </div>
      ) : (
        <div className="w-full h-full bg-slate-100" />
      )}

      {/* Model badge */}
      {job.modelKey && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[9px] font-medium bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded">
          {job.modelKey}
        </span>
      )}
    </button>
  );
};

const GenerationPreview: React.FC<{ job: Job; onClose: () => void }> = ({ job, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="surface-elevated max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-slate-900 relative">
          {job.type === "video" && job.resultUrl ? (
            <video controls autoPlay className="w-full h-full object-contain">
              <source src={job.resultUrl} />
            </video>
          ) : job.resultUrl ? (
            <img src={job.resultUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
        </div>
        <div className="p-6 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <Eyebrow>{job.modelKey || "Generation"}</Eyebrow>
            <span className="type-meta">{job.status}</span>
          </div>
          <p className="type-body">{job.prompt || "No prompt"}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {job.resultUrl && (
              <a
                href={job.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 transition-colors"
              >
                <ExternalLink size={13} /> Open full size
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
