import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Plus,
  Loader2,
  Rocket,
  Sparkles,
  Film,
  LayoutGrid,
  Image as ImageIcon,
  Repeat2,
  GitBranch,
  Gift,
  Mic,
  Wand2,
  Compass,
  X,
} from "lucide-react";
import type { Project, ProjectKind, ProjectStatus, DashboardView } from "../shared/types.js";
import { Heading, Eyebrow, Button, Pill } from "./ui/index.js";
import { cn as clsx } from "../utils/cn.js";

type Props = {
  onOpenProject: (id: string) => void;
  onNavigate?: (view: DashboardView) => void;
};

const KIND_META: Record<ProjectKind, { icon: React.ReactNode; label: string; group: "Your brand" | "Showcase" }> = {
  brand_launch: { icon: <Rocket size={14} />, label: "Brand launch", group: "Showcase" },
  viral_replication: { icon: <Repeat2 size={14} />, label: "Viral replication", group: "Showcase" },
  avatar_ugc: { icon: <Mic size={14} />, label: "Avatar UGC", group: "Showcase" },
  ad_variants: { icon: <GitBranch size={14} />, label: "Ad variants", group: "Showcase" },
  product_360: { icon: <Wand2 size={14} />, label: "Product 360", group: "Showcase" },
  press_kit: { icon: <ImageIcon size={14} />, label: "Press kit", group: "Showcase" },
  holiday_variant: { icon: <Gift size={14} />, label: "Holiday variant", group: "Showcase" },
  storytelling_reel: { icon: <Film size={14} />, label: "Storytelling reel", group: "Your brand" },
  chiropractic_explainer: { icon: <Sparkles size={14} />, label: "Explainer", group: "Your brand" },
  patient_story: { icon: <Sparkles size={14} />, label: "Patient story", group: "Your brand" },
  office_tour: { icon: <Compass size={14} />, label: "Office tour", group: "Your brand" },
  did_you_know: { icon: <LayoutGrid size={14} />, label: "Did you know", group: "Your brand" },
  generic: { icon: <FolderKanban size={14} />, label: "Generic", group: "Your brand" },
};

const STATUS_TONE: Record<ProjectStatus, "info" | "warning" | "success" | "muted" | "accent" | "danger"> = {
  drafting: "info",
  generating: "warning",
  ready: "accent",
  published: "success",
  archived: "muted",
};

export const ProjectsView: React.FC<Props> = ({ onOpenProject, onNavigate }) => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects", statusFilter],
    queryFn: () => fetch(`/api/projects${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const projects = data?.projects ?? [];

  const createMut = useMutation({
    mutationFn: async (body: { name: string; kind: ProjectKind }) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      return (await res.json()) as { project: Project };
    },
    onSuccess: ({ project }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      onOpenProject(project.id);
    },
  });

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FolderKanban size={24} className="text-teal-600" />
            <h1 className="type-h1">Projects</h1>
          </div>
          <p className="type-body">
            Every brief, reference, and generated asset lives in a project. Pick a quick-start template or start blank.
          </p>
        </div>
        <Button variant="primary" tone="teal" size="md" icon={<Plus />} onClick={() => setShowCreate(true)}>
          New project
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "drafting", "generating", "ready", "published", "archived"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700",
            )}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface-secondary h-40 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} onNavigate={onNavigate} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={(name, kind) => createMut.mutate({ name, kind })}
          pending={createMut.isPending}
        />
      )}
    </div>
  );
};

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const meta = KIND_META[project.kind] ?? KIND_META.generic;
  return (
    <button onClick={onClick} className="surface-secondary text-left hover:border-teal-300 hover:shadow-md transition-all group">
      {project.thumbnailUrl ? (
        <img src={project.thumbnailUrl} alt="" className="w-full aspect-video rounded-xl object-cover mb-4 bg-slate-100" loading="lazy" />
      ) : (
        <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 mb-4 flex items-center justify-center text-slate-300">
          <FolderKanban size={32} />
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <Eyebrow icon={meta.icon}>{meta.label}</Eyebrow>
        <Pill variant={STATUS_TONE[project.status]} size="sm">{project.status}</Pill>
      </div>
      <h3 className="type-h4 mb-1.5 group-hover:text-teal-700 transition-colors">{project.name}</h3>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        {project.costCredits > 0 && <span className="tabular-nums">{project.costCredits.toFixed(1)} cr spent</span>}
        <span>{new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        {project.active && <Pill variant="accent" size="sm">Active</Pill>}
      </div>
    </button>
  );
};

const EmptyState: React.FC<{ onCreate: () => void; onNavigate?: (v: DashboardView) => void }> = ({ onCreate, onNavigate }) => (
  <div className="surface-secondary text-center py-16 px-6">
    <FolderKanban size={36} className="text-teal-300 mx-auto mb-4" />
    <h2 className="type-h3 mb-2">No projects yet</h2>
    <p className="type-body max-w-md mx-auto mb-6">
      A project bundles a brief, reference uploads, and every generated asset together. Start with a quick-start template
      from Home, or create a blank project.
    </p>
    <div className="flex items-center justify-center gap-3">
      <Button variant="primary" tone="teal" icon={<Plus />} onClick={onCreate}>
        New blank project
      </Button>
      {onNavigate && (
        <Button variant="secondary" onClick={() => onNavigate("HOME")}>
          Browse templates
        </Button>
      )}
    </div>
  </div>
);

const CreateProjectModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, kind: ProjectKind) => void;
  pending: boolean;
}> = ({ onClose, onCreate, pending }) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>("generic");

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="surface-elevated max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="type-eyebrow text-teal-700 mb-1">New project</p>
            <h2 className="type-h3">Create a project</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <Eyebrow className="mb-2 block">Name</Eyebrow>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring posture campaign"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm bg-white"
            />
          </div>
          <div>
            <Eyebrow className="mb-2 block">Kind</Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(KIND_META) as [ProjectKind, typeof KIND_META[ProjectKind]][]).map(([k, meta]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                    kind === k
                      ? "border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20"
                      : "border-slate-200 text-slate-700 hover:border-slate-300",
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/40 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            tone="teal"
            disabled={!name.trim() || pending}
            loading={pending}
            onClick={() => onCreate(name.trim(), kind)}
            icon={<Plus />}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
};
