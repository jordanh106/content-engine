import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { parseContentLibrary } from "../parsers/content-library.js";
import { invalidateProductionPlanCache } from "../parsers/production-plans.js";

// ─── Content Tier System (Kallaway Rehook Architecture) ─────────────────────
type ContentTier = "short" | "mid" | "long";

const TIER_CONFIG: Record<ContentTier, {
  durationRange: string;
  rehookCount: string;
  structure: string;
  wordRange: [number, number];
}> = {
  short: {
    durationRange: "6-60 seconds",
    rehookCount: "0-1 rehooks",
    structure: "HOOK → BODY 1 → [optional REHOOK → BODY 2] → OUTRO",
    wordRange: [15, 150],
  },
  mid: {
    durationRange: "1-3 minutes",
    rehookCount: "2-3 rehooks",
    structure: "HOOK → BODY 1 → REHOOK → BODY 2 → REHOOK → BODY 3 → OUTRO",
    wordRange: [150, 450],
  },
  long: {
    durationRange: "3-10 minutes",
    rehookCount: "4-5 rehooks",
    structure: "HOOK → BODY 1 → REHOOK → BODY 2 → REHOOK → BODY 3 → REHOOK → BODY 4 → REHOOK → BODY 5 → OUTRO",
    wordRange: [450, 1500],
  },
};

function inferTier(seconds: number, explicit?: ContentTier): ContentTier {
  if (explicit) return explicit;
  if (seconds <= 60) return "short";
  if (seconds <= 180) return "mid";
  return "long";
}

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

  // Helper: load brand context files
  const loadBrandContext = () => {
    const brand = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 1500) : "";
    const hookPatterns = fs.existsSync(hookPatternsPath) ? fs.readFileSync(hookPatternsPath, "utf-8").slice(0, 2000) : "";
    return { brand, hookPatterns };
  };

  // POST /hooks - Generate AI hook variations for a topic
  router.post("/hooks", async (req, res) => {
    if (!client) return res.status(503).json({ error: "AI unavailable" });
    const { topic, count = 6 } = req.body as { topic: string; count?: number };
    if (!topic) return res.status(400).json({ error: "Topic is required" });

    try {
      const { brand, hookPatterns } = loadBrandContext();
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are a viral content hook writer for a chiropractic practice. You write hooks that stop the scroll in the first 1.5 seconds.

BRAND VOICE:
${brand}

HOOK PATTERNS LIBRARY (proven formats):
${hookPatterns}

RULES:
- No emdashes. Use commas, periods, or restructure.
- Each hook must be a single sentence, spoken directly to camera.
- Vary the hook types: pattern interrupt, contrarian, question, story, statistic, teacher.
- Be specific to the topic, not generic. Reference real symptoms, situations, or emotions.
- Write hooks that would work for TikTok and Instagram Reels.`,
        messages: [{
          role: "user",
          content: `Generate ${count} scroll-stopping hooks for this video topic: "${topic}"

For each hook, provide:
- text: The exact hook script (1-2 sentences)
- type: The hook pattern used (e.g., "Pattern Interrupt", "Contrarian", "Question", "Story Tease", "Statistic Shock", "Teacher")
- prediction: "high", "medium", or "low" based on likely save/share performance

Return ONLY valid JSON: {"hooks": [{"text": "...", "type": "...", "prediction": "high|medium|low"}, ...]}`,
        }],
      });

      const text = response.content.find((b) => b.type === "text")?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return res.json({ hooks: data.hooks || [] });
      }
      res.status(500).json({ error: "Failed to parse hooks" });
    } catch (err) {
      console.error("[video-director-ai] Hook generation error:", err);
      res.status(500).json({ error: "Hook generation failed" });
    }
  });

  // POST /script - Generate a full script from hook + topic + duration (Kallaway Architecture)
  router.post("/script", async (req, res) => {
    if (!client) return res.status(503).json({ error: "AI unavailable" });
    const { hook, topic, targetSeconds = 45, contentTier: explicitTier } = req.body as {
      hook: string;
      topic: string;
      targetSeconds?: number;
      contentTier?: ContentTier;
    };
    if (!hook || !topic) return res.status(400).json({ error: "Hook and topic required" });

    try {
      const { brand } = loadBrandContext();
      const tier = inferTier(targetSeconds, explicitTier);
      const tierConfig = TIER_CONFIG[tier];
      const wordCount = Math.round(targetSeconds * 2.5);

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: tier === "long" ? 4096 : 2048,
        system: `You are a premium video script writer for Collective Family Chiropractic. You write scripts using the Kallaway Content Frameworks for maximum retention and engagement.

BRAND VOICE:
${brand}

=== KALLAWAY SCRIPT ARCHITECTURE ===

PRINCIPLE 1 - STORY FLOW (Through-Line Discipline)
Every single line must advance the central through-line promised by the hook. No tangents, no filler, no "by the way" asides, no unnecessary backstory. Before writing each line, ask: "Does this advance the one idea I promised in the hook?" If not, cut it. Great scriptwriting is like hypnosis. Keep the viewer immersed.

PRINCIPLE 2 - COMPREHENSION (Atomic Messaging)
- 6th grade vocabulary. If a word has a simpler synonym, use the simpler one.
- Short sentences. Max 15 words. Aim for 8-12. Quick, punchy, staccato.
- Active voice only. "Your spine compresses" not "compression is experienced."
- When using a technical or medical term, immediately restate it simply. Example: "That's called subluxation. Basically, your vertebra shifted out of place."
- Name frameworks and concepts. "This is called the 90-90 stretch" not "do this stretch."

PRINCIPLE 3 - SPEED TO VALUE + REHOOK ARCHITECTURE
Content Tier: ${tier} (${tierConfig.durationRange})
Required structure: ${tierConfig.structure}
Rehook count: ${tierConfig.rehookCount}

What is a REHOOK? A rehook is a 1-2 sentence pattern interrupt placed between body sections. It re-earns the viewer's attention by teasing that the NEXT section's value is even better. Examples:
- "But here's where it gets interesting."
- "Now, most people stop here. Don't."
- "That alone would help. But there's a second piece most people miss."
- "OK so that's the basics. Here's the part nobody talks about."

The rehook creates a new curiosity loop so the viewer stays for the next section.

=== SECTION LABELS ===
Mark each section with a label on its own line:
[HOOK] - Opening hook, delivered to camera. Establish context + tease value in first 3 seconds.
[BODY 1] - First value block. Clear story flow, distilled details.
[REHOOK] - Attention re-earner. 1-2 sentences max. (Include only if tier requires it.)
[BODY 2] - Second value block.
...continue rehook/body pattern as needed for this tier...
[OUTRO] - Warm CTA and close. Summarize value or extend to next step.

=== SCRIPT RULES ===
- No emdashes. Use commas, periods, or restructure.
- Include delivery cues in brackets: [Warm, empathetic], [Direct, confident], [Playful], etc.
- Write conversationally, like talking to a friend, not lecturing.
- Be specific with medical/health information. Reference real conditions, exercises, or techniques.
- CTA should feel natural, never begging. "If this helped, follow for more."
- The script must feel complete and ready to record as-is.`,
        messages: [{
          role: "user",
          content: `Write a ${targetSeconds}-second video script (approximately ${wordCount} words) for this topic: "${topic}"

Content Tier: ${tier} (${tierConfig.durationRange})
Required structure: ${tierConfig.structure}

Use this hook to open: "${hook}"

Requirements:
1. Open with the hook exactly as written, with a delivery cue
2. Follow the rehook architecture for this tier (${tierConfig.rehookCount})
3. Mark each section with [HOOK], [BODY N], [REHOOK], or [OUTRO] labels on their own line
4. Include delivery cues [in brackets] for tone shifts
5. Apply atomic messaging: 6th grade vocab, short sentences, active voice
6. Every line must advance the through-line. Zero filler.
7. Be exactly the right length for ${targetSeconds} seconds at natural speaking pace

Return ONLY the script text. No JSON wrapper. No explanation. Just the script ready to record.`,
        }],
      });

      const scriptText = response.content.find((b) => b.type === "text")?.text || "";
      res.json({ script: scriptText.trim(), contentTier: tier });
    } catch (err) {
      console.error("[video-director-ai] Script generation error:", err);
      res.status(500).json({ error: "Script generation failed" });
    }
  });

  // POST /refine - Refine an existing script based on user instruction
  router.post("/refine", async (req, res) => {
    if (!client) return res.status(503).json({ error: "AI unavailable" });
    const { script, instruction, topic } = req.body as { script: string; instruction: string; topic: string };
    if (!script || !instruction) return res.status(400).json({ error: "Script and instruction required" });

    try {
      const { brand } = loadBrandContext();
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: `You are a script editor for Collective Family Chiropractic. You refine video scripts to be more engaging, clear, and effective.

BRAND VOICE:
${brand}

RULES:
- No emdashes. Use commas, periods, or restructure.
- Keep the same structure and delivery cues unless asked to change them.
- Return ONLY the complete revised script. No explanation, no commentary.
- If asked to shorten, actually remove content (don't just compress).
- If asked to make it more casual, rewrite sentences to sound conversational.
- If asked about hooks, rewrite the opening 1-2 sentences.
- Maintain the CTA unless specifically asked to remove it.`,
        messages: [{
          role: "user",
          content: `Here is the current script for a video about "${topic}":

---
${script}
---

Apply this change: "${instruction}"

Return ONLY the complete revised script. No explanation.`,
        }],
      });

      const refined = response.content.find((b) => b.type === "text")?.text || "";
      res.json({ script: refined.trim() });
    } catch (err) {
      console.error("[video-director-ai] Refine error:", err);
      res.status(500).json({ error: "Refinement failed" });
    }
  });

  // POST /analyze - Script Intelligence: score on Kallaway's 3 frameworks
  router.post("/analyze", async (req, res) => {
    if (!client) return res.status(503).json({ error: "AI unavailable" });
    const { script, contentTier: explicitTier } = req.body as {
      script: string;
      contentTier?: ContentTier;
    };
    if (!script) return res.status(400).json({ error: "Script is required" });

    // Estimate tier from word count if not provided
    const words = script.split(/\s+/).length;
    const tier = explicitTier || (words <= 150 ? "short" : words <= 450 ? "mid" : "long");
    const tierConfig = TIER_CONFIG[tier];

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: `You are a script quality analyst applying the Kallaway Content Frameworks. You audit scripts with surgical precision.

Score the script on THREE dimensions. Each dimension is 0-33 points (total 0-99).

=== DIMENSION 1: STORY FLOW (0-33) ===
Does every line advance the through-line promised by the hook?
- 28-33: Every line advances the through-line. Zero tangents. Laser focus.
- 20-27: Mostly focused. 1-2 lines drift slightly but recover.
- 10-19: Several tangents or filler lines. Through-line gets muddy.
- 0-9: No clear through-line. Jumps between topics.
Detect: tangents, filler phrases ("you know", "basically"), repeated points, backstory that breaks immersion, lines disconnected from the hook's promise.

=== DIMENSION 2: COMPREHENSION / ATOMIC MESSAGING (0-33) ===
Is the language at 6th grade level? Short sentences? Active voice?
- 28-33: All sentences under 15 words, active voice, simple vocab throughout.
- 20-27: Mostly simple. 1-2 complex sentences or passive constructions.
- 10-19: Multiple long sentences, some jargon unexplained, passive voice.
- 0-9: Academic language. Long sentences. Heavy jargon.
Detect: sentences over 15 words, passive voice, jargon without restatement, words above 6th grade level, unnamed concepts that should be named.

=== DIMENSION 3: SPEED TO VALUE + REHOOK ARCHITECTURE (0-33) ===
Does the script deliver value quickly and use rehooks to maintain attention?
Expected tier: ${tier} (${tierConfig.durationRange})
Expected structure: ${tierConfig.structure}
Expected rehooks: ${tierConfig.rehookCount}
- 28-33: Value in first sentence after hook. Correct rehook count. Each rehook earns attention for next section.
- 20-27: Good pacing. Rehook count off by 1. Value arrives promptly.
- 10-19: Slow to deliver value. Missing rehooks or they feel forced.
- 0-9: No rehook architecture. Value buried. Front-loaded setup with no payoff.
Detect: time-to-first-value, rehook presence and quality, section balance, outro effectiveness.

=== LINE-BY-LINE AUDIT ===
Split the script into lines (by newline). For EACH non-empty line:
- segment: HOOK, BODY, REHOOK, OUTRO, or UNKNOWN
- verdict: "keep" (advances through-line, clear language), "cut" (tangent, filler, redundant), or "simplify" (good idea but too complex or wordy)
- reason: 5-10 word explanation

=== SEGMENTS ===
Identify the section boundaries (start/end line numbers for each HOOK, BODY, REHOOK, OUTRO section).

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "scores": { "storyFlow": N, "comprehension": N, "speedToValue": N, "total": N },
  "lineAudit": [{ "lineNumber": 1, "text": "line text", "segment": "HOOK", "verdict": "keep", "reason": "strong opening" }],
  "segments": [{ "type": "HOOK", "startLine": 1, "endLine": 3 }],
  "summary": "2-3 sentence overall assessment"
}`,
        messages: [{
          role: "user",
          content: `Analyze this ${tier}-tier script:\n\n${script}`,
        }],
      });

      const text = response.content.find((b) => b.type === "text")?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        // Ensure total is the sum
        if (analysis.scores) {
          analysis.scores.total = (analysis.scores.storyFlow || 0) + (analysis.scores.comprehension || 0) + (analysis.scores.speedToValue || 0);
        }
        return res.json(analysis);
      }
      res.status(500).json({ error: "Failed to parse analysis" });
    } catch (err) {
      console.error("[video-director-ai] Analyze error:", err);
      res.status(500).json({ error: "Script analysis failed" });
    }
  });

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
