import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Circle, AlertCircle, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Eyebrow } from "./Eyebrow.js";

type LogRow = {
  id: number;
  projectId: string;
  stage: string;
  status: "queued" | "running" | "completed" | "failed";
  message: string | null;
  createdAt: string;
};
type LogResponse = { log: LogRow[] };

type Props = {
  projectId: string;
  isActive: boolean;
};

/**
 * Live timeline of orchestrator progress. Polls every 2s while active, every 30s otherwise.
 *
 * Friendly labels for known stage IDs are mapped below; unknown stages fall back to
 * a humanised version of the raw stage string.
 */
const STAGE_LABELS: Record<string, string> = {
  // brand_launch
  hero_v1: "Hero still 1",
  hero_v2: "Hero still 2",
  hero_v3: "Hero still 3",
  motion_piece: "Motion piece",
  social_cutdown: "Social cutdown (9:16)",
  landing_page: "Landing page HTML",
  // explainer
  hook_score: "Hook scored",
  shot_1: "Teaching shot 1",
  shot_2: "Teaching shot 2",
  shot_3: "Teaching shot 3",
  shot_4: "Teaching shot 4",
  hero_motion: "Hero motion clip",
  script_draft: "Script draft",
  // patient story
  scene_1: "Scene 1",
  scene_2: "Scene 2",
  scene_3: "Scene 3",
  hero_clip: "Hero clip",
  caption_draft: "Caption draft",
  // carousel
  expand_slides: "Slide expansion",
  // holiday
  variant_1: "Themed variant 1",
  variant_2: "Themed variant 2",
  variant_3: "Themed variant 3",
  motion_variant: "Motion variant",
  // viral replication
  hook_variant: "Hook variant",
  rebuilt_motion: "Rebuilt motion clip",
  // ad variants
  variant_4: "Variant 4",
  variant_5: "Variant 5",
  variant_6: "Variant 6",
  // product 360
  frame_1: "Rotation frame 1 (0°)",
  frame_2: "Rotation frame 2 (45°)",
  frame_3: "Rotation frame 3 (90°)",
  frame_4: "Rotation frame 4 (135°)",
  frame_5: "Rotation frame 5 (180°)",
  frame_6: "Rotation frame 6 (225°)",
  frame_7: "Rotation frame 7 (270°)",
  frame_8: "Rotation frame 8 (315°)",
  // press kit
  square_1x1: "Square hero (1:1)",
  portrait_4x5: "Portrait hero (4:5)",
  wide_16x9: "Wide hero (16:9)",
  story_9x16: "Story hero (9:16)",
};

export const ProjectGenerationTimeline: React.FC<Props> = ({ projectId, isActive }) => {
  const { data } = useQuery<LogResponse>({
    queryKey: ["project-log", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/generation-log`).then((r) => r.json()),
    refetchInterval: isActive ? 2_000 : 30_000,
    staleTime: 1_000,
  });

  const log = data?.log ?? [];
  if (log.length === 0) return null;

  return (
    <div className="surface-secondary !p-5">
      <Eyebrow className="mb-4">Progress</Eyebrow>
      <div className="space-y-2">
        {log.map((row) => (
          <StageRow key={row.stage} row={row} projectId={projectId} />
        ))}
      </div>
    </div>
  );
};

const StageRow: React.FC<{ row: LogRow; projectId: string }> = ({ row, projectId }) => {
  const label = STAGE_LABELS[row.stage] ?? row.stage.replace(/_/g, " ");
  const icon = row.status === "completed" ? <Check size={14} className="text-teal-600" />
    : row.status === "running" ? <Loader2 size={14} className="text-amber-500 animate-spin" />
    : row.status === "failed" ? <AlertCircle size={14} className="text-rose-500" />
    : <Circle size={14} className="text-slate-300" />;

  const qc = useQueryClient();
  const [retryError, setRetryError] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/projects/${projectId}/retry-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: row.stage }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.hint || body.error || `retry failed (${r.status})`);
      }
      return r.json();
    },
    onMutate: () => setRetryError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-log", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err: Error) => setRetryError(err.message),
  });

  return (
    <div className={clsx(
      "flex items-start gap-2.5 py-1.5 px-2 rounded-lg transition-colors",
      row.status === "running" && "bg-amber-50/40",
      row.status === "failed" && "bg-rose-50/40",
    )}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={clsx(
            "text-sm",
            row.status === "completed" && "text-slate-700 font-medium",
            row.status === "running" && "text-slate-900 font-semibold",
            row.status === "failed" && "text-rose-700 font-semibold",
            row.status === "queued" && "text-slate-500",
          )}>
            {label}
          </span>
          {row.status === "queued" && <span className="type-meta">queued</span>}
          {row.status === "running" && <span className="type-meta text-amber-700">running…</span>}
          {row.status === "failed" && (
            <button
              type="button"
              onClick={() => retry.mutate()}
              disabled={retry.isPending}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
            >
              <RefreshCw size={11} className={retry.isPending ? "animate-spin" : ""} />
              {retry.isPending ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
        {row.message && (
          <p className={clsx(
            "text-[11px] mt-0.5 truncate",
            row.status === "failed" ? "text-rose-600" : "text-slate-500",
          )}>
            {row.message}
          </p>
        )}
        {retryError && (
          <p className="text-[11px] mt-0.5 text-rose-600">{retryError}</p>
        )}
      </div>
    </div>
  );
};
