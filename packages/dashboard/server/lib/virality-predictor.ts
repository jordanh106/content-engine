/**
 * Heuristic virality predictor.
 *
 * Scores a draft asset against either:
 *   - "brand" mode: Collective Family Chiropractic voice + Master Blueprint rubric
 *   - "showcase" mode: editorial / alignment to the project's own brief (not chiropractic)
 *
 * Inspired by Higgsfield MCP's `virality_predictor` tool from Aidan's video. Ours runs
 * Claude Haiku against the appropriate rubric and returns a 0-100 score + 5-axis breakdown.
 */
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { parseMasterBlueprint } from "../parsers/master-blueprint.js";
import type { ViralityPrediction, ViralityBreakdown, ProjectKind } from "../../shared/types.js";

const MODEL = "claude-haiku-4-5-20251001";

export type ViralityMode = "brand" | "showcase";

export type ViralityAsset = {
  kind: "hook" | "narrative_line" | "caption" | "image_prompt" | "carousel_cover";
  text?: string;
  imagePrompt?: string;
  motionPrompt?: string;
  format?: string;
  context?: string;
  /** "brand" = chiropractic voice rubric. "showcase" = brief-aligned editorial rubric. Default: "brand". */
  mode?: ViralityMode;
  /** When mode === "showcase", this is the brand reference instead of the chiropractic blueprint. */
  projectBrief?: string;
  /** Optional kind hint for the scorer (used to tune the rubric per asset type). */
  projectKind?: ProjectKind;
};

const cache = new Map<string, { fetchedAt: number; prediction: ViralityPrediction }>();
const CACHE_TTL_MS = 5 * 60_000;

function hashAsset(asset: ViralityAsset, ctxVersion: string): string {
  const payload = JSON.stringify({ asset, ctxVersion });
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

export async function predictVirality(
  asset: ViralityAsset,
  opts: { blueprintPath: string }
): Promise<ViralityPrediction> {
  const mode: ViralityMode = asset.mode ?? "brand";
  const blueprint = parseMasterBlueprint(opts.blueprintPath);
  const ctxVersion = mode === "brand" ? (blueprint?.version || "no-blueprint") : `showcase:${(asset.projectBrief ?? "").slice(0, 40)}`;
  const cacheKey = hashAsset(asset, ctxVersion);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.prediction;

  let client: Anthropic | null = null;
  try { client = new Anthropic(); } catch { /* fall back below */ }

  if (!client) {
    const fallback = fallbackScore(asset);
    cache.set(cacheKey, { fetchedAt: Date.now(), prediction: fallback });
    return fallback;
  }

  const text = asset.text || asset.imagePrompt || asset.motionPrompt || "";
  if (!text.trim()) {
    return {
      score: 0,
      breakdown: { hookStrength: 0, saveTrigger: 0, retentionShape: 0, brandFit: 0, antiPatternRisk: 0 },
      notes: ["empty asset"],
    };
  }

  // Build the rubric prompt based on mode
  const isImagePrompt = asset.kind === "image_prompt" || asset.kind === "carousel_cover";
  const rubricBlock = buildRubricPrompt(mode, asset, blueprint?.raw ?? "", isImagePrompt);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `${rubricBlock}

ASSET TO SCORE:
- Kind: ${asset.kind}
- Mode: ${mode}
- Text: ${text.slice(0, 800)}
${asset.format ? `- Format: ${asset.format}` : ""}
${asset.context ? `- Context: ${asset.context.slice(0, 400)}` : ""}
${asset.projectKind ? `- Project kind: ${asset.projectKind}` : ""}

Score across five axes (each 0 to its max). Total = sum of all five = 0-100.

OUTPUT JSON (no markdown, no code fence):
{
  "breakdown": {
    "hookStrength": <int 0-30>,
    "saveTrigger": <int 0-20>,
    "retentionShape": <int 0-20>,
    "brandFit": <int 0-15>,
    "antiPatternRisk": <int 0-15>
  },
  "notes": ["<2-4 short strings, max 60 chars each>"]
}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallbackScore(asset);
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackScore(asset);
    const parsed = JSON.parse(jsonMatch[0]) as { breakdown: ViralityBreakdown; notes: string[] };
    const b = parsed.breakdown;
    const breakdown: ViralityBreakdown = {
      hookStrength: clamp(b.hookStrength, 0, 30),
      saveTrigger: clamp(b.saveTrigger, 0, 20),
      retentionShape: clamp(b.retentionShape, 0, 20),
      brandFit: clamp(b.brandFit, 0, 15),
      antiPatternRisk: clamp(b.antiPatternRisk, 0, 15),
    };
    const score = breakdown.hookStrength + breakdown.saveTrigger + breakdown.retentionShape + breakdown.brandFit + breakdown.antiPatternRisk;
    const prediction: ViralityPrediction = {
      score,
      breakdown,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 4) : [],
    };
    cache.set(cacheKey, { fetchedAt: Date.now(), prediction });
    return prediction;
  } catch (err) {
    console.error("[virality-predictor] error", err);
    return fallbackScore(asset);
  }
}

function buildRubricPrompt(mode: ViralityMode, asset: ViralityAsset, blueprintRaw: string, isImagePrompt: boolean): string {
  if (mode === "brand") {
    // Chiropractic / Master Blueprint rubric
    const blueprintExcerpt = blueprintRaw.slice(0, 5500);
    return `You are the virality predictor for a chiropractic content engine. Score the asset against the Master Blueprint.

MASTER BLUEPRINT EXCERPT:
${blueprintExcerpt}

AXES:
1. hookStrength (0-30): Does it stop the scroll? Specific number / counter-intuitive claim / open loop / urgent stakes? Generic openers score very low.
2. saveTrigger (0-20): Practical value worth saving — a checklist, a step, a specific exercise, a before/after. Vague info ≤ 5. Concrete how-to or rule ≥ 15.
3. retentionShape (0-20): Will viewers finish? Pacing, tension, resolution. Hook + setup + payoff earns high; meandering earns low.
4. brandFit (0-15): Matches Collective Family Chiropractic voice — warm, educational, empowering. Not clinical-sterile, not aggressive-sales.
5. antiPatternRisk (0-15, INVERTED): Penalises emdashes, "Did you know", "Hey guys", mug-for-camera, generic stock-photo prompts, blueprint anti-patterns. 15 = NO anti-patterns. 0 = severe anti-patterns.${isImagePrompt ? "\n\n   NOTE: Asset is an IMAGE PROMPT, not a hook/caption. Text anti-patterns like emdash don't apply — score antiPatternRisk based on whether the image prompt feels editorial vs AI-cliché." : ""}`;
  }

  // showcase mode — use the project's own brief as the brand reference
  const brief = (asset.projectBrief ?? "").slice(0, 3500);
  return `You are an editorial creative director scoring an asset for a NON-chiropractic brand project. Use the PROJECT BRIEF below as the brand reference — do NOT score against any chiropractic rubric.

PROJECT BRIEF (this is the brand context — match against this, not a default voice):
${brief || "(no brief provided — score on general editorial merit)"}

AXES:
1. hookStrength (0-30): Does it stop the scroll for the brief's stated audience? Editorial specificity, surprise, intrigue, stakes. Generic-looking work scores low.
2. saveTrigger (0-20): Is there a reason someone would save / share / dwell on this asset? For images: editorial composition that demands a second look. For copy: a specific concrete claim.
3. retentionShape (0-20): For videos/copy — does pacing work? For images — does the eye linger and explore? Asset that "completes a thought" scores high.
4. brandFit (0-15): Match against the PROJECT BRIEF's stated mood, audience, hero subject. Score 15 = pixel-perfect match. Score 0 = wrong tone, wrong audience, conflicting mood.
5. antiPatternRisk (0-15, INVERTED): Penalises AI-aesthetic clichés — oversaturated, generic-stock-photo, glowing edges, vapor-wave, glassmorphism overused, mug-for-camera, fake-perfect. 15 = editorial, restrained, magazine-cover energy. 0 = looks like default AI output.${isImagePrompt ? "\n\n   This asset is an IMAGE PROMPT. Score antiPatternRisk based on whether the prompt produces editorial vs generic-AI imagery. Text anti-patterns (emdash, etc.) don't apply." : ""}`;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n) || typeof n !== "number") return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function fallbackScore(asset: ViralityAsset): ViralityPrediction {
  const text = (asset.text || asset.imagePrompt || asset.motionPrompt || "").toLowerCase();
  const mode = asset.mode ?? "brand";
  const isImagePrompt = asset.kind === "image_prompt" || asset.kind === "carousel_cover";

  const breakdown: ViralityBreakdown = {
    hookStrength: 18,
    saveTrigger: 12,
    retentionShape: 12,
    brandFit: mode === "showcase" ? 10 : 8,
    antiPatternRisk: 11,
  };

  // Image-prompt anti-pattern signals
  if (isImagePrompt) {
    if (text.includes("editorial") || text.includes("magazine") || text.includes("photo-real")) breakdown.antiPatternRisk += 2;
    if (text.includes("oversaturated") || text.includes("glowing")) breakdown.antiPatternRisk -= 4;
  } else {
    // Text anti-patterns
    if (text.includes("—")) breakdown.antiPatternRisk -= 5;
    if (text.includes("did you know")) breakdown.antiPatternRisk -= 5;
    if (text.includes("hey guys")) breakdown.antiPatternRisk -= 5;
  }

  // Hook signals
  if (/\d/.test(text)) breakdown.hookStrength += 4;
  if (text.length > 0 && text.length < 12) breakdown.hookStrength -= 4;
  if (text.length > 240 && !isImagePrompt) breakdown.retentionShape -= 3;

  breakdown.hookStrength = clamp(breakdown.hookStrength, 0, 30);
  breakdown.antiPatternRisk = clamp(breakdown.antiPatternRisk, 0, 15);
  breakdown.retentionShape = clamp(breakdown.retentionShape, 0, 20);

  const score = breakdown.hookStrength + breakdown.saveTrigger + breakdown.retentionShape + breakdown.brandFit + breakdown.antiPatternRisk;
  return { score, breakdown, notes: ["heuristic fallback (Anthropic unavailable)"] };
}
