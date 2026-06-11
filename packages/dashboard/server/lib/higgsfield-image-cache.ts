/**
 * Higgsfield image-gen wrapper that downloads the remote result to a local file.
 *
 * Carousel cinematic slides need the AI image as a local file (or file://) so the
 * Playwright renderer can load it as a CSS background-image without depending on
 * Higgsfield CDN URLs being reachable later. We call generateImage, fetch the
 * result, and persist next to the rest of the project's outputs.
 */
import fs from "fs";
import path from "path";
import { generateImage, type HiggsfieldModelKey } from "./higgsfield-client.js";

export type GenerateAndCacheResult = {
  localPath: string;
  remoteUrl: string;
  requestId: string;
  costCredits: number;
};

const NANO_BANANA_CREDIT_COST = 5;

export async function generateAndCacheImage(input: {
  prompt: string;
  aspect: "1:1" | "4:5" | "9:16";
  outDir: string;
  filename: string;
  modelKey?: HiggsfieldModelKey;
  resolution?: "1k" | "2k" | "4k";
}): Promise<GenerateAndCacheResult> {
  const { prompt, aspect, outDir, filename } = input;
  const modelKey = input.modelKey ?? "nano_banana_2";
  const resolution = input.resolution ?? "1k";

  fs.mkdirSync(outDir, { recursive: true });

  const { imageUrl, requestId } = await generateImage({
    prompt,
    modelKey,
    aspectRatio: aspect,
    resolution,
  });

  const localPath = path.join(outDir, filename);
  await downloadToFile(imageUrl, localPath);

  return {
    localPath,
    remoteUrl: imageUrl,
    requestId,
    costCredits: modelKey === "nano_banana_2" ? NANO_BANANA_CREDIT_COST : NANO_BANANA_CREDIT_COST,
  };
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Higgsfield image fetch failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

export type FallbackOutcome =
  | { ok: true; result: GenerateAndCacheResult; modelUsed: HiggsfieldModelKey; usedFallback: boolean }
  | { ok: false; error: string; lastModelTried: HiggsfieldModelKey };

/**
 * Resilient image-gen wrapper. Tries the primary model with one retry on transient errors
 * (HTTP 5xx, timeouts), then falls back to a cheaper model. Returns `{ ok: false }` if both
 * give up — the caller is expected to render the slide as text rather than aborting the
 * whole carousel.
 */
export async function generateAndCacheImageWithFallback(input: {
  prompt: string;
  aspect: "1:1" | "4:5" | "9:16";
  outDir: string;
  filename: string;
  primaryModel: HiggsfieldModelKey;
  fallbackModel?: HiggsfieldModelKey;
  /** called between attempts with a short status string for the generation log */
  onAttempt?: (msg: string) => void;
}): Promise<FallbackOutcome> {
  const tryOnce = async (modelKey: HiggsfieldModelKey, attemptLabel: string): Promise<GenerateAndCacheResult> => {
    input.onAttempt?.(attemptLabel);
    return generateAndCacheImage({
      prompt: input.prompt,
      aspect: input.aspect,
      outDir: input.outDir,
      filename: input.filename,
      modelKey,
      resolution: modelKey === "gpt_image" ? "2k" : "1k",
    });
  };

  const isTransient = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return /\b50\d\b|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed|temporarily/i.test(msg);
  };

  // Try primary, once
  try {
    const result = await tryOnce(input.primaryModel, `image · ${input.primaryModel}`);
    return { ok: true, result, modelUsed: input.primaryModel, usedFallback: false };
  } catch (err) {
    if (!isTransient(err)) {
      // Non-transient: still try fallback once before giving up.
      if (input.fallbackModel) {
        try {
          const result = await tryOnce(input.fallbackModel, `image · ${input.fallbackModel} (fallback from ${input.primaryModel}: ${err instanceof Error ? err.message.slice(0, 60) : "error"})`);
          return { ok: true, result, modelUsed: input.fallbackModel, usedFallback: true };
        } catch (fallbackErr) {
          return { ok: false, error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr), lastModelTried: input.fallbackModel };
        }
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err), lastModelTried: input.primaryModel };
    }

    // Transient: backoff + retry primary once before falling back.
    await sleep(3000);
    try {
      const result = await tryOnce(input.primaryModel, `image · ${input.primaryModel} retrying after transient error`);
      return { ok: true, result, modelUsed: input.primaryModel, usedFallback: false };
    } catch (retryErr) {
      if (!input.fallbackModel) {
        return { ok: false, error: retryErr instanceof Error ? retryErr.message : String(retryErr), lastModelTried: input.primaryModel };
      }
      try {
        const result = await tryOnce(input.fallbackModel, `image · ${input.fallbackModel} (fallback after ${input.primaryModel} retry failed)`);
        return { ok: true, result, modelUsed: input.fallbackModel, usedFallback: true };
      } catch (fallbackErr) {
        return { ok: false, error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr), lastModelTried: input.fallbackModel };
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
