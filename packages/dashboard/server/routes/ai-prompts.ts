import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "../db.js";
import { aiGenerationPrompts } from "../../shared/schema.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

const CINEMA_DEFAULTS: Record<string, { camera: string; lens: string; focal: string; genre: string }> = {
  medical: { camera: "ARRI Alexa", lens: "Cooke", focal: "35mm", genre: "Intimate" },
  exercise: { camera: "Sony Venice", lens: "Canon K35", focal: "24mm", genre: "Intimate" },
  general: { camera: "RED V-RAPTOR", lens: "Zeiss Ultra Prime", focal: "50mm", genre: "Auto" },
};

const TECHNIQUE_GUIDANCE: Record<string, string> = {
  set_enhancement: `SET ENHANCEMENT prompts should be simple and direct. Describe only what to ADD to the existing scene.
Good example: "Add fairy lights and a small plant to the left of the desk"
Bad example: "Create a beautiful scene with..." (too vague)
Rules:
- Keep it under 2 sentences
- Be specific about placement (left, right, background, foreground)
- Describe objects, lighting additions, or decor changes
- Never describe camera movement or transitions
- No emdashes`,

  ai_transition: `AI TRANSITION prompts should narrate like a short story. Use positive, flowing terminology.
Good example: "The spine model rotates slowly as the camera pulls back to reveal the full skeleton"
Bad example: "Transition from spine to skeleton" (too mechanical)
Rules:
- Write as a continuous narrative sentence
- Use active verbs (rotates, reveals, transforms, flows, emerges)
- Describe the visual journey, not the edit technique
- Keep positive/forward momentum in language
- No emdashes`,

  scene_extension: `SCENE EXTENSION prompts must continue the same energy, lighting, and composition of the source.
Good example: "The scene continues as the patient stands up from the adjustment table, stretching their arms overhead with a relieved expression. Same warm lighting, same angle."
Bad example: "Show a person standing up" (loses continuity)
Rules:
- Reference the source scene's qualities (lighting, mood, angle)
- Describe what happens NEXT, not what already happened
- Maintain consistent character appearance and environment
- Include "same lighting" or "same angle" cues for continuity
- No emdashes`,

  full_generation: `FULL GENERATION prompts must include camera body, lens, focal length, and genre for Cinema Studio.
Good example: "A chiropractor demonstrates a seated spinal twist in a clean, modern clinic. Shot on ARRI Alexa with Cooke lens at 35mm. Intimate genre. Warm overhead lighting, shallow depth of field."
Rules:
- Always include: camera body, lens, focal length, genre
- Describe the scene completely (subject, action, environment, lighting)
- Include mood/atmosphere descriptors
- Specify depth of field when relevant
- No emdashes`,
};

function buildGenerateSystemPrompt(technique: string): string {
  const guidance = TECHNIQUE_GUIDANCE[technique] || TECHNIQUE_GUIDANCE.full_generation;

  return `You are an AI prompt engineer specializing in video production. You write prompts for AI video generation tools (Cinema Studio, Mixed Media, Vibe Motion).

TECHNIQUE: ${technique}

${guidance}

Generate a single prompt that follows the rules above. Return JSON:
{
  "promptText": "the generated prompt",
  "tool": "suggested tool name (Cinema Studio, Mixed Media, or Vibe Motion)",
  "model": "suggested AI model (Minimax Hailuo 02, Sora 2, WAN 2.6, or Kling 2.6)"
}

No emdashes in any text. Return JSON only, no markdown fences.`;
}

function buildIterateSystemPrompt(technique: string): string {
  const guidance = TECHNIQUE_GUIDANCE[technique] || TECHNIQUE_GUIDANCE.full_generation;

  return `You are an AI prompt engineer specializing in video production. You improve prompts based on result feedback.

TECHNIQUE: ${technique}

${guidance}

You will receive the current prompt and notes about what the result looked like. Generate an improved version that addresses the feedback while following the technique rules.

Return JSON:
{
  "promptText": "the improved prompt"
}

No emdashes in any text. Return JSON only, no markdown fences.`;
}

function getCinemaDefaults(shotType?: string, scriptLine?: string): { camera: string; lens: string; focal: string; genre: string } {
  if (shotType) {
    const lower = shotType.toLowerCase();
    if (lower.includes("exercise") || lower.includes("movement") || lower.includes("demo")) {
      return CINEMA_DEFAULTS.exercise;
    }
    if (lower.includes("medical") || lower.includes("educational") || lower.includes("anatomy")) {
      return CINEMA_DEFAULTS.medical;
    }
  }
  if (scriptLine) {
    const lower = scriptLine.toLowerCase();
    if (lower.includes("exercise") || lower.includes("stretch") || lower.includes("movement")) {
      return CINEMA_DEFAULTS.exercise;
    }
    if (lower.includes("spine") || lower.includes("nerve") || lower.includes("adjustment") || lower.includes("subluxation")) {
      return CINEMA_DEFAULTS.medical;
    }
  }
  return CINEMA_DEFAULTS.general;
}

export function createAiPromptsRouter() {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn(
      "[ai-prompts] ANTHROPIC_API_KEY not set. AI prompt features will be unavailable.",
    );
  }

  // GET /:videoCode - All prompts for a video's shots
  router.get("/:videoCode", async (req, res) => {
    try {
      const { videoCode } = req.params;
      const prompts = db
        .select()
        .from(aiGenerationPrompts)
        .where(eq(aiGenerationPrompts.videoCode, videoCode))
        .orderBy(asc(aiGenerationPrompts.shotNumber), asc(aiGenerationPrompts.promptVersion))
        .all();

      res.json({ prompts });
    } catch (error) {
      console.error("[ai-prompts] Get prompts error:", error);
      res.status(500).json({ error: "Failed to get prompts" });
    }
  });

  // POST / - Create a new prompt
  router.post("/", async (req, res) => {
    try {
      const {
        storyboardShotId,
        videoCode,
        shotNumber,
        technique,
        tool,
        model,
        promptText,
        sourceDescription,
        targetDescription,
      } = req.body;

      if (!videoCode || !technique || !promptText) {
        res.status(400).json({ error: "videoCode, technique, and promptText are required" });
        return;
      }

      const validTechniques = ["set_enhancement", "ai_transition", "scene_extension", "full_generation"];
      if (!validTechniques.includes(technique)) {
        res.status(400).json({ error: `Invalid technique. Must be one of: ${validTechniques.join(", ")}` });
        return;
      }

      const prompt = db
        .insert(aiGenerationPrompts)
        .values({
          storyboardShotId: storyboardShotId || null,
          videoCode,
          shotNumber: shotNumber || null,
          technique,
          tool: tool || null,
          model: model || null,
          promptText,
          promptVersion: 1,
          sourceDescription: sourceDescription || null,
          targetDescription: targetDescription || null,
          status: "draft",
        })
        .returning()
        .get();

      res.json({ prompt });
    } catch (error) {
      console.error("[ai-prompts] Create prompt error:", error);
      res.status(500).json({ error: "Failed to create prompt" });
    }
  });

  // PUT /:id - Update prompt fields
  router.put("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const existing = db
        .select()
        .from(aiGenerationPrompts)
        .where(eq(aiGenerationPrompts.id, id))
        .all();

      if (existing.length === 0) {
        res.status(404).json({ error: "Prompt not found" });
        return;
      }

      const {
        promptText,
        resultNotes,
        resultRating,
        status,
        tool,
        model,
        sourceDescription,
        targetDescription,
      } = req.body;

      const updates: Record<string, unknown> = {};
      if (promptText !== undefined) updates.promptText = promptText;
      if (resultNotes !== undefined) updates.resultNotes = resultNotes;
      if (resultRating !== undefined) updates.resultRating = resultRating;
      if (status !== undefined) updates.status = status;
      if (tool !== undefined) updates.tool = tool;
      if (model !== undefined) updates.model = model;
      if (sourceDescription !== undefined) updates.sourceDescription = sourceDescription;
      if (targetDescription !== undefined) updates.targetDescription = targetDescription;

      if (Object.keys(updates).length === 0) {
        res.json({ prompt: existing[0] });
        return;
      }

      const updated = db
        .update(aiGenerationPrompts)
        .set(updates)
        .where(eq(aiGenerationPrompts.id, id))
        .returning()
        .get();

      res.json({ prompt: updated });
    } catch (error) {
      console.error("[ai-prompts] Update prompt error:", error);
      res.status(500).json({ error: "Failed to update prompt" });
    }
  });

  // POST /:id/iterate - AI improves prompt based on result notes
  router.post("/:id/iterate", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const existing = db
        .select()
        .from(aiGenerationPrompts)
        .where(eq(aiGenerationPrompts.id, id))
        .all();

      if (existing.length === 0) {
        res.status(404).json({ error: "Prompt not found" });
        return;
      }

      const current = existing[0];

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: buildIterateSystemPrompt(current.technique),
        messages: [
          {
            role: "user",
            content: `CURRENT PROMPT (version ${current.promptVersion}):
"${current.promptText}"

RESULT NOTES:
${current.resultNotes || "(no notes provided)"}

${current.resultRating ? `RATING: ${current.resultRating}/5` : ""}
${current.sourceDescription ? `SOURCE: ${current.sourceDescription}` : ""}
${current.targetDescription ? `TARGET: ${current.targetDescription}` : ""}

Generate an improved version of this prompt that addresses the feedback.`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Find the max version for this video+shot combination
      const existingVersions = db
        .select()
        .from(aiGenerationPrompts)
        .where(
          and(
            eq(aiGenerationPrompts.videoCode, current.videoCode),
            current.shotNumber !== null
              ? eq(aiGenerationPrompts.shotNumber, current.shotNumber)
              : undefined,
            eq(aiGenerationPrompts.technique, current.technique),
          ),
        )
        .orderBy(desc(aiGenerationPrompts.promptVersion))
        .all();

      const nextVersion = existingVersions.length > 0
        ? (existingVersions[0].promptVersion || 1) + 1
        : (current.promptVersion || 1) + 1;

      const newPrompt = db
        .insert(aiGenerationPrompts)
        .values({
          storyboardShotId: current.storyboardShotId,
          videoCode: current.videoCode,
          shotNumber: current.shotNumber,
          technique: current.technique,
          tool: current.tool,
          model: current.model,
          promptText: parsed.promptText,
          promptVersion: nextVersion,
          sourceDescription: current.sourceDescription,
          targetDescription: current.targetDescription,
          status: "draft",
        })
        .returning()
        .get();

      res.json({ prompt: newPrompt, previousVersion: current.promptVersion });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to iterate prompt";
      console.error("[ai-prompts] Iterate error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /generate-for-shot - AI generates a technique-appropriate prompt
  router.post("/generate-for-shot", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    try {
      const {
        storyboardShotId,
        videoCode,
        shotNumber,
        technique,
        scriptLine,
        shotType,
        cameraMovement,
      } = req.body;

      if (!videoCode || !technique) {
        res.status(400).json({ error: "videoCode and technique are required" });
        return;
      }

      const validTechniques = ["set_enhancement", "ai_transition", "scene_extension", "full_generation"];
      if (!validTechniques.includes(technique)) {
        res.status(400).json({ error: `Invalid technique. Must be one of: ${validTechniques.join(", ")}` });
        return;
      }

      // Build context for AI
      let userContent = `Generate an AI prompt for this shot:\n`;
      userContent += `Video: ${videoCode}\n`;
      if (shotNumber) userContent += `Shot #${shotNumber}\n`;
      if (scriptLine) userContent += `Script line: "${scriptLine}"\n`;
      if (shotType) userContent += `Shot type: ${shotType}\n`;
      if (cameraMovement) userContent += `Camera movement: ${cameraMovement}\n`;

      if (technique === "full_generation") {
        const defaults = getCinemaDefaults(shotType, scriptLine);
        userContent += `\nCinema defaults to use:\n`;
        userContent += `- Camera: ${defaults.camera}\n`;
        userContent += `- Lens: ${defaults.lens}\n`;
        userContent += `- Focal length: ${defaults.focal}\n`;
        userContent += `- Genre: ${defaults.genre}\n`;
      }

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: buildGenerateSystemPrompt(technique),
        messages: [{ role: "user", content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      const prompt = db
        .insert(aiGenerationPrompts)
        .values({
          storyboardShotId: storyboardShotId || null,
          videoCode,
          shotNumber: shotNumber || null,
          technique,
          tool: parsed.tool || null,
          model: parsed.model || null,
          promptText: parsed.promptText,
          promptVersion: 1,
          status: "draft",
        })
        .returning()
        .get();

      res.json({ prompt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate prompt";
      console.error("[ai-prompts] Generate for shot error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
