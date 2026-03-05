import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { parseContentLibrary } from "../parsers/content-library.js";
import { invalidateProductionPlanCache } from "../parsers/production-plans.js";

const FORMAT_FILE_MAP: Record<string, string> = {
  A: "explainer.md",
  B: "checklist.md",
  C: "demo.md",
  D: "myth-buster.md",
  E: "walkthrough.md",
  F: "quick-tip.md",
  G: "patient-story.md",
};

function buildSystemPrompt(
  brand: string,
  hookPatterns: string,
  cinemaDefaults: string,
  formatTemplate: string,
): string {
  return `You are a video production director for short-form social video content. Generate complete production plans.

BRAND VOICE:
${brand.slice(0, 1500)}

HOOK PATTERNS LIBRARY:
${hookPatterns.slice(0, 2000)}

CINEMA STUDIO DEFAULTS:
${cinemaDefaults.slice(0, 800)}

FORMAT TEMPLATE:
${formatTemplate.slice(0, 1500)}

OUTPUT RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Output in markdown with these exact sections:

## Hook Variations

For each variation, use bullet points:
- "Hook text here" (Pattern: [pattern type])

Generate 3 hook alternatives: Primary (best match for format + platform), Variation A (question-based), Variation B (statistic or contrarian).

## Platform Optimization

Use this exact format for each platform:
- **Instagram Reels:** notes about optimization
- **TikTok:** notes about optimization
- **YouTube Shorts:** notes about optimization

## Shot List

Use numbered list. Each shot should include:
1. [Duration] - [Shot type, camera angle] of [subject description], [environment], [lighting]. Camera: [body, lens, focal length]. Movement: [camera movement]. Audio: "[script line alignment]"

HERO FRAME PROMPT STRUCTURE (for each shot):
[SHOT TYPE + CAMERA ANGLE] of [SUBJECT: age, appearance, clothing, expression, action],
[ENVIRONMENT: location, set dressing, props],
[LIGHTING: type, direction, color temperature, quality],
[CAMERA: body, lens, focal length],
[COMPOSITION: framing, depth of field],
[MOOD: tone words, genre, energy]

CAMERA DEFAULTS:
- Medical/educational: ARRI Alexa, Cooke lens, 35mm, Intimate genre
- Exercise/movement: Sony Venice, Canon K35, 24mm, Intimate genre
- Anatomical/visual: RED V-RAPTOR, Zeiss Ultra Prime, 50mm

9:16 SAFE ZONES: Leave 250px top, 420px bottom for platform UI. Center subjects in middle 60%.

Keep the plan actionable and specific. Every shot prompt should be detailed enough to paste directly into Cinema Studio.`;
}

export function createVideoDirectorAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const brandPath = path.join(industryDir, "brand.md");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const cinemaDefaultsPath = path.join(industryDir, "cinema-defaults.md");
  const formatsDir = path.resolve(industryDir, "../../formats");
  const productionPlansDir = path.join(industryDir, "production-plans");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[video-director-ai] ANTHROPIC_API_KEY not set.");
  }

  // POST /:code/generate-plan
  router.post("/:code/generate-plan", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    const { code } = req.params;

    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code.toUpperCase() === code.toUpperCase());
      if (!video) {
        res.status(404).json({ error: `Video ${code} not found` });
        return;
      }

      const brand = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8") : "";
      const hookPatterns = fs.existsSync(hookPatternsPath) ? fs.readFileSync(hookPatternsPath, "utf-8") : "";
      const cinemaDefaults = fs.existsSync(cinemaDefaultsPath) ? fs.readFileSync(cinemaDefaultsPath, "utf-8") : "";

      const formatFile = FORMAT_FILE_MAP[video.format] || "explainer.md";
      const formatPath = path.join(formatsDir, formatFile);
      const formatTemplate = fs.existsSync(formatPath) ? fs.readFileSync(formatPath, "utf-8") : "";

      const systemPrompt = buildSystemPrompt(brand, hookPatterns, cinemaDefaults, formatTemplate);

      const shotsContext = video.shots
        .map((s) => `Shot ${s.number} (${s.duration}s, ${s.cameraMovement}): ${s.prompt}`)
        .join("\n");

      const userContent = `Generate a complete production plan for video ${video.code}: "${video.title}"

Format: ${video.format} (${video.formatName})
Duration: ${video.duration}s
Audience: ${video.audienceLabel}
Tags: ${video.tags.join(", ")}

Existing Script:
${video.script}

Existing Cinema Studio Shots:
${shotsContext}

Generate hook variations (3 alternatives), platform optimization notes, and a detailed shot list with Cinema Studio prompts.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const markdown = textBlock.text;
      const today = new Date().toISOString().split("T")[0];
      const slug = video.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const fullMarkdown = `# Production Plan: ${video.code} - ${video.title}\n\nDate: ${today}\n\n${markdown}`;

      fs.mkdirSync(productionPlansDir, { recursive: true });
      const planPath = path.join(productionPlansDir, `${video.code}-${slug}.md`);
      fs.writeFileSync(planPath, fullMarkdown);
      invalidateProductionPlanCache();

      // Re-parse to get structured data
      const { parseProductionPlans } = await import("../parsers/production-plans.js");
      const plans = parseProductionPlans(productionPlansDir);
      const plan = plans.get(video.code);

      res.json({
        success: true,
        plan: plan || {
          videoCode: video.code,
          title: video.title,
          generatedAt: today,
          hookVariations: [],
          platformOptimization: {},
          shotList: [],
          rawMarkdown: fullMarkdown,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Plan generation failed";
      console.error("[video-director-ai] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
