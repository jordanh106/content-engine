/**
 * Heuristic virality predictor.
 *
 * Scores a draft asset (hook text, image prompt, narrative line, caption) against the
 * Master Blueprint rubric. Returns a 0-100 score with axis breakdown.
 *
 * Inspired by Aidan's video — Higgsfield's MCP exposes a `virality_predictor` tool.
 * Our heuristic uses Claude Haiku + the existing Master Blueprint at
 * industries/chiropractic/master-blueprint.md as the scoring rubric.
 */
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { parseMasterBlueprint } from "../parsers/master-blueprint.js";
import type { ViralityPrediction, ViralityBreakdown } from "../../shared/types.js";

const MODEL = "claude-haiku-4-5-20251001";

export type ViralityAsset = {
  kind: "hook" | "narrative_line" | "caption" | "image_prompt" | "carousel_cover";
  text?: string;
  imagePrompt?: string;
  motionPrompt?: string;
  format?: string;
  context?: string;
};

const cache = new Map<string, { fetchedAt: number; prediction: ViralityPrediction }>();
const CACHE_TTL_MS = 5 * 60_000;

function hashAsset(asset: ViralityAsset, blueprintVersion: string): string {
  const payload = JSON.stringify({ asset, blueprintVersion });
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

/**
 * Score an asset against the Master Blueprint. Returns 0-100 + breakdown.
 *
 * If Anthropic SDK is unavailable, falls back to a simple length/pattern-based score
 * so callers can still render a number (with `notes: ["fallback"]`).
 */
export async function predictVirality(
  asset: ViralityAsset,
  opts: { blueprintPath: string }
): Promise<ViralityPrediction> {
  const blueprint = parseMasterBlueprint(opts.blueprintPath);
  const blueprintVersion = blueprint?.version || "no-blueprint";
  const cacheKey = hashAsset(asset, blueprintVersion);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.prediction;

  let client: Anthropic | null = null;
  try { client = new Anthropic(); } catch { /* fall back */ }

  if (!client || !blueprint) {
    const fallback = fallbackScore(asset);
    cache.set(cacheKey, { fetchedAt: Date.now(), prediction: fallback });
    return fallback;
  }

  const text = asset.text || asset.imagePrompt || asset.motionPrompt || "";
  if (!text.trim()) {
    const empty: ViralityPrediction = {
      score: 0,
      breakdown: { hookStrength: 0, saveTrigger: 0, retentionShape: 0, brandFit: 0, antiPatternRisk: 0 },
      notes: ["empty asset"],
    };
    return empty;
  }

  const blueprintExcerpt = blueprint.raw.slice(0, 5500);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `You are the virality predictor for a chiropractic content engine. Score the asset below against the Master Blueprint. Return ONLY valid JSON (no markdown, no code fence).

MASTER BLUEPRINT EXCERPT:
${blueprintExcerpt}

ASSET TO SCORE:
- Kind: ${asset.kind}
- Text: ${text.slice(0, 800)}
${asset.format ? `- Format: ${asset.format}` : ""}
${asset.context ? `- Context: ${asset.context.slice(0, 400)}` : ""}

Score across five axes (each 0 to its max). Total = sum of all five = 0-100.

AXES:
1. hookStrength (0-30): Does it stop the scroll? Specific number / counter-intuitive claim / open loop / urgent stakes? Generic openers ("Did you know...", "Hey guys") score very low.
2. saveTrigger (0-20): Practical value worth saving — a checklist, a step, a specific exercise, a before/after. Vague info ≤ 5. Concrete how-to or rule ≥ 15.
3. retentionShape (0-20): Will viewers finish? Pacing, tension, resolution. Hook + setup + payoff structure earns high; meandering or front-loaded earns low.
4. brandFit (0-15): Matches Collective Family Chiropractic voice — warm, educational, empowering. Not clinical-sterile, not aggressive-sales.
5. antiPatternRisk (0-15, INVERTED): Penalises emdashes, "Did you know", "Hey guys", mug-for-camera energy, generic stock-photo prompts, banned anti-patterns from the blueprint. 15 = NO anti-patterns. 0 = severe anti-patterns present.

OUTPUT JSON:
{
  "breakdown": {
    "hookStrength": <int 0-30>,
    "saveTrigger": <int 0-20>,
    "retentionShape": <int 0-20>,
    "brandFit": <int 0-15>,
    "antiPatternRisk": <int 0-15>
  },
  "notes": ["<2-4 short strings explaining the score, max 60 chars each>"]
}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return fallbackScore(asset);
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackScore(asset);
    const parsed = JSON.parse(jsonMatch[0]) as { breakdown: ViralityBreakdown; notes: string[] };
    const b = parsed.breakdown;
    const score = clamp(b.hookStrength, 0, 30) + clamp(b.saveTrigger, 0, 20) + clamp(b.retentionShape, 0, 20) + clamp(b.brandFit, 0, 15) + clamp(b.antiPatternRisk, 0, 15);
    const prediction: ViralityPrediction = {
      score,
      breakdown: {
        hookStrength: clamp(b.hookStrength, 0, 30),
        saveTrigger: clamp(b.saveTrigger, 0, 20),
        retentionShape: clamp(b.retentionShape, 0, 20),
        brandFit: clamp(b.brandFit, 0, 15),
        antiPatternRisk: clamp(b.antiPatternRisk, 0, 15),
      },
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 4) : [],
    };
    cache.set(cacheKey, { fetchedAt: Date.now(), prediction });
    return prediction;
  } catch (err) {
    console.error("[virality-predictor] error", err);
    return fallbackScore(asset);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n) || typeof n !== "number") return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function fallbackScore(asset: ViralityAsset): ViralityPrediction {
  const text = (asset.text || asset.imagePrompt || asset.motionPrompt || "").toLowerCase();
  const breakdown: ViralityBreakdown = {
    hookStrength: 15,
    saveTrigger: 10,
    retentionShape: 10,
    brandFit: 8,
    antiPatternRisk: 10,
  };
  // Crude anti-pattern detection
  if (text.includes("—")) breakdown.antiPatternRisk -= 5;
  if (text.includes("did you know")) breakdown.antiPatternRisk -= 5;
  if (text.includes("hey guys")) breakdown.antiPatternRisk -= 5;
  if (/\d/.test(text)) breakdown.hookStrength += 5; // has a number
  if (text.length > 0 && text.length < 12) breakdown.hookStrength -= 3; // too short
  if (text.length > 200) breakdown.retentionShape -= 3; // probably too long for a hook

  breakdown.hookStrength = clamp(breakdown.hookStrength, 0, 30);
  breakdown.antiPatternRisk = clamp(breakdown.antiPatternRisk, 0, 15);

  const score = breakdown.hookStrength + breakdown.saveTrigger + breakdown.retentionShape + breakdown.brandFit + breakdown.antiPatternRisk;
  return { score, breakdown, notes: ["heuristic fallback (Anthropic unavailable)"] };
}
