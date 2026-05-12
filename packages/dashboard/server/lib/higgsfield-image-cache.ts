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
