import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FolderKanban,
  Upload,
  Trash2,
  Loader2,
  Sparkles,
  Play,
  Image as ImageIcon,
  FileCode,
  FileText,
  Pin,
  PinOff,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Download,
  Send,
  Lock,
} from "lucide-react";
import type { ProjectWithAssets, ProjectStatus, ProjectOutput, ProjectRef } from "../shared/types.js";
import {
  Heading,
  Eyebrow,
  Button,
  Pill,
  BriefEditor,
  ProjectStepper,
  ExpectedOutputsStrip,
  ProjectGenerationTimeline,
  OutputActionsMenu,
} from "./ui/index.js";
import { VisualSystemLock } from "./ui/VisualSystemLock.js";
import { PROJECT_KIND_REGISTRY, PROJECT_STATUS_LABELS } from "../shared/project-kinds.js";
import { computeStepStatuses, activeStepId } from "../utils/project-steps.js";
import { enqueueCanvasImport } from "./CanvasView.js";
import type { DashboardView } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type Props = {
  projectId: string;
  onBack: () => void;
  /** Optional: open the Storytelling Reel modal with a projectId pre-set */
  onOpenStorytellingReelForProject?: (projectId: string) => void;
  /** Optional: open the Marketing Studio modal with a projectId pre-set */
  onOpenMarketingStudioForProject?: (projectId: string) => void;
  /** Optional: jump to the Canvas view (after enqueueing imports) */
  onNavigateToCanvas?: () => void;
};

const STATUS_TONE: Record<ProjectStatus, "info" | "warning" | "success" | "muted" | "accent" | "danger"> = {
  drafting: "info",
  generating: "warning",
  ready: "accent",
  published: "success",
  archived: "muted",
};

export const ProjectDetail: React.FC<Props> = ({
  projectId,
  onBack,
  onOpenStorytellingReelForProject,
  onOpenMarketingStudioForProject,
  onNavigateToCanvas,
}) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ project: ProjectWithAssets }>({
    queryKey: ["project", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`).then((r) => r.json()),
    refetchInterval: (data) => (data?.state?.data?.project?.status === "generating" ? 5_000 : 30_000),
  });

  // Shared cache hit with ProjectGenerationTimeline: poll the log so we can also
  // render placeholder tiles in the Outputs panel for stages that haven't shipped output yet.
  const isGeneratingForLog = data?.project?.status === "generating";
  const { data: logData } = useQuery<{ log: Array<{ stage: string; status: "queued" | "running" | "completed" | "failed" }> }>({
    queryKey: ["project-log", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/generation-log`).then((r) => r.json()),
    refetchInterval: isGeneratingForLog ? 2_000 : 30_000,
    staleTime: 1_000,
    enabled: !!data?.project,
  });

  const [briefDraft, setBriefDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeOutput, setActiveOutput] = useState<ProjectOutput | null>(null);
  const [carouselVariant, setCarouselVariant] = useState<"cinematic" | "editorial" | "bold" | "minimal">("cinematic");
  const [carouselSlideMix, setCarouselSlideMix] = useState<"mixed" | "all_cinematic" | "all_text">("mixed");
  const briefHydratedRef = useRef(false);

  useEffect(() => {
    if (data?.project && !briefHydratedRef.current) {
      setBriefDraft(data.project.briefMd ?? "");
      briefHydratedRef.current = true;
    }
  }, [data]);

  // Auto-save brief on debounce
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!data?.project) return;
    if (briefDraft === (data.project.briefMd ?? "")) return;
    if (briefDraft === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = briefDraft;
      fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefMd: briefDraft }),
      }).then(() => {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      });
    }, 800);
    return () => clearTimeout(t);
  }, [briefDraft, data, projectId, qc]);

  const toggleActive = useMutation({
    mutationFn: () => fetch(`/api/projects/${projectId}/set-active`, { method: "POST" }).then((r) => r.json()),
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

  const retry = useMutation({
    mutationFn: () => fetch(`/api/projects/${projectId}/retry`, { method: "POST" }).then((r) => r.json()),
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
    mutationFn: (refId: number) => fetch(`/api/projects/${projectId}/refs/${refId}`, { method: "DELETE" }).then((r) => r.json()),
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
  const def = PROJECT_KIND_REGISTRY[project.kind] ?? PROJECT_KIND_REGISTRY.generic;
  const steps = computeStepStatuses(project, def);
  const activeStep = activeStepId(steps);
  const isGenerating = project.status === "generating";

  // Placeholder tiles: every queued/running stage that doesn't already have an output
  const existingLabels = new Set(project.outputs.map((o) => o.label).filter(Boolean));
  const pendingStages = isGenerating
    ? (logData?.log ?? [])
        .filter((r) => (r.status === "queued" || r.status === "running") && !existingLabels.has(r.stage))
    : [];

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-7">
      {/* Top bar — back button */}
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 mb-3 transition-colors">
          <ArrowLeft size={13} /> Back to projects
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 min-w-0">
              <FolderKanban size={22} className="text-teal-600 shrink-0" />
              <h1 className="type-h1 truncate">{project.name}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Pill variant={STATUS_TONE[project.status]}>
                {project.status === "generating" && <Loader2 size={11} className="animate-spin mr-1" />}
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </Pill>
              <Pill variant="muted">{def.label}</Pill>
              {project.costCredits > 0 && <Pill variant="warning">{project.costCredits.toFixed(1)} cr</Pill>}
              {project.active && <Pill variant="accent">Active</Pill>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              tone={project.active ? "teal" : "slate"}
              size="sm"
              icon={project.active ? <PinOff /> : <Pin />}
              onClick={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
            >
              {project.active ? "Unpin" : "Pin"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <ProjectStepper steps={steps} />

      {/* Expected outputs strip */}
      <ExpectedOutputsStrip outputs={def.expectedOutputs} />

      {/* Current step panel — the answer to "what now?" */}
      <CurrentStepPanel
        project={project}
        kindDef={def}
        activeStep={activeStep}
        onGenerate={() => triggerGenerate({ project, def, briefDraft, onOpenStorytellingReelForProject, onOpenMarketingStudioForProject, qc, carouselVariant, carouselSlideMix })}
        carouselVariant={carouselVariant}
        onCarouselVariantChange={setCarouselVariant}
        carouselSlideMix={carouselSlideMix}
        onCarouselSlideMixChange={setCarouselSlideMix}
        onMarkPublished={() => updateStatus.mutate("published")}
        onAddRef={() => fileInputRef.current?.click()}
        onRetry={() => retry.mutate()}
        savedFlash={savedFlash}
      />

      {/* Generation timeline (only when there's log content) */}
      <ProjectGenerationTimeline projectId={project.id} isActive={isGenerating} />

      {/* Brief panel */}
      <section>
        <BriefEditor
          briefMd={briefDraft}
          schema={def.briefSections}
          disabled={isGenerating}
          onChange={setBriefDraft}
          projectId={projectId}
        />
      </section>

      {/* Visual style anchor — only for did_you_know (cinematic carousels) */}
      {project.kind === "did_you_know" && (
        <VisualSystemLock projectId={projectId} refs={project.refs} disabled={isGenerating} />
      )}

      {/* References */}
      {def.refsMinimum > 0 && (
        <section className="surface-secondary">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Eyebrow>References ({project.refs.length})</Eyebrow>
              <p className="type-meta mt-0.5">Min {def.refsMinimum} to generate</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadRef.isPending || isGenerating}
            >
              {uploadRef.isPending ? "Uploading…" : "Add file"}
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
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {project.refs.map((r) => (
                <RefTile key={r.id} refItem={r} onDelete={() => deleteRef.mutate(r.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Outputs */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <Eyebrow>Outputs ({project.outputs.length})</Eyebrow>
          {project.outputs.length > 0 && (
            <span className="type-meta">{project.outputs.filter((o) => o.predictedVirality != null).length} scored</span>
          )}
        </div>
        {project.outputs.length === 0 && pendingStages.length === 0 ? (
          <div className="surface-secondary text-center py-12">
            <Sparkles size={28} className="text-teal-300 mx-auto mb-3" />
            <p className="type-body max-w-md mx-auto">
              {def.expectedOutputs.length > 0
                ? "Outputs will appear here once you run the generation."
                : "This template is in preview. Save the brief; the orchestrator ships soon."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {project.outputs.map((o) => (
              <OutputTile
                key={o.id}
                output={o}
                projectId={projectId}
                onClick={() => setActiveOutput(o)}
                onSendToCanvas={(out) => {
                  if (!out.url) return;
                  enqueueCanvasImport({
                    kind: out.kind === "video" ? "brollVideo" : "broll",
                    url: out.url,
                    prompt: out.prompt ?? undefined,
                    label: out.label ?? undefined,
                  });
                  onNavigateToCanvas?.();
                }}
              />
            ))}
            {pendingStages.map((stage) => (
              <PlaceholderTile
                key={`pending-${stage.stage}`}
                stage={stage.stage}
                status={stage.status as "queued" | "running"}
              />
            ))}
          </div>
        )}
      </section>

      {activeOutput && <OutputPreview output={activeOutput} onClose={() => setActiveOutput(null)} />}
    </div>
  );
};

/**
 * Trigger the Generate action for whatever kind we're in.
 * orchestrator → POST the endpoint and let the timeline render progress.
 * route → open the specialist modal (project_id is passed so its outputs come back here).
 * template_only → no-op (UI shows "coming soon").
 */
function triggerGenerate(args: {
  project: ProjectWithAssets;
  def: typeof PROJECT_KIND_REGISTRY[keyof typeof PROJECT_KIND_REGISTRY];
  briefDraft: string;
  onOpenStorytellingReelForProject?: (id: string) => void;
  onOpenMarketingStudioForProject?: (id: string) => void;
  qc: ReturnType<typeof useQueryClient>;
  carouselVariant?: "cinematic" | "editorial" | "bold" | "minimal";
  carouselSlideMix?: "mixed" | "all_cinematic" | "all_text";
}) {
  const { project, def, briefDraft, onOpenStorytellingReelForProject, onOpenMarketingStudioForProject, qc, carouselVariant, carouselSlideMix } = args;
  const mode = def.generationMode;
  if (mode.type === "orchestrator") {
    const body: Record<string, unknown> = { briefMd: briefDraft };
    if (project.kind === "did_you_know") {
      if (carouselVariant) body.variant = carouselVariant;
      if (carouselSlideMix) body.slideMix = carouselSlideMix;
    }
    fetch(`/api/projects/${project.id}/${mode.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(() => qc.invalidateQueries({ queryKey: ["project", project.id] }));
    return;
  }
  if (mode.type === "route") {
    if (mode.surface === "storytelling-reel-modal") {
      onOpenStorytellingReelForProject?.(project.id);
    } else if (mode.surface === "marketing-studio-modal") {
      onOpenMarketingStudioForProject?.(project.id);
    }
    return;
  }
  // template_only — no-op
}

const CurrentStepPanel: React.FC<{
  project: ProjectWithAssets;
  kindDef: typeof PROJECT_KIND_REGISTRY[keyof typeof PROJECT_KIND_REGISTRY];
  activeStep: ReturnType<typeof activeStepId>;
  onGenerate: () => void;
  onMarkPublished: () => void;
  onAddRef: () => void;
  onRetry: () => void;
  savedFlash: boolean;
  carouselVariant?: "cinematic" | "editorial" | "bold" | "minimal";
  onCarouselVariantChange?: (v: "cinematic" | "editorial" | "bold" | "minimal") => void;
  carouselSlideMix?: "mixed" | "all_cinematic" | "all_text";
  onCarouselSlideMixChange?: (v: "mixed" | "all_cinematic" | "all_text") => void;
}> = ({ project, kindDef, activeStep, onGenerate, onMarkPublished, onAddRef, onRetry, savedFlash, carouselVariant, onCarouselVariantChange, carouselSlideMix, onCarouselSlideMixChange }) => {
  const isGenerating = project.status === "generating";
  const isTemplateOnly = kindDef.generationMode.type === "template_only";

  if (isGenerating) {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Loader2 size={20} className="animate-spin" />
          </span>
          <div className="flex-1 min-w-0">
            <Eyebrow tone="warning">Generating</Eyebrow>
            <h3 className="type-h3 mt-1">Working on your {kindDef.label.toLowerCase()}…</h3>
            <p className="type-body mt-1">Live progress below. You can leave this page — generation continues in the background.</p>
          </div>
          <Button variant="secondary" tone="rose" size="sm" icon={<RefreshCw />} onClick={onRetry} title="Cancel and reset (clears the log; you can re-run from scratch)">
            Reset
          </Button>
        </div>
      </div>
    );
  }

  if (project.status === "published") {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <Eyebrow tone="success">Published</Eyebrow>
            <h3 className="type-h3 mt-1">Project is published.</h3>
            <p className="type-body mt-1">Project assets remain available below. Mark archived to hide from active project list.</p>
          </div>
        </div>
      </div>
    );
  }

  if (project.status === "ready") {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <Eyebrow tone="accent">Ready to ship</Eyebrow>
            <h3 className="type-h3 mt-1">Generation complete.</h3>
            <p className="type-body mt-1">Review the outputs below. Use each tile's kebab to download or send to Canvas. When you've shipped, mark it published.</p>
          </div>
          <Button variant="primary" tone="emerald" icon={<Send />} onClick={onMarkPublished}>
            Mark published
          </Button>
        </div>
      </div>
    );
  }

  if (isTemplateOnly) {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Lock size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <Eyebrow>Template only — orchestrator coming soon</Eyebrow>
            <h3 className="type-h3 mt-1">{kindDef.generateCtaLabel}</h3>
            <p className="type-body mt-1">{kindDef.generateBlurb}</p>
            {savedFlash && <p className="text-xs text-emerald-600 font-semibold mt-2">Brief saved.</p>}
          </div>
        </div>
      </div>
    );
  }

  // Active step decides the CTA copy
  if (activeStep === "brief") {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-bold">1</span>
          <div className="flex-1 min-w-0">
            <Eyebrow>Current step</Eyebrow>
            <h3 className="type-h3 mt-1">Fill in the brief</h3>
            <p className="type-body mt-1">
              Complete every required section below. The orchestrator uses your brief verbatim — be specific.
            </p>
            {savedFlash && <p className="text-xs text-emerald-600 font-semibold mt-2">Saved.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (activeStep === "refs") {
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 font-bold">2</span>
          <div className="flex-1 min-w-0">
            <Eyebrow>Current step</Eyebrow>
            <h3 className="type-h3 mt-1">Add reference images</h3>
            <p className="type-body mt-1">
              At least {kindDef.refsMinimum} reference image needed to anchor your generation prompts.
            </p>
          </div>
          <Button variant="primary" tone="teal" icon={<Upload />} onClick={onAddRef}>
            Add reference
          </Button>
        </div>
      </div>
    );
  }

  if (activeStep === "generate") {
    const isCarousel = project.kind === "did_you_know";
    const willUseHiggsfield = isCarousel && carouselSlideMix !== "all_text";
    return (
      <div className="surface-primary !py-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <Eyebrow tone="accent">Ready to generate</Eyebrow>
            <h3 className="type-h3 mt-1">{kindDef.generateCtaLabel}</h3>
            <p className="type-body mt-1">{kindDef.generateBlurb}</p>
            {isCarousel && carouselVariant && onCarouselVariantChange && onCarouselSlideMixChange && carouselSlideMix && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="type-meta w-20">Look:</span>
                  {([
                    { v: "cinematic", label: "Cinematic" },
                    { v: "editorial", label: "Editorial" },
                    { v: "bold",      label: "Bold" },
                    { v: "minimal",   label: "Minimal" },
                  ] as const).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => onCarouselVariantChange(v)}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-full border transition-colors",
                        carouselVariant === v
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-700",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="type-meta w-20">Slide mix:</span>
                  {([
                    { v: "mixed",          label: "Mixed (recommended)" },
                    { v: "all_cinematic",  label: "All cinematic" },
                    { v: "all_text",       label: "All text" },
                  ] as const).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => onCarouselSlideMixChange(v)}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded-full border transition-colors",
                        carouselSlideMix === v
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-rose-400 hover:text-rose-700",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="type-meta italic">
                  {willUseHiggsfield
                    ? "~$0.15–0.40 estimated · 4–6 AI background images via Higgsfield Nano Banana 2."
                    : "Free · no AI image credits used."}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="primary"
            tone={kindDef.generationMode.type === "route" ? "slate" : "teal"}
            icon={kindDef.generationMode.type === "route" ? <ArrowRight /> : <Sparkles />}
            onClick={onGenerate}
          >
            {kindDef.generateCtaLabel}
          </Button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="surface-primary !py-5">
      <div className="flex items-start gap-4">
        <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">·</span>
        <div className="flex-1 min-w-0">
          <Eyebrow>Step</Eyebrow>
          <h3 className="type-h3 mt-1">Review outputs</h3>
          <p className="type-body mt-1">Pick winners, regenerate weaker assets, then ship.</p>
        </div>
      </div>
    </div>
  );
};

const RefTile: React.FC<{ refItem: ProjectRef; onDelete: () => void }> = ({ refItem, onDelete }) => {
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square group">
      {refItem.kind === "image" && refItem.url ? (
        <img src={refItem.url} alt={refItem.label ?? ""} className="w-full h-full object-cover" loading="lazy" />
      ) : refItem.kind === "video" && refItem.url ? (
        <video src={refItem.url} className="w-full h-full object-cover" muted />
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
      {refItem.label && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[9px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded">
          {refItem.label}
        </span>
      )}
    </div>
  );
};

const OutputTile: React.FC<{ output: ProjectOutput; onClick: () => void; projectId?: string; onSendToCanvas?: (output: ProjectOutput) => void }> = ({ output, onClick, projectId, onSendToCanvas }) => {
  const isVideo = output.kind === "video";
  const isHtml = output.kind === "html";
  const isText = output.kind === "text";

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square group transition-all hover:border-teal-300 hover:shadow-md">
      <button onClick={onClick} className="block w-full h-full text-left">
        {output.url && !isHtml && !isText ? (
          <img src={output.url} alt={output.label ?? ""} className="w-full h-full object-cover" loading="lazy" />
        ) : isHtml ? (
          <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-2">
            <FileCode size={28} className="text-teal-500" />
            <span className="type-meta">Landing page</span>
          </div>
        ) : isText ? (
          <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center gap-2 p-3">
            <FileText size={28} className="text-amber-600" />
            <span className="type-meta text-amber-700 text-center px-2 line-clamp-2">{output.label}</span>
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
      </button>
      {output.predictedVirality != null && (
        <span className={cn(
          "absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums shadow",
          output.predictedVirality >= 70 ? "bg-emerald-600 text-white" :
          output.predictedVirality >= 50 ? "bg-amber-500 text-white" :
          "bg-slate-700 text-white",
        )}>
          {Math.round(output.predictedVirality)}/100
        </span>
      )}
      <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[9px] font-medium bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
        {output.label ?? output.kind}
      </span>
      <div className="absolute top-1.5 right-1.5">
        <OutputActionsMenu output={output} projectId={projectId} onSendToCanvas={onSendToCanvas} />
      </div>
    </div>
  );
};

const STAGE_LABEL_FRIENDLY: Record<string, string> = {
  hero_v1: "Hero still 1",
  hero_v2: "Hero still 2",
  hero_v3: "Hero still 3",
  motion_piece: "Motion piece",
  social_cutdown: "Social cutdown",
  landing_page: "Landing page",
  hook_score: "Hook scoring",
  shot_1: "Teaching shot 1",
  shot_2: "Teaching shot 2",
  shot_3: "Teaching shot 3",
  shot_4: "Teaching shot 4",
  hero_motion: "Hero motion",
  script_draft: "Script draft",
  scene_1: "Scene 1",
  scene_2: "Scene 2",
  scene_3: "Scene 3",
  hero_clip: "Hero clip",
  caption_draft: "Caption draft",
  variant_1: "Themed variant 1",
  variant_2: "Themed variant 2",
  variant_3: "Themed variant 3",
  variant_4: "Variant 4",
  variant_5: "Variant 5",
  variant_6: "Variant 6",
  motion_variant: "Motion variant",
  hook_variant: "Hook variant",
  rebuilt_motion: "Rebuilt motion clip",
  frame_1: "Rotation frame 1",
  frame_2: "Rotation frame 2",
  frame_3: "Rotation frame 3",
  frame_4: "Rotation frame 4",
  frame_5: "Rotation frame 5",
  frame_6: "Rotation frame 6",
  frame_7: "Rotation frame 7",
  frame_8: "Rotation frame 8",
  square_1x1: "Square hero",
  portrait_4x5: "Portrait hero",
  wide_16x9: "Wide hero",
  story_9x16: "Story hero",
};

const PlaceholderTile: React.FC<{ stage: string; status: "queued" | "running" }> = ({ stage, status }) => {
  const label = STAGE_LABEL_FRIENDLY[stage] ?? stage.replace(/_/g, " ");
  const isRunning = status === "running";
  return (
    <div
      className={cn(
        "surface-secondary aspect-[3/4] flex flex-col items-center justify-center text-center p-3 border border-dashed",
        isRunning ? "border-amber-300 bg-amber-50/30" : "border-slate-200",
      )}
    >
      {isRunning ? (
        <Loader2 size={20} className="text-amber-500 animate-spin mb-2" />
      ) : (
        <Sparkles size={20} className="text-slate-300 mb-2" />
      )}
      <p className={cn("text-[12px] font-semibold leading-tight", isRunning ? "text-amber-700" : "text-slate-500")}>
        {label}
      </p>
      <p className="type-meta mt-1">{isRunning ? "Generating…" : "Queued"}</p>
    </div>
  );
};

const OutputPreview: React.FC<{ output: ProjectOutput; onClose: () => void }> = ({ output, onClose }) => {
  const isVideo = output.kind === "video";
  const isHtml = output.kind === "html";
  const isText = output.kind === "text";
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (isText && output.url) {
      fetch(output.url).then((r) => r.text()).then(setTextContent).catch(() => setTextContent(null));
    }
  }, [isText, output.url]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="surface-elevated max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className={cn("relative", isVideo || (!isText && !isHtml) ? "bg-slate-900 aspect-video" : isHtml ? "h-[60vh]" : "")}>
          {isVideo && output.url ? (
            <video controls autoPlay className="w-full h-full object-contain">
              <source src={output.url} />
            </video>
          ) : isHtml && output.url ? (
            <iframe src={output.url} className="w-full h-full bg-white" title={output.label ?? "Landing page"} />
          ) : isText && textContent ? (
            <div className="bg-amber-50 px-6 py-5 max-h-[60vh] overflow-y-auto">
              <pre className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">{textContent}</pre>
            </div>
          ) : output.url ? (
            <img src={output.url} alt="" className="w-full h-full object-contain" />
          ) : null}
        </div>
        <div className="p-6 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow>{output.kind} · {output.modelUsed ?? "?"}</Eyebrow>
              <h3 className="type-h4 mt-1 truncate">{output.label}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {output.predictedVirality != null && (
                <Pill variant="accent">Score {Math.round(output.predictedVirality)}/100</Pill>
              )}
              {output.url && (
                <Button as="a" variant="secondary" size="sm" href={output.url} download icon={<Download />}>
                  Download
                </Button>
              )}
              {output.url && (
                <Button as="a" variant="secondary" size="sm" href={output.url} target="_blank" rel="noreferrer" icon={<ExternalLink />}>
                  Open
                </Button>
              )}
            </div>
          </div>
          {output.prompt && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-700 font-medium">Prompt</summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{output.prompt}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
