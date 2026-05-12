/**
 * Shared helpers for project orchestrators.
 *
 * Each orchestrator (generate-brand-kit, generate-explainer, generate-patient-story,
 * generate-carousel, generate-holiday-variant) follows the same async-fire pattern:
 *   1. Set project.status = "generating"
 *   2. Log each stage as queued → running → completed/failed
 *   3. Use predictVirality with the right mode for the kind
 *   4. Record outputs via recordProjectOutput
 *   5. Set project.status = "ready" on success, back to "drafting" on crash
 *
 * Stages are referenced by string IDs (e.g. "shot_1", "motion_piece", "carousel_slide_3")
 * so the UI can render a stable timeline.
 */
import { sqlite } from "../db.js";
import { parseBriefSections } from "../../utils/project-steps.js";
import type { ProjectKind } from "../../shared/types.js";

export type StageStatus = "queued" | "running" | "completed" | "failed";

export type GenerationLogRow = {
  id: number;
  projectId: string;
  stage: string;
  status: StageStatus;
  message: string | null;
  createdAt: string;
};

/** Log a stage transition. UI dedupes to latest status per stage. */
export function logStage(projectId: string, stage: string, status: StageStatus, message?: string): void {
  sqlite.prepare(`
    INSERT INTO project_generation_log (project_id, stage, status, message)
    VALUES (?, ?, ?, ?)
  `).run(projectId, stage, status, message ?? null);
}

/** Queue many stages at once at the start of an orchestrator run. */
export function queueStages(projectId: string, stageIds: string[]): void {
  const stmt = sqlite.prepare(`
    INSERT INTO project_generation_log (project_id, stage, status, message) VALUES (?, ?, 'queued', NULL)
  `);
  const tx = sqlite.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(projectId, id);
  });
  tx(stageIds);
}

/** Fetch the latest stage entries for a project (deduped to latest status per stage). */
export function readGenerationLog(projectId: string): GenerationLogRow[] {
  // Get the most-recent row per stage, sorted by insertion order.
  const rows = sqlite.prepare(`
    SELECT g.* FROM project_generation_log g
    INNER JOIN (
      SELECT stage, MAX(id) AS max_id FROM project_generation_log WHERE project_id = ? GROUP BY stage
    ) latest ON g.id = latest.max_id
    WHERE g.project_id = ?
    ORDER BY g.id ASC
  `).all(projectId, projectId) as Array<{
    id: number; project_id: string; stage: string; status: string; message: string | null; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    stage: r.stage,
    status: r.status as StageStatus,
    message: r.message,
    createdAt: r.created_at,
  }));
}

/** Get the most recent row for one specific stage. */
export function readStageStatus(projectId: string, stage: string): GenerationLogRow | null {
  const r = sqlite.prepare(`
    SELECT * FROM project_generation_log
    WHERE project_id = ? AND stage = ?
    ORDER BY id DESC LIMIT 1
  `).get(projectId, stage) as { id: number; project_id: string; stage: string; status: string; message: string | null; created_at: string } | undefined;
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    stage: r.stage,
    status: r.status as StageStatus,
    message: r.message,
    createdAt: r.created_at,
  };
}

/** Mark every queued/running stage as failed (used on orchestrator crash). */
export function failPendingStages(projectId: string, message: string): void {
  const log = readGenerationLog(projectId);
  for (const row of log) {
    if (row.status === "queued" || row.status === "running") {
      logStage(projectId, row.stage, "failed", message);
    }
  }
}

/** Clear all log rows for a project (used by retry-stage to start fresh on retry). */
export function clearProjectLog(projectId: string): void {
  sqlite.prepare("DELETE FROM project_generation_log WHERE project_id = ?").run(projectId);
}

/** Read parsed brief sections for the project. */
export function readBriefSections(briefMd: string | null): Record<string, string> {
  return parseBriefSections(briefMd);
}

/**
 * Map ProjectKind → virality predictor mode.
 * Brand-aligned chiropractic kinds score against the Master Blueprint.
 * Showcase / brand-launch / holiday score against the project's own brief.
 */
export function viralityModeForKind(kind: ProjectKind): "brand" | "showcase" {
  const brandKinds: ProjectKind[] = ["chiropractic_explainer", "patient_story", "office_tour", "did_you_know"];
  return brandKinds.includes(kind) ? "brand" : "showcase";
}
