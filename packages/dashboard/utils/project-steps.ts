/**
 * Step-status computation for ProjectDetail's stepper.
 *
 * Given a project + its kind definition, returns the status of each step
 * (todo | active | done | skipped). The first non-done, non-skipped step is "active".
 */
import type { ProjectWithAssets } from "../shared/types.js";
import type { ProjectKindDefinition, ProjectKindBriefSection, StepId } from "../shared/project-kinds.js";

export type StepStatus = "todo" | "active" | "done" | "skipped";

export type ComputedStep = {
  id: StepId;
  label: string;
  hint: string;
  status: StepStatus;
};

/** Parse the brief markdown into a map of `## Heading` → content. */
export function parseBriefSections(briefMd: string | null): Record<string, string> {
  if (!briefMd) return {};
  const result: Record<string, string> = {};
  const lines = briefMd.split("\n");
  let currentHeading: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (currentHeading) {
      result[currentHeading] = buf.join("\n").trim();
    }
  };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      currentHeading = m[1].trim();
      buf = [];
    } else if (currentHeading) {
      buf.push(line);
    }
  }
  flush();
  return result;
}

/** Re-serialize parsed sections back into markdown (heading-preserving). */
export function serializeBriefSections(sections: Record<string, string>, schema: ProjectKindBriefSection[]): string {
  return schema
    .map((s) => `## ${s.heading}\n${(sections[s.heading] ?? "").trim()}`)
    .join("\n\n")
    .trim() + "\n";
}

/** Whether every required brief section has at least its minLength of content. */
export function isBriefComplete(briefMd: string | null, schema: ProjectKindBriefSection[]): boolean {
  if (!briefMd) return false;
  const sections = parseBriefSections(briefMd);
  return schema
    .filter((s) => s.required)
    .every((s) => (sections[s.heading] ?? "").trim().length >= (s.minLength ?? 1));
}

/** Per-section completion ratio for the brief editor's progress indicator. */
export function briefCompletionPercent(briefMd: string | null, schema: ProjectKindBriefSection[]): number {
  const sections = parseBriefSections(briefMd);
  const required = schema.filter((s) => s.required);
  if (required.length === 0) return 100;
  const filled = required.filter((s) => (sections[s.heading] ?? "").trim().length >= (s.minLength ?? 1)).length;
  return Math.round((filled / required.length) * 100);
}

/** Compute the status of every step for a given project. */
export function computeStepStatuses(project: ProjectWithAssets, def: ProjectKindDefinition): ComputedStep[] {
  const briefDone = isBriefComplete(project.briefMd, def.briefSections);
  const refsDone = project.refs.length >= def.refsMinimum;
  // Expected outputs minimum = sum of counts (defaulting count to 1)
  const expectedCount = def.expectedOutputs.reduce((sum, o) => sum + (o.count ?? 1), 0);
  const generateDone = project.outputs.length >= Math.max(1, Math.floor(expectedCount * 0.5));
  const reviewDone = project.status === "ready" || project.status === "published";
  const shipDone = project.status === "published";

  const isStepDone: Record<StepId, boolean> = {
    brief: briefDone,
    refs: refsDone,
    generate: generateDone,
    review: reviewDone,
    ship: shipDone,
  };

  // Skipped: refs step is skipped if refsMinimum is 0
  const isStepSkipped: Record<StepId, boolean> = {
    brief: false,
    refs: def.refsMinimum === 0,
    generate: false,
    review: false,
    ship: false,
  };

  // Find the first non-done, non-skipped step → that's "active"
  const firstActiveIdx = def.steps.findIndex((s) => !isStepDone[s.id] && !isStepSkipped[s.id]);

  return def.steps.map((step, idx) => {
    let status: StepStatus;
    if (isStepSkipped[step.id]) {
      status = "skipped";
    } else if (isStepDone[step.id]) {
      status = "done";
    } else if (idx === firstActiveIdx) {
      status = "active";
    } else {
      status = "todo";
    }
    return { id: step.id, label: step.label, hint: step.hint, status };
  });
}

/** The currently-active step id (or null if the project is fully done). */
export function activeStepId(steps: ComputedStep[]): StepId | null {
  return steps.find((s) => s.status === "active")?.id ?? null;
}
