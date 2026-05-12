import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Rocket,
  Repeat2,
  Mic,
  GitBranch,
  Wand2,
  Image as ImageIcon,
  Gift,
  Film,
  BookOpen,
  Heart,
  Compass,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import type { QuickStartTemplate, Project, DashboardView } from "../../shared/types.js";
import { PROJECT_KIND_REGISTRY } from "../../shared/project-kinds.js";
import { Eyebrow } from "./Eyebrow.js";

const ICON_MAP: Record<string, React.ReactNode> = {
  Rocket: <Rocket size={16} />,
  Repeat2: <Repeat2 size={16} />,
  Mic: <Mic size={16} />,
  GitBranch: <GitBranch size={16} />,
  Wand2: <Wand2 size={16} />,
  Image: <ImageIcon size={16} />,
  Gift: <Gift size={16} />,
  Film: <Film size={16} />,
  BookOpen: <BookOpen size={16} />,
  Heart: <Heart size={16} />,
  Compass: <Compass size={16} />,
  LayoutGrid: <LayoutGrid size={16} />,
  Sparkles: <Sparkles size={16} />,
};

type Props = {
  onOpenProject: (projectId: string) => void;
  onNavigate?: (view: DashboardView) => void;
  /** Optional routing hooks for specialist surfaces. If provided, the gallery dispatches
   * to them when a template's kind has generationMode.type === "route". */
  onOpenStorytellingReelForProject?: (projectId: string) => void;
  onOpenMarketingStudioForProject?: (projectId: string) => void;
};

/**
 * Quick-start template gallery — two visual groups ("Your brand" + "Higgsfield showcase").
 * Each card creates a new Project (kind matches template) with a pre-populated brief, then
 * opens it in ProjectDetail.
 *
 * Maps to the "100 things you can build with the Higgsfield MCP" pattern from Aidan's video,
 * tailored to Jordan's chiropractic brand + adjacent / holiday / general use cases.
 */
export const QuickStartGallery: React.FC<Props> = ({ onOpenProject, onNavigate, onOpenStorytellingReelForProject, onOpenMarketingStudioForProject }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ templates: QuickStartTemplate[] }>({
    queryKey: ["quickstart-templates"],
    queryFn: () => fetch("/api/projects/templates").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const createFromTemplate = useMutation({
    mutationFn: async (templateKey: string) => {
      const res = await fetch("/api/projects/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey }),
      });
      if (!res.ok) throw new Error("Failed to create from template");
      return (await res.json()) as { project: Project };
    },
    onSuccess: ({ project }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      // Dispatch to specialist surface if the kind has route-type generation
      const def = PROJECT_KIND_REGISTRY[project.kind as keyof typeof PROJECT_KIND_REGISTRY];
      const mode = def?.generationMode;
      if (mode?.type === "route" && mode.surface === "storytelling-reel-modal" && onOpenStorytellingReelForProject) {
        onOpenStorytellingReelForProject(project.id);
        return;
      }
      if (mode?.type === "route" && mode.surface === "marketing-studio-modal" && onOpenMarketingStudioForProject) {
        onOpenMarketingStudioForProject(project.id);
        return;
      }
      onOpenProject(project.id);
    },
  });

  if (isLoading) {
    return (
      <section className="space-y-4">
        <Eyebrow>Start something</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface-secondary h-32 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  const templates = data?.templates ?? [];
  const brand = templates.filter((t) => t.group === "brand");
  const showcase = templates.filter((t) => t.group === "showcase");

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Eyebrow>Start something</Eyebrow>
          <h2 className="type-h3 mt-1">Pick a template, drop a brief, get a finished asset.</h2>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate("PROJECTS")}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-700 transition-colors"
          >
            All projects <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Your brand */}
      <div className="space-y-3">
        <p className="type-eyebrow type-eyebrow-accent">Your brand</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {brand.map((t) => (
            <TemplateCard
              key={t.key}
              template={t}
              loading={createFromTemplate.isPending && createFromTemplate.variables === t.key}
              onClick={() => createFromTemplate.mutate(t.key)}
            />
          ))}
        </div>
      </div>

      {/* Higgsfield showcase */}
      <div className="space-y-3">
        <p className="type-eyebrow text-slate-500">Higgsfield showcase</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {showcase.map((t) => (
            <TemplateCard
              key={t.key}
              template={t}
              loading={createFromTemplate.isPending && createFromTemplate.variables === t.key}
              onClick={() => createFromTemplate.mutate(t.key)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const TemplateCard: React.FC<{ template: QuickStartTemplate; onClick: () => void; loading: boolean }> = ({ template, onClick, loading }) => {
  const icon = ICON_MAP[template.icon] ?? <Sparkles size={16} />;
  const def = PROJECT_KIND_REGISTRY[template.projectKind];
  const mode = def?.generationMode;
  const isComingSoon = mode?.type === "template_only" && mode.comingSoon === true;
  const isRoute = mode?.type === "route";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={clsx(
        "surface-secondary text-left transition-all group disabled:opacity-60 relative",
        !loading && "hover:border-teal-300 hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={clsx(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          isComingSoon ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-teal-700",
        )}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="type-h4 truncate group-hover:text-teal-700 transition-colors">{template.displayName}</h3>
            {loading && <Loader2 size={14} className="animate-spin text-teal-500 shrink-0" />}
          </div>
          <p className="type-meta line-clamp-2 mb-2">{template.blurb}</p>
          <div className="flex items-center gap-2 type-meta tabular-nums">
            <span>{template.estimatedCreditsLow}–{template.estimatedCreditsHigh} cr</span>
            <span className="text-slate-300">·</span>
            <span>~{template.estimatedMinutes} min</span>
            {isRoute && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-teal-700 font-semibold">opens specialist</span>
              </>
            )}
          </div>
        </div>
      </div>
      {isComingSoon && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
          Soon
        </span>
      )}
    </button>
  );
};
