import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Router } from "express";
import { parseContentLibrary } from "../parsers/content-library.js";
import type {
  FormatId,
  ParsedVideo,
  RenderJob,
  RenderJobStatus,
} from "../../shared/types.js";

type RenderJobInternal = RenderJob & {
  outputPath: string;
  propsJson: string;
};

const COMPOSITION_BY_FORMAT: Record<FormatId, string> = {
  A: "Explainer",
  B: "Checklist",
  C: "Demo",
  D: "MythBuster",
  E: "Walkthrough",
};

const DEFAULT_THEME = {
  primaryColor: "#0d9488",
  accentColor: "#faf5ef",
  darkBackground: "#1a1a2e",
  lightBackground: "#faf5ef",
  textColor: "#ffffff",
  headingFont: "Georgia",
  bodyFont: "Nunito Sans",
};

const MAX_CONCURRENT_RENDERS = 1;
let runningRenders = 0;

const jobsByCode = new Map<string, RenderJobInternal[]>();
const jobsById = new Map<string, RenderJobInternal>();
const queue: RenderJobInternal[] = [];

const toPublicJob = (job: RenderJobInternal): RenderJob => ({
  id: job.id,
  videoCode: job.videoCode,
  compositionId: job.compositionId,
  status: job.status,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  outputUrl: job.outputUrl,
  error: job.error,
});

const cleanScriptLines = (script: string): string[] => {
  return script
    .split("\n")
    .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
    .filter((line) => line.length > 0);
};

const chunkLines = (lines: string[], chunkCount: number): string[] => {
  if (lines.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const size = Math.max(1, Math.ceil(lines.length / chunkCount));

  for (let i = 0; i < lines.length; i += size) {
    const chunk = lines.slice(i, i + size).join(" ").trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
};

const sentenceStart = (text: string): string => {
  const first = text.split(/[.!?]/)[0]?.trim() || text.trim();
  return first.length > 0 ? first : text;
};

const buildCta = (video: ParsedVideo): string => {
  return `Save this and share it with someone in ${video.audienceLabel}.`;
};

const buildPropsForVideo = (video: ParsedVideo): unknown => {
  const compositionId = COMPOSITION_BY_FORMAT[video.format];
  const scriptLines = cleanScriptLines(video.script);
  const hook = scriptLines[0] || video.title;

  if (compositionId === "Explainer") {
    const body = scriptLines.slice(1);
    const sectionChunks = chunkLines(body, 3);
    const sectionText = sectionChunks.length > 0 ? sectionChunks : [hook];

    return {
      title: video.title,
      hookText: hook,
      sections: sectionText.slice(0, 4).map((text, index) => ({
        label: `Point ${index + 1}`,
        text,
        durationInSeconds: 6,
      })),
      stat: video.tags.length
        ? { value: video.tags[0], label: video.audienceLabel }
        : undefined,
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "Checklist") {
    const rawItems = video.shots.length
      ? video.shots.map((shot) => ({
          label: sentenceStart(shot.prompt).slice(0, 70),
          description:
            shot.cameraMovement?.trim().length > 0
              ? `Camera: ${shot.cameraMovement}`
              : sentenceStart(shot.prompt),
        }))
      : scriptLines.slice(1).map((line) => ({
          label: sentenceStart(line).slice(0, 70),
          description: line,
        }));

    const items = rawItems.slice(0, 6).map((item, index) => ({
      number: index + 1,
      label: item.label || `Checklist item ${index + 1}`,
      description: item.description || item.label || "Key point",
    }));

    const ensuredItems = items.length >= 2
      ? items
      : [
          { number: 1, label: "Check your form", description: "Watch posture and movement quality." },
          { number: 2, label: "Track symptoms", description: "Notice what improves and what persists." },
        ];

    return {
      title: video.title,
      hookText: hook,
      items: ensuredItems,
      closingText: `How many applied to ${video.audienceLabel}?`,
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "Demo") {
    const rawSteps = video.shots.length
      ? video.shots.map((shot) => sentenceStart(shot.prompt))
      : scriptLines.slice(1);

    const steps = rawSteps.slice(0, 6).map((instruction) => ({
      instruction: instruction || "Follow the demonstrated movement slowly.",
    }));

    const ensuredSteps = steps.length > 0
      ? steps
      : [{ instruction: "Follow the demonstrated movement slowly." }];

    return {
      title: video.title,
      hookText: hook,
      steps: ensuredSteps,
      keyCue: video.deliveryCues[0] || "Move with control and steady breathing.",
      frequency: "2-3 sets daily",
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "MythBuster") {
    const myth = scriptLines[0] || video.title;
    const truth = scriptLines[1] || "Here is what the evidence says.";
    const explanation = scriptLines.slice(2).join(" ") || truth;

    return {
      mythText: myth,
      truthText: truth,
      explanationText: explanation,
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  const walkSteps = (video.shots.length
    ? video.shots.map((shot) => ({
        label: shot.cameraMovement || `Step ${shot.number}`,
        description: sentenceStart(shot.prompt),
      }))
    : scriptLines.slice(1).map((line, index) => ({
        label: `Step ${index + 1}`,
        description: line,
      })))
    .slice(0, 6)
    .map((step, index) => ({
      stepNumber: index + 1,
      label: step.label || `Step ${index + 1}`,
      description: step.description || "Follow the guided process.",
    }));

  const ensuredWalkSteps = walkSteps.length >= 2
    ? walkSteps
    : [
        { stepNumber: 1, label: "Assessment", description: "Review your baseline and goals." },
        { stepNumber: 2, label: "Action", description: "Apply the recommended steps consistently." },
      ];

  return {
    title: video.title,
    hookText: hook,
    steps: ensuredWalkSteps,
    reassuranceText: "This process is designed to be clear, practical, and repeatable.",
    ctaText: buildCta(video),
    theme: DEFAULT_THEME,
  };
};

const runNextJob = (repoRoot: string, remotionEntry: string) => {
  if (runningRenders >= MAX_CONCURRENT_RENDERS) {
    return;
  }

  const next = queue.find((job) => job.status === "queued");
  if (!next) {
    return;
  }

  runningRenders += 1;
  next.status = "running";
  next.startedAt = new Date().toISOString();

  const args = [
    "remotion",
    "render",
    remotionEntry,
    next.compositionId,
    next.outputPath,
    "--props",
    next.propsJson,
  ];

  const child = spawn("npx", args, {
    cwd: repoRoot,
    env: process.env,
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    logs += String(chunk);
  });

  child.on("close", (code) => {
    next.completedAt = new Date().toISOString();

    if (code === 0) {
      next.status = "completed";
      next.outputUrl = `/rendered/${path.basename(next.outputPath)}`;
      next.error = null;
    } else {
      next.status = "failed";
      next.outputUrl = null;
      next.error = logs.slice(-1200) || `Render failed with exit code ${code}`;
    }

    runningRenders = Math.max(0, runningRenders - 1);
    runNextJob(repoRoot, remotionEntry);
  });
};

export function createRendersRouter(
  contentLibraryPath: string,
  repoRoot: string,
  renderOutputDir: string,
) {
  const router = Router();
  const remotionEntry = path.join(
    repoRoot,
    "packages",
    "remotion-studio",
    "src",
    "index.ts",
  );

  fs.mkdirSync(renderOutputDir, { recursive: true });

  router.get("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const jobs = jobsByCode.get(code) ?? [];
    res.json({ jobs: jobs.map(toPublicJob) });
  });

  router.post("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((item) => item.code.toUpperCase() === code);

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const compositionId = COMPOSITION_BY_FORMAT[video.format];
    const createdAt = new Date().toISOString();
    const outputFileName = `${video.code}-${Date.now()}.mp4`;
    const outputPath = path.join(renderOutputDir, outputFileName);

    const job: RenderJobInternal = {
      id: randomUUID(),
      videoCode: video.code,
      compositionId,
      status: "queued" satisfies RenderJobStatus,
      createdAt,
      startedAt: null,
      completedAt: null,
      outputUrl: null,
      error: null,
      outputPath,
      propsJson: JSON.stringify(buildPropsForVideo(video)),
    };

    const existing = jobsByCode.get(video.code) ?? [];
    jobsByCode.set(video.code, [job, ...existing].slice(0, 20));
    jobsById.set(job.id, job);
    queue.push(job);

    runNextJob(repoRoot, remotionEntry);

    res.status(202).json({ job: toPublicJob(job) });
  });

  router.get("/job/:id", (req, res) => {
    const job = jobsById.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Render job not found" });
      return;
    }
    res.json({ job: toPublicJob(job) });
  });

  return router;
}
