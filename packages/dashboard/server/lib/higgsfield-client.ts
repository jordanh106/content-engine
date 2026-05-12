/**
 * Higgsfield CLI client — spawns the official `higgsfield` binary as a subprocess.
 *
 * Auth: OAuth via `higgsfield auth login` (stored in ~/.higgsfield, draws from the main account credits).
 * Install: `npm install -g @higgsfield/cli` or `brew install higgsfield-ai/tap/higgsfield`.
 *
 * Discovered surface (probed on 2026-05-11):
 *   higgsfield generate create <job_set_type> --prompt "..." --aspect_ratio 9:16 --resolution 1k --wait --json --no-color
 *   → returns JSON array: [{ id, status, result_url, display_name, job_set_type, created_at, params }]
 *
 *   higgsfield account status              → "email — plan, N credits" (textual; --json gives structured)
 *   higgsfield auth token                  → token text on success, exit 2 + "Not authenticated." on failure
 *   higgsfield model list --image --json   → [{ display_name, job_set_type, type }, ...]
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";

const execFileP = promisify(execFile);

// Curated catalog of CLI model job_set_types. Image-first since that's all the
// current Tier A + B use. Add video models when we wire up the video tier.
export const HIGGSFIELD_MODELS = {
  // ── Images (cheapest → fanciest)
  nano_banana_2: "nano_banana_2",          // Nano Banana Pro — default. 2 credits @ 1k.
  nano_banana_flash: "nano_banana_flash",  // Nano Banana 2 (Flash) — fastest.
  soul: "text2image_soul_v2",              // Higgsfield Soul V2 — character consistency.
  soul_cinematic: "soul_cinematic",        // Soul Cinematic — cinematic stills.
  gpt_image: "gpt_image_2",                // GPT Image 2 — photorealism / hero quality.
  flux: "flux_2",                          // FLUX.2.
  seedream: "seedream_v4_5",               // Seedream 4.5.
  // ── Videos (image→video)
  seedance: "seedance_2_0",                // Seedance 2.0.
  kling: "kling3_0",                       // Kling v3.0.
  veo: "veo3_1",                           // Google Veo 3.1.
} as const;

export type HiggsfieldModelKey = keyof typeof HIGGSFIELD_MODELS;

/** Public catalog metadata for the model picker UI. */
export type ImageModelInfo = {
  key: HiggsfieldModelKey;
  jobSetType: string;
  displayName: string;
  blurb: string;
  bestFor: string;
  /** Approx credits per image at the resolution we use. Verified 2026-05-11. */
  estimatedCredits: number;
  /** Param family: which dimension flag the model exposes. */
  paramFamily: "resolution" | "quality";
  /** Default value we set when generating with this model. */
  defaultParamValue: string;
};

export const IMAGE_MODEL_CATALOG: ImageModelInfo[] = [
  {
    key: "nano_banana_2",
    jobSetType: "nano_banana_2",
    displayName: "Nano Banana Pro",
    blurb: "Best photorealism in the lineup. Sharp subjects, clean composition.",
    bestFor: "B-Roll and hero thumbnails when you want photo-real action shots",
    estimatedCredits: 2,
    paramFamily: "resolution",
    defaultParamValue: "1k",
  },
  {
    key: "gpt_image",
    jobSetType: "gpt_image_2",
    displayName: "GPT Image 2",
    blurb: "Premium hero quality. Best for editorial thumbnails with text overlay.",
    bestFor: "Thumbnails where the image is the hero",
    estimatedCredits: 7,
    paramFamily: "quality",
    defaultParamValue: "high",
  },
  {
    key: "nano_banana_flash",
    jobSetType: "nano_banana_flash",
    displayName: "Nano Banana 2 (Flash)",
    blurb: "Faster, slightly cheaper Nano Banana variant.",
    bestFor: "Quick iteration when you don't need 4k",
    estimatedCredits: 1.5,
    paramFamily: "resolution",
    defaultParamValue: "1k",
  },
  {
    key: "flux",
    jobSetType: "flux_2",
    displayName: "FLUX.2",
    blurb: "Stylized, illustrative, can feel more designed than photographic.",
    bestFor: "Stylized B-Roll, brand-flavored shots",
    estimatedCredits: 1,
    paramFamily: "resolution",
    defaultParamValue: "1k",
  },
  {
    key: "seedream",
    jobSetType: "seedream_v4_5",
    displayName: "Seedream 4.5",
    blurb: "Mid-tier photorealism. Good middle ground on credits.",
    bestFor: "Bulk B-Roll batches where credits matter",
    estimatedCredits: 1,
    paramFamily: "quality",
    defaultParamValue: "basic",
  },
  {
    key: "soul",
    jobSetType: "text2image_soul_v2",
    displayName: "Higgsfield Soul V2",
    blurb: "Cheap. Best when paired with a trained Soul character (Jordan / Dr. Ashley).",
    bestFor: "Repeating characters across many shots",
    estimatedCredits: 0.12,
    paramFamily: "quality",
    defaultParamValue: "2k",
  },
  {
    key: "soul_cinematic",
    jobSetType: "soul_cinematic",
    displayName: "Soul Cinematic",
    blurb: "Soul tuned for cinematic stills.",
    bestFor: "Movie-poster style hero shots",
    estimatedCredits: 0.12,
    paramFamily: "quality",
    defaultParamValue: "2k",
  },
];

/** Smart default model selection per use case. */
export function defaultModelForUseCase(useCase: "broll" | "thumbnail" | "carousel" | "hero" | "video" | "video-fast"): HiggsfieldModelKey {
  switch (useCase) {
    case "broll": return "nano_banana_2";
    case "thumbnail": return "nano_banana_2";
    case "carousel": return "flux";
    case "hero": return "gpt_image";
    case "video": return "seedance";              // best multimodal video
    case "video-fast": return "kling";            // cheaper, faster
    default: return "nano_banana_2";
  }
}

/** Public catalog metadata for VIDEO models (Seedance / Kling / Veo). Verified 2026-05-11. */
export type VideoModelInfo = {
  key: HiggsfieldModelKey;
  jobSetType: string;
  displayName: string;
  blurb: string;
  bestFor: string;
  /** Approx credits at the default resolution for the SHORTEST duration. */
  estimatedCredits: number;
  /** Param name used for image references — varies by model. */
  mediaParam: "medias" | "input_image";
  /** Available durations in seconds. */
  durations: number[];
  /** Whether `duration` is sent as integer or string. */
  durationType: "int" | "string";
  /** Available aspect ratios. */
  aspectRatios: string[];
  /** Available resolutions or quality enum. */
  resolutions?: string[];
};

export const VIDEO_MODEL_CATALOG: VideoModelInfo[] = [
  {
    key: "seedance",
    jobSetType: "seedance_2_0",
    displayName: "Seedance 2.0",
    blurb: "Best photo-real multimodal video. Native audio, multi-shot reference support.",
    bestFor: "B-Roll animation, product motion, lifestyle clips",
    estimatedCredits: 22.5,
    mediaParam: "medias",
    durations: [5, 10, 15],
    durationType: "int",
    aspectRatios: ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9", "auto"],
    resolutions: ["480p", "720p", "1080p"],
  },
  {
    key: "kling",
    jobSetType: "kling3_0",
    displayName: "Kling v3.0",
    blurb: "Cheaper alternative with sound. Strong motion fidelity.",
    bestFor: "Budget-conscious animation when Seedance feels excessive",
    estimatedCredits: 10,
    mediaParam: "medias",
    durations: [5, 10],
    durationType: "int",
    aspectRatios: ["9:16", "16:9", "1:1"],
  },
  {
    key: "veo",
    jobSetType: "veo3_1",
    displayName: "Google Veo 3.1",
    blurb: "Polished cinematic output. Different param surface (4/6/8s durations).",
    bestFor: "Polished hero clips when you want Google's quality",
    estimatedCredits: 11,
    mediaParam: "input_image",
    durations: [4, 6, 8],
    durationType: "string",
    aspectRatios: ["9:16", "16:9"],
  },
];

/** Estimate total credits for a batch via the CLI. Returns null if estimation fails. */
export async function estimateBatchCost(
  modelKey: HiggsfieldModelKey,
  count: number,
  extraParams: Record<string, string | number | undefined> = {},
): Promise<{ perImage: number | null; total: number | null }> {
  try {
    const jobSetType = resolveModelKey(modelKey);
    const args: string[] = ["generate", "cost", jobSetType, "--prompt", "test"];
    for (const [k, v] of Object.entries(extraParams)) {
      if (v == null) continue;
      args.push(`--${k}`, String(v));
    }
    args.push("--json", "--no-color");
    const { stdout } = await runCli(args, { timeoutMs: 10_000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.search(/[[{]/);
    if (jsonStart < 0) return { perImage: null, total: null };
    const parsed = JSON.parse(trimmed.slice(jsonStart)) as { credits?: number; credits_exact?: number };
    const perImage = (parsed.credits_exact ?? parsed.credits ?? null) as number | null;
    return { perImage, total: perImage != null ? perImage * count : null };
  } catch {
    return { perImage: null, total: null };
  }
}

type CliJobResult = {
  id: string;
  status: "completed" | "failed" | "nsfw" | string;
  result_url?: string;
  display_name?: string;
  job_set_type?: string;
  error?: string;
  // params: opaque per-model dict
  params?: Record<string, unknown>;
};

// Cached install/auth state — re-evaluated on /status, but cheap to memoize between calls.
let cachedCliInstalled: boolean | null = null;
let cachedAuthAt: number = 0;
let cachedAuthOk: boolean = false;

const AUTH_CACHE_MS = 30_000;

/** Returns the env object used to spawn the CLI, with macOS/Homebrew/npm-global bins prepended to PATH. */
function spawnEnv(): NodeJS.ProcessEnv {
  const extras = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(process.env.HOME || "", ".npm-global/bin"),
  ];
  const currentPath = process.env.PATH || "";
  const newPath = [...extras, currentPath].filter(Boolean).join(":");
  return { ...process.env, PATH: newPath };
}

export async function runCli(args: string[], opts: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileP("higgsfield", args, {
      env: spawnEnv(),
      maxBuffer: 16 * 1024 * 1024, // 16 MB — generous for batch list responses
      timeout: opts.timeoutMs ?? 600_000, // default 10 min
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stdout?: Buffer | string; stderr?: Buffer | string };
    if (err.code === "ENOENT") {
      throw new Error(
        "Higgsfield CLI not found on PATH. Install with: brew install higgsfield-ai/tap/higgsfield  (or: npm install -g @higgsfield/cli)",
      );
    }
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    throw new Error(
      `higgsfield CLI failed: ${stderr.trim() || stdout.trim() || err.message}`.slice(0, 1200),
    );
  }
}

export async function isCliInstalled(): Promise<boolean> {
  if (cachedCliInstalled !== null) return cachedCliInstalled;
  try {
    await runCli(["--version"], { timeoutMs: 5_000 });
    cachedCliInstalled = true;
  } catch {
    cachedCliInstalled = false;
  }
  return cachedCliInstalled;
}

export async function isAuthenticated(): Promise<boolean> {
  const now = Date.now();
  if (now - cachedAuthAt < AUTH_CACHE_MS) return cachedAuthOk;
  try {
    await runCli(["auth", "token"], { timeoutMs: 5_000 });
    cachedAuthOk = true;
  } catch {
    cachedAuthOk = false;
  }
  cachedAuthAt = now;
  return cachedAuthOk;
}

export async function getAccountStatus(): Promise<{ email?: string; credits?: number; raw: string }> {
  try {
    const { stdout } = await runCli(["account", "status"], { timeoutMs: 8_000 });
    const raw = stdout.trim();
    // Format: "user@example.com — plan_name, 1152.52 credits"
    const m = raw.match(/^(\S+@\S+)\s*[—-]\s*([^,]+),\s*([\d.,]+)\s*credits?/i);
    if (m) {
      return { email: m[1], credits: parseFloat(m[3].replace(/,/g, "")), raw };
    }
    return { raw };
  } catch (e) {
    return { raw: e instanceof Error ? e.message : String(e) };
  }
}

export async function isConfigured(): Promise<boolean> {
  return (await isCliInstalled()) && (await isAuthenticated());
}

// ── Soul Character helpers ─────────────────────────────────────────────────

export type SoulCharacter = {
  id: string;
  name: string;
  type: string;         // "soul" | "soul-cinematic"
  status: string;       // "completed" | "training" | ...
  created_at?: string;
};

/** List every Soul ID trained on this Higgsfield account. */
export async function listSoulCharacters(): Promise<SoulCharacter[]> {
  try {
    const { stdout } = await runCli(["soul-id", "list", "--json", "--no-color"], { timeoutMs: 10_000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.search(/[[{]/);
    if (jsonStart < 0) return [];
    const parsed = JSON.parse(trimmed.slice(jsonStart));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[higgsfield] listSoulCharacters failed:", e);
    return [];
  }
}

/** Train a new Soul character from 5+ uploaded image IDs. Returns the new soul_id. */
export async function createSoulCharacter(params: {
  name: string;
  imageUploadIds: string[];
  model?: "soul-2" | "soul-cinematic";
}): Promise<{ id: string; status: string }> {
  if (params.imageUploadIds.length < 5) {
    throw new Error("Soul training needs 5-20 reference images");
  }
  const args: string[] = ["soul-id", "create", "--name", params.name];
  args.push(params.model === "soul-cinematic" ? "--soul-cinematic" : "--soul-2");
  for (const id of params.imageUploadIds) args.push("--image", id);
  args.push("--json", "--no-color");
  const { stdout } = await runCli(args, { timeoutMs: 60_000 });
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{]/);
  if (jsonStart < 0) throw new Error(`soul-id create returned non-JSON: ${trimmed.slice(0, 200)}`);
  const parsed = JSON.parse(trimmed.slice(jsonStart));
  const obj = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!obj?.id) throw new Error(`soul-id create returned no id: ${trimmed.slice(0, 200)}`);
  return { id: obj.id, status: obj.status || "training" };
}

/** Convert a "human-friendly" model key to the CLI's job_set_type, or pass through. */
function resolveModelKey(modelKey: HiggsfieldModelKey | string): string {
  return (HIGGSFIELD_MODELS as Record<string, string>)[modelKey as string] || (modelKey as string);
}

/**
 * Parse the CLI's stdout from `generate create ... --wait --json`.
 * The CLI returns a JSON array of jobs; we return the first one.
 * If the JSON parse fails or the array is empty, throws.
 */
function parseGenerateOutput(stdout: string): CliJobResult {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("Higgsfield CLI returned empty output");
  // Find the first '[' or '{' — CLI may emit progress lines before the JSON in non-color mode.
  const jsonStart = trimmed.search(/[[{]/);
  if (jsonStart < 0) throw new Error(`Higgsfield CLI returned non-JSON: ${trimmed.slice(0, 300)}`);
  const candidate = trimmed.slice(jsonStart);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    throw new Error(
      `Higgsfield CLI returned invalid JSON: ${(e instanceof Error ? e.message : String(e))} — output head: ${candidate.slice(0, 300)}`,
    );
  }
  const jobs = (Array.isArray(parsed) ? parsed : [parsed]) as CliJobResult[];
  if (jobs.length === 0) throw new Error("Higgsfield CLI returned no jobs");
  const first = jobs[0];
  if (first.status !== "completed") {
    if (first.status === "nsfw") {
      throw new Error("Higgsfield flagged the request as sensitive content. Approve manually at higgsfield.ai.");
    }
    throw new Error(`Higgsfield job ${first.status}: ${first.error || "no detail"}`);
  }
  if (!first.result_url) {
    throw new Error("Higgsfield job completed but returned no result_url");
  }
  return first;
}

/** Build CLI args for `generate create`, encoding each param flag with `--name value`. */
function buildGenerateArgs(modelJobSetType: string, params: Record<string, string | number | boolean | undefined>, opts: { waitTimeoutMs?: number } = {}): string[] {
  const args: string[] = ["generate", "create", modelJobSetType];
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    args.push(`--${k}`, String(v));
  }
  args.push("--wait");
  args.push("--json");
  args.push("--no-color");
  if (opts.waitTimeoutMs) {
    // CLI accepts e.g. "10m", "30s"
    const secs = Math.round(opts.waitTimeoutMs / 1000);
    args.push("--wait-timeout", `${secs}s`);
  }
  return args;
}

/**
 * Generate an image. Returns `{ imageUrl, requestId }` — same shape as the previous REST client
 * so the route layer doesn't need to change.
 */
export async function generateImage(params: {
  prompt: string;
  modelKey?: HiggsfieldModelKey;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:5" | "5:4" | "3:4" | "4:3" | "2:3" | "3:2" | "21:9";
  resolution?: "1k" | "2k" | "4k";
  quality?: "1.5k" | "2k" | "low" | "medium" | "high" | "basic";
  referenceImageUrls?: string[]; // not yet wired
  /** Soul V2 / Soul Cinematic only — inject a trained character soul_id for consistency. */
  customReferenceId?: string;
}): Promise<{ imageUrl: string; requestId: string }> {
  const modelKey = params.modelKey || "nano_banana_2";
  const jobSetType = resolveModelKey(modelKey);

  const isSoul = jobSetType === "text2image_soul_v2" || jobSetType === "soul_cinematic";
  const cliParams: Record<string, string | number | boolean | undefined> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || "9:16",
  };
  if (isSoul) {
    cliParams.quality = (params.quality as "1.5k" | "2k") || "2k";
    if (params.customReferenceId) cliParams.custom_reference_id = params.customReferenceId;
  } else {
    cliParams.resolution = params.resolution || "1k";
  }

  const args = buildGenerateArgs(jobSetType, cliParams, { waitTimeoutMs: 8 * 60_000 });
  const { stdout } = await runCli(args, { timeoutMs: 10 * 60_000 });
  const job = parseGenerateOutput(stdout);
  return { imageUrl: job.result_url!, requestId: job.id };
}

/**
 * Generate a video from an image URL or upload ID. Returns `{ videoUrl, requestId }`.
 * NOTE: Higgsfield video models typically expect an `--image` upload-id or local file path,
 * not a remote URL. Callers should `upload` first if they have a URL.
 */
export async function generateVideoFromImage(params: {
  imageUploadIdOrPath: string;
  prompt: string;
  modelKey?: "seedance" | "kling" | "veo";
  duration?: number;
  aspectRatio?: string;
}): Promise<{ videoUrl: string; requestId: string }> {
  let uploadId = params.imageUploadIdOrPath;
  if (uploadId.startsWith("/") || uploadId.startsWith("./")) {
    uploadId = await uploadMediaFromPath(uploadId);
  } else if (/^https?:\/\//i.test(uploadId)) {
    uploadId = await uploadMediaFromUrl(uploadId);
  }
  return generateVideo({
    prompt: params.prompt,
    modelKey: params.modelKey || "seedance",
    imageUploadIds: [uploadId],
    aspectRatio: params.aspectRatio || "9:16",
    duration: params.duration ?? 5,
  });
}

// ── Upload helpers ─────────────────────────────────────────────────────────

/**
 * Upload a local file to Higgsfield and return the upload_id.
 * CLI: `higgsfield upload create <path> --json`.
 */
export async function uploadMediaFromPath(localPath: string): Promise<string> {
  if (!fs.existsSync(localPath)) throw new Error(`Upload file not found: ${localPath}`);
  const { stdout } = await runCli(["upload", "create", localPath, "--json", "--no-color"], { timeoutMs: 60_000 });
  const trimmed = stdout.trim();
  const jsonStart = trimmed.search(/[[{]/);
  if (jsonStart < 0) throw new Error(`upload returned non-JSON: ${trimmed.slice(0, 200)}`);
  const parsed = JSON.parse(trimmed.slice(jsonStart)) as { id?: string; upload_id?: string } | Array<{ id?: string }>;
  const obj = Array.isArray(parsed) ? parsed[0] : parsed;
  const id = obj?.id || (obj as { upload_id?: string })?.upload_id;
  if (!id) throw new Error(`upload returned no id: ${trimmed.slice(0, 200)}`);
  return id;
}

/** Download a remote image URL, upload via CLI, return upload_id. */
export async function uploadMediaFromUrl(url: string): Promise<string> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "hf-upload-"));
  const ext = (url.match(/\.(png|jpg|jpeg|webp|mp4|mov)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
  const tmpPath = path.join(tmpDir, `${crypto.randomBytes(6).toString("hex")}.${ext}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Fetch ${url} → ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(tmpPath, buffer);
    const id = await uploadMediaFromPath(tmpPath);
    return id;
  } finally {
    fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Generate a video using Seedance / Kling / Veo. Each has a different media param name:
 * Seedance + Kling use `--medias <id>` (repeatable), Veo uses `--input_image <id>` (single).
 */
export async function generateVideo(params: {
  prompt: string;
  modelKey?: "seedance" | "kling" | "veo";
  imageUploadIds?: string[];
  /**
   * NEW for frame-pair animation: smooth A→B transition target.
   * When set, the CLI passes both via --start-image / --end-image so Kling/Veo/Seedance
   * interpolate motion between the two stills. Storytelling reels use this for shot-to-shot transitions.
   */
  endImageUploadId?: string;
  videoUploadIds?: string[];
  aspectRatio?: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  genre?: "auto" | "action" | "horror" | "comedy" | "noir" | "drama" | "epic";
  mode?: "std" | "fast" | "pro";
  sound?: "on" | "off";
  customReferenceId?: string;
}): Promise<{ videoUrl: string; requestId: string }> {
  const modelKey = params.modelKey || "seedance";
  const info = VIDEO_MODEL_CATALOG.find((m) => m.key === modelKey);
  if (!info) throw new Error(`Unknown video model: ${modelKey}`);

  const args: string[] = ["generate", "create", info.jobSetType, "--prompt", params.prompt];

  if (params.aspectRatio) args.push("--aspect_ratio", params.aspectRatio);
  if (params.duration != null) args.push("--duration", String(params.duration));
  if (params.resolution && info.resolutions?.includes(params.resolution)) {
    args.push("--resolution", params.resolution);
  }
  if (params.genre && info.jobSetType === "seedance_2_0") args.push("--genre", params.genre);
  if (params.mode) args.push("--mode", params.mode);
  if (params.sound && info.jobSetType === "kling3_0") args.push("--sound", params.sound);

  // Media inputs.
  // Frame-pair (start + end): use --start-image / --end-image which the CLI documents as
  // first-class media flags. Falls back to single --image when only a start image is provided.
  const startImage = params.imageUploadIds?.[0] || params.customReferenceId;
  if (params.endImageUploadId && startImage) {
    args.push("--start-image", startImage);
    args.push("--end-image", params.endImageUploadId);
  } else if (startImage) {
    args.push("--image", startImage);
  }

  args.push("--wait", "--json", "--no-color");
  const { stdout } = await runCli(args, { timeoutMs: 18 * 60_000 });
  const job = parseGenerateOutput(stdout);
  const videoUrl = job.result_url;
  if (!videoUrl) throw new Error("Higgsfield returned no video URL");
  return { videoUrl, requestId: job.id };
}

/** Reset cached install/auth state — useful for `/status` to force a re-check. */
export function clearAuthCache(): void {
  cachedAuthAt = 0;
  cachedCliInstalled = null;
}
