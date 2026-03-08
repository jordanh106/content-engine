import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Router } from "express";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseVibeMotion } from "../parsers/vibe-motion.js";
import type {
  FormatId,
  ParsedVideo,
  RenderJob,
  RenderJobStatus,
  VibeMotionComponent,
} from "../../shared/types.js";
import { DEFAULT_THEME } from "../../shared/theme-defaults.js";

type RenderJobInternal = RenderJob & {
  outputPath: string;
  propsJson: string;
  targetFrames: number;
};

const COMPOSITION_BY_FORMAT: Record<FormatId, string> = {
  A: "Explainer",
  B: "Checklist",
  C: "Demo",
  D: "MythBuster",
  E: "Walkthrough",
  F: "QuickTip",
  G: "PatientStory",
};

const TARGET_SECONDS_BY_FORMAT: Record<FormatId, number> = {
  A: 14,
  B: 16,
  C: 16,
  D: 12,
  E: 16,
  F: 10,
  G: 18,
};


const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "to", "for", "of", "in", "on",
  "at", "with", "from", "your", "you", "is", "are", "be", "as", "it", "this",
  "that", "what", "why", "how", "during", "does", "do",
]);

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
  shotId: job.shotId,
  componentType: job.componentType,
});

const cleanScriptLines = (script: string): string[] => {
  return script
    .split("\n")
    .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
    .filter((line) => line.length > 0);
};

const stripPunctuation = (text: string): string => {
  return text.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
};

const toWords = (text: string): string[] => {
  return stripPunctuation(text)
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean);
};

const limitWords = (text: string, maxWords: number): string => {
  const words = toWords(text);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}...`;
};

const limitSentence = (text: string, maxWords: number, maxChars: number): string => {
  const sentence = sentenceStart(text);
  const wordsLimited = limitWords(sentence, maxWords);
  if (wordsLimited.length <= maxChars) {
    return wordsLimited;
  }
  return `${wordsLimited.slice(0, maxChars - 3).trim()}...`;
};

const toTitleCase = (text: string): string => {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const pickKeywords = (text: string, count: number): string[] => {
  const words = toWords(text)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const uniq: string[] = [];
  for (const word of words) {
    if (!uniq.includes(word)) {
      uniq.push(word);
    }
    if (uniq.length >= count) {
      break;
    }
  }
  return uniq;
};

const topicFromVideo = (video: ParsedVideo): string => {
  const fromTitle = pickKeywords(video.title, 3);
  if (fromTitle.length > 0) {
    return toTitleCase(fromTitle.join(" "));
  }
  if (video.tags.length > 0) {
    return toTitleCase(limitWords(video.tags[0], 3));
  }
  return "Core Topic";
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
  const topic = topicFromVideo(video);
  const hook = limitSentence(scriptLines[0] || video.title, 8, 52);
  const shortTitle = limitSentence(video.title, 7, 40);

  if (compositionId === "Explainer") {
    const sectionLabels = ["What", "Why", "Action"];
    const sectionText = [
      `${topic} in one line`,
      `Why ${limitWords(topic, 2)} matters`,
      `Start with one simple step`,
    ];

    return {
      title: shortTitle,
      hookText: hook,
      sections: sectionText.map((text, index) => ({
        label: sectionLabels[index] || `Point ${index + 1}`,
        text: limitSentence(text, 8, 50),
        durationInSeconds: 3,
      })),
      stat: video.tags.length
        ? {
            value: limitSentence(video.tags[0], 3, 20),
            label: limitSentence(video.audienceLabel, 4, 28),
          }
        : undefined,
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "Checklist") {
    const rawItems = video.shots.length
      ? video.shots.map((shot) => ({
          label: limitSentence(sentenceStart(shot.prompt), 4, 24),
          description:
            shot.cameraMovement?.trim().length > 0
              ? limitSentence(shot.cameraMovement, 3, 18)
              : "Check posture",
        }))
      : scriptLines.slice(1).map((line) => ({
          label: limitSentence(sentenceStart(line), 4, 24),
          description: "Watch this sign",
        }));

    const items = rawItems.slice(0, 4).map((item, index) => ({
      number: index + 1,
      label: item.label || `Checklist item ${index + 1}`,
      description: item.description || item.label || "Key point",
    }));

    const ensuredItems = items.length >= 2
      ? items
      : [
          { number: 1, label: "Check posture", description: "Neutral spine first" },
          { number: 2, label: "Check pain", description: "Track daily changes" },
        ];

    return {
      title: shortTitle,
      hookText: hook,
      items: ensuredItems,
      closingText: "How many matched?",
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "Demo") {
    const rawSteps = video.shots.length
      ? video.shots.map((shot) => limitSentence(sentenceStart(shot.prompt), 5, 32))
      : scriptLines.slice(1);

    const steps = rawSteps.slice(0, 3).map((instruction) => ({
      instruction: instruction || "Move with control",
    }));

    const ensuredSteps = steps.length > 0
      ? steps
      : [{ instruction: "Follow the demonstrated movement slowly." }];

    return {
      title: shortTitle,
      hookText: hook,
      steps: ensuredSteps,
      keyCue: limitSentence(video.deliveryCues[0] || "Slow, controlled reps", 5, 32),
      frequency: "2-3 sets daily",
      ctaText: buildCta(video),
      theme: DEFAULT_THEME,
    };
  }

  if (compositionId === "MythBuster") {
    const myth = limitSentence(scriptLines[0] || video.title, 8, 50);
    const truth = limitSentence(scriptLines[1] || "Evidence says otherwise", 8, 50);
    const explanation = limitSentence(scriptLines.slice(2).join(" ") || truth, 10, 72);

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
        label: limitSentence(shot.cameraMovement || `Step ${shot.number}`, 3, 16),
        description: limitSentence(sentenceStart(shot.prompt), 6, 40),
      }))
    : scriptLines.slice(1).map((line, index) => ({
        label: `Step ${index + 1}`,
        description: limitSentence(line, 6, 40),
      })))
    .slice(0, 3)
    .map((step, index) => ({
      stepNumber: index + 1,
      label: step.label || `Step ${index + 1}`,
      description: step.description || "Follow the guided process.",
    }));

  const ensuredWalkSteps = walkSteps.length >= 2
    ? walkSteps
    : [
        { stepNumber: 1, label: "Assess", description: "Baseline + goals" },
        { stepNumber: 2, label: "Act", description: "Apply the plan" },
      ];

  return {
    title: shortTitle,
    hookText: hook,
    steps: ensuredWalkSteps,
    reassuranceText: "Simple. Clear. Repeatable.",
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
    "--frames",
    `0-${Math.max(60, next.targetFrames - 1)}`,
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

  // GET /api/renders/queue - Global render queue status
  router.get("/queue", (_req, res) => {
    const allJobs = Array.from(jobsById.values()).map(toPublicJob);
    const queued = allJobs.filter((j) => j.status === "queued");
    const running = allJobs.filter((j) => j.status === "running");
    const completed = allJobs.filter((j) => j.status === "completed");
    const failed = allJobs.filter((j) => j.status === "failed");

    res.json({
      queued: queued.length,
      running: running.length,
      completed: completed.length,
      failed: failed.length,
      maxConcurrent: MAX_CONCURRENT_RENDERS,
      jobs: allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50),
    });
  });

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
    const targetFrames = TARGET_SECONDS_BY_FORMAT[video.format] * 30;

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
      shotId: null,
      componentType: null,
      outputPath,
      propsJson: JSON.stringify(buildPropsForVideo(video)),
      targetFrames,
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

  // ==========================================
  // Per-component shot endpoints
  // ==========================================

  // Get parsed Vibe Motion components for a video
  router.get("/:code/shots", (req, res) => {
    const code = req.params.code.toUpperCase();
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((item) => item.code.toUpperCase() === code);

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const components = parseVibeMotion(video.vibeMotion || "", video);
    const allJobs = jobsByCode.get(code) ?? [];
    const shotJobs = allJobs.filter((j) => j.shotId !== null);

    res.json({
      components,
      jobs: shotJobs.map(toPublicJob),
    });
  });

  // Render a single shot component
  router.post("/:code/shot/:shotId", (req, res) => {
    const code = req.params.code.toUpperCase();
    const shotId = req.params.shotId;

    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((item) => item.code.toUpperCase() === code);

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const components = parseVibeMotion(video.vibeMotion || "", video);
    const component = components.find((c) => c.id === shotId);

    if (!component) {
      res.status(404).json({ error: `Shot component '${shotId}' not found` });
      return;
    }

    const createdAt = new Date().toISOString();
    const outputFileName = `${video.code}-${component.componentType}-${component.durationInSeconds}s-${Date.now()}.mp4`;
    const outputPath = path.join(renderOutputDir, outputFileName);
    const targetFrames = component.durationInSeconds * 30;

    const job: RenderJobInternal = {
      id: randomUUID(),
      videoCode: video.code,
      compositionId: component.compositionId,
      status: "queued" satisfies RenderJobStatus,
      createdAt,
      startedAt: null,
      completedAt: null,
      outputUrl: null,
      error: null,
      shotId: component.id,
      componentType: component.componentType,
      outputPath,
      propsJson: JSON.stringify(component.props),
      targetFrames,
    };

    const existing = jobsByCode.get(video.code) ?? [];
    jobsByCode.set(video.code, [job, ...existing].slice(0, 50));
    jobsById.set(job.id, job);
    queue.push(job);

    runNextJob(repoRoot, remotionEntry);

    res.status(202).json({ job: toPublicJob(job) });
  });

  // Render all shot components for a video
  router.post("/:code/all-shots", (req, res) => {
    const code = req.params.code.toUpperCase();

    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((item) => item.code.toUpperCase() === code);

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const components = parseVibeMotion(video.vibeMotion || "", video);
    if (components.length === 0) {
      res.status(400).json({ error: "No motion components found for this video" });
      return;
    }

    const createdAt = new Date().toISOString();
    const jobs: RenderJobInternal[] = [];

    for (const component of components) {
      const outputFileName = `${video.code}-${component.componentType}-${component.durationInSeconds}s-${Date.now()}-${component.id}.mp4`;
      const outputPath = path.join(renderOutputDir, outputFileName);
      const targetFrames = component.durationInSeconds * 30;

      const job: RenderJobInternal = {
        id: randomUUID(),
        videoCode: video.code,
        compositionId: component.compositionId,
        status: "queued" satisfies RenderJobStatus,
        createdAt,
        startedAt: null,
        completedAt: null,
        outputUrl: null,
        error: null,
        shotId: component.id,
        componentType: component.componentType,
        outputPath,
        propsJson: JSON.stringify(component.props),
        targetFrames,
      };

      jobs.push(job);
      jobsById.set(job.id, job);
      queue.push(job);
    }

    const existing = jobsByCode.get(video.code) ?? [];
    jobsByCode.set(video.code, [...jobs, ...existing].slice(0, 50));

    runNextJob(repoRoot, remotionEntry);

    res.status(202).json({ jobs: jobs.map(toPublicJob) });
  });

  // Render from Composer (user-edited components with custom props)
  router.post("/:code/composer", (req, res) => {
    const code = req.params.code.toUpperCase();
    const body = req.body as {
      components?: {
        compositionId: string;
        props: Record<string, unknown>;
        durationInSeconds: number;
      }[];
    };

    if (!body.components || body.components.length === 0) {
      res.status(400).json({ error: "No components provided" });
      return;
    }

    const createdAt = new Date().toISOString();
    const jobs: RenderJobInternal[] = [];

    for (let i = 0; i < body.components.length; i++) {
      const comp = body.components[i];
      const compType = comp.compositionId.replace("Shot-", "");
      const outputFileName = `${code}-${compType}-${comp.durationInSeconds}s-${Date.now()}-${i}.mp4`;
      const outputPath = path.join(renderOutputDir, outputFileName);
      const targetFrames = comp.durationInSeconds * 30;

      const job: RenderJobInternal = {
        id: randomUUID(),
        videoCode: code,
        compositionId: comp.compositionId,
        status: "queued" satisfies RenderJobStatus,
        createdAt,
        startedAt: null,
        completedAt: null,
        outputUrl: null,
        error: null,
        shotId: `composer-${i}`,
        componentType: compType,
        outputPath,
        propsJson: JSON.stringify(comp.props),
        targetFrames,
      };

      jobs.push(job);
      jobsById.set(job.id, job);
      queue.push(job);
    }

    const existing = jobsByCode.get(code) ?? [];
    jobsByCode.set(code, [...jobs, ...existing].slice(0, 50));

    runNextJob(repoRoot, remotionEntry);

    res.status(202).json({ jobs: jobs.map(toPublicJob) });
  });

  return router;
}
