import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FolderKanban,
  Upload,
  Trash2,
  Loader2,
  Sparkles,
  Save,
  Play,
  Image as ImageIcon,
  FileCode,
  Film,
  Pin,
  PinOff,
  ExternalLink,
} from "lucide-react";
import type { ProjectWithAssets, ProjectStatus, ProjectOutput, ProjectRef } from "../shared/types.js";
import { Heading, Eyebrow, Button, Pill } from "./ui/index.js";
import { cn } from "../utils/cn.js";

type Props = {
  projectId: string;
  onBack: () => void;
};

const STATUS_TONE: Record<ProjectStatus, "info" | "warning" | "success" | "muted" | "accent" | "danger"> = {
  drafting: "info",
  generating: "warning",
  ready: "accent",
  published: "success",
  archived: "muted",
};

export const ProjectDetail: React.FC<Props> = ({ projectId, onBack }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ project: ProjectWithAssets }>({
    queryKey: ["project", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const [briefMd, setBriefMd] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeOutput, setActiveOutput] = useState<ProjectOutput | null>(null);
  const briefInitializedRef = useRef(false);

  useEffect(() => {
    if (data?.project && !briefInitializedRef.current) {
      setBriefMd(data.project.briefMd ?? "");
      briefInitializedRef.current = true;
    }
  }, [data]);

  const saveBrief = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefMd }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    },
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/set-active`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-active"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: ProjectStatus) =>
      fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const generateBrandKit = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/generate-brand-kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/refs`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const deleteRef = useMutation({
    mutationFn: (refId: number) =>
      fetch(`/api/projects/${projectId}/refs/${refId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  if (isLoading || !data?.project) {
    return (
      <div className="p-6 md:p-12 max-w-7xl mx-auto">
        <Loader2 size={20} className="animate-spin text-teal-500" />
      </div>
    );
  }
  const project = data.project;

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 mb-3 transition-colors">
            <ArrowLeft size={13} /> Back to projects
          </button>
          <div className="flex items-center gap-3 mb-2 min-w-0">
            <FolderKanban size={20} className="text-teal-600 shrink-0" />
            <h1 className="type-h1 truncate">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill variant={STATUS_TONE[project.status]}>{project.status}</Pill>
            <Pill variant="muted">{project.kind.replace(/_/g, " ")}</Pill>
            {project.costCredits > 0 && <Pill variant="warning">{project.costCredits.toFixed(1)} cr spent</Pill>}
            {project.active && <Pill variant="accent">Active</Pill>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            tone={project.active ? "teal" : "slate"}
            icon={project.active ? <PinOff /> : <Pin />}
            onClick={() => toggleActive.mutate()}
            disabled={toggleActive.isPending}
          >
            {project.active ? "Unpin" : "Pin as active"}
          </Button>
          {project.kind === "brand_launch" && project.status !== "generating" && (
            <Button
              variant="primary"
              tone="teal"
              icon={<Sparkles />}
              loading={generateBrandKit.isPending}
              disabled={generateBrandKit.isPending || (project.briefMd ?? "").length < 20}
              onClick={() => generateBrandKit.mutate()}
            >
              Generate brand kit
            </Button>
          )}
          {project.status === "generating" && (
            <Pill variant="warning"><Loader2 size={12} className="animate-spin mr-1" /> Generating…</Pill>
          )}
          {project.status === "ready" && (
            <Button variant="primary" tone="emerald" onClick={() => updateStatus.mutate("published")}>
              Mark published
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* LEFT — Brief + Refs */}
        <div className="space-y-6">
          <section className="surface-secondary">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Brief</Eyebrow>
              <Button
                variant="ghost"
                size="sm"
                icon={savedFlash ? undefined : <Save />}
                onClick={() => saveBrief.mutate()}
                disabled={saveBrief.isPending}
              >
                {savedFlash ? "Saved" : "Save"}
              </Button>
            </div>
            <textarea
              value={briefMd}
              onChange={(e) => setBriefMd(e.target.value)}
              placeholder={"## Brand\n\n## Mood\n\n## Hero subject\n\n## Audience"}
              rows={14}
              className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-mono leading-relaxed bg-white text-slate-800 resize-y"
            />
          </section>

          <section className="surface-secondary">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>References ({project.refs.length})</Eyebrow>
              <Button
                variant="ghost"
                size="sm"
                icon={<Upload />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadRef.isPending}
              >
                {uploadRef.isPending ? "Uploading..." : "Add file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadRef.mutate(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
            </div>
            {project.refs.length === 0 ? (
              <p className="type-meta">No references yet. Add reference images to anchor your generation prompts.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {project.refs.map((r) => (
                  <RefTile key={r.id} ref={r} onDelete={() => deleteRef.mutate(r.id)} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT — Outputs */}
        <section className="surface-secondary min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Outputs ({project.outputs.length})</Eyebrow>
          </div>
          {project.outputs.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles size={28} className="text-teal-300 mx-auto mb-3" />
              <p className="type-body max-w-sm mx-auto">
                Nothing generated yet. Fill in the brief, add reference images, then run a generation from a quick-start
                template on Home.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {project.outputs.map((o) => (
                <OutputTile key={o.id} output={o} onClick={() => setActiveOutput(o)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {activeOutput && <OutputPreview output={activeOutput} onClose={() => setActiveOutput(null)} />}
    </div>
  );
};

const RefTile: React.FC<{ ref: ProjectRef; onDelete: () => void }> = ({ ref, onDelete }) => {
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square group">
      {ref.kind === "image" && ref.url ? (
        <img src={ref.url} alt={ref.label ?? ""} className="w-full h-full object-cover" loading="lazy" />
      ) : ref.kind === "video" && ref.url ? (
        <video src={ref.url} className="w-full h-full object-cover" muted />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-300">
          <ImageIcon size={20} />
        </div>
      )}
      <button
        onClick={onDelete}
        title="Remove reference"
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
      >
        <Trash2 size={13} />
      </button>
      {ref.label && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[9px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
          {ref.label}
        </span>
      )}
    </div>
  );
};

const OutputTile: React.FC<{ output: ProjectOutput; onClick: () => void }> = ({ output, onClick }) => {
  const isVideo = output.kind === "video";
  const isHtml = output.kind === "html";

  return (
    <button onClick={onClick} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square group text-left hover:border-teal-300 hover:shadow-md transition-all">
      {output.url && !isHtml ? (
        <img src={output.url} alt={output.label ?? ""} className="w-full h-full object-cover" loading="lazy" />
      ) : isHtml ? (
        <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-2">
          <FileCode size={28} className="text-teal-500" />
          <span className="type-meta">Landing page</span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-300">
          <ImageIcon size={24} />
        </div>
      )}
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Play size={32} className="text-white drop-shadow-lg" fill="currentColor" />
        </span>
      )}
      {output.predictedVirality != null && (
        <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-teal-600 text-white px-1.5 py-0.5 rounded-full tabular-nums shadow">
          {Math.round(output.predictedVirality)}/100
        </span>
      )}
      <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[9px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
        {output.label ?? output.kind}
      </span>
    </button>
  );
};

const OutputPreview: React.FC<{ output: ProjectOutput; onClose: () => void }> = ({ output, onClose }) => {
  const isVideo = output.kind === "video";
  const isHtml = output.kind === "html";
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="surface-elevated max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video bg-slate-900 relative">
          {isVideo && output.url ? (
            <video controls autoPlay className="w-full h-full object-contain">
              <source src={output.url} />
            </video>
          ) : isHtml && output.url ? (
            <iframe src={output.url} className="w-full h-full bg-white" title={output.label ?? "Landing page"} />
          ) : output.url ? (
            <img src={output.url} alt="" className="w-full h-full object-contain" />
          ) : null}
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>{output.kind} · {output.modelUsed ?? "?"}</Eyebrow>
              <h3 className="type-h4 mt-1">{output.label}</h3>
            </div>
            <div className="flex items-center gap-2">
              {output.predictedVirality != null && (
                <Pill variant="accent">Score {Math.round(output.predictedVirality)}/100</Pill>
              )}
              {output.url && (
                <Button as="a" variant="secondary" size="sm" href={output.url} target="_blank" rel="noreferrer" icon={<ExternalLink />}>
                  Open
                </Button>
              )}
            </div>
          </div>
          {output.prompt && <p className="type-body whitespace-pre-wrap">{output.prompt}</p>}
        </div>
      </div>
    </div>
  );
};
