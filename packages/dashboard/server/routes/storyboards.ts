import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db.js";
import { storyboards, storyboardShots, vaultVisualStyles, videoStatus } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { ProductionStyle } from "../../shared/types.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

export function createStoryboardsRouter(contentLibraryPath: string) {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[storyboards] ANTHROPIC_API_KEY not set.");
  }

  // POST /api/storyboards/:videoCode/generate - AI generates storyboard from video script
  router.post("/:videoCode/generate", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { videoCode } = req.params;
      const { visualStyleId } = req.body as { visualStyleId?: number };

      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === videoCode);
      if (!video) {
        res.status(404).json({ error: `Video ${videoCode} not found in content library` });
        return;
      }

      // Optionally load visual style
      let visualStyleRules = "";
      if (visualStyleId) {
        const style = db
          .select()
          .from(vaultVisualStyles)
          .where(eq(vaultVisualStyles.id, visualStyleId))
          .limit(1)
          .all();
        if (style.length > 0) {
          const s = style[0];
          visualStyleRules = `\nVISUAL STYLE: "${s.name}"
Typography: ${s.typographySystem}
Colors: ${s.colorPalette}
${s.transitionRules ? `Transitions: ${s.transitionRules}` : ""}
${s.setDesignRules ? `Set Design: ${s.setDesignRules}` : ""}
${s.musicGuidelines ? `Music: ${s.musicGuidelines}` : ""}
${s.motionGraphicsStyle ? `Motion Graphics: ${s.motionGraphicsStyle}` : ""}
${s.doNot ? `DO NOT: ${s.doNot}` : ""}`;
        }
      }

      // Look up production style for constraints
      const statusRecord = db.select().from(videoStatus).where(eq(videoStatus.videoCode, videoCode)).get();
      const prodStyle = statusRecord?.productionStyle as ProductionStyle | null;

      const styleConstraints: Record<string, string> = {
        real: "\nPRODUCTION STYLE CONSTRAINT: REAL - ALL shots must use productionMethod 'real' or 'motion_graphic'. No AI generation. No 'ai_enhanced' or 'ai_generated' methods.",
        enhanced: "\nPRODUCTION STYLE CONSTRAINT: ENHANCED - Most shots should be 'real'. Use 'ai_enhanced' sparingly for 2-3 shots max. Never use 'ai_generated' for talent-on-camera shots. The AI enhancements should be subtle and undetectable. IMPORTANT: For ai_enhanced shots, include color-grade matching notes to ensure AI output matches the warmth, contrast, and tone of adjacent real footage. Seamless cuts between real and AI are critical.",
        heavy_ai: "\nPRODUCTION STYLE CONSTRAINT: HEAVY AI - Talent may appear in hook and CTA shots. Most build/conflict/resolution shots should be 'ai_generated' or 'ai_enhanced'. Lean heavily on Cinema Studio visuals.",
        full_ai: "\nPRODUCTION STYLE CONSTRAINT: FULL AI - ALL shots must use 'ai_generated' or 'motion_graphic'. No 'real' production method. This video is voiceover-only with no filmed footage.",
      };
      const styleConstraint = prodStyle ? (styleConstraints[prodStyle] || "") : "";

      const prompt = `Generate a structured storyboard for this video. Map each shot to the 5-act story structure.

VIDEO: ${video.code} "${video.title}" | FORMAT: ${video.format} | AUDIENCE: ${video.audienceLabel}
SCRIPT: ${video.script}
${visualStyleRules}${styleConstraint}

For each shot determine:
1. Act position: hook (first 3s), conflict, build, resolution, cta
2. Shot type: wide, medium, closeup, macro, pov, insert
3. B-roll type: null (talent on camera), macro, process, reveal
4. Production method:
   - "real": Talent speaking or real B-roll
   - "ai_enhanced": Real footage + AI set enhancement
   - "ai_generated": Full AI visual (Cinema Studio prompt with camera, lens, genre)
   - "motion_graphic": Remotion component (TitleCard, StatCard, ChecklistOverlay, etc.)
5. For ai_enhanced: set enhancement prompt (simple, positive terms)
6. For ai_generated: Cinema Studio prompt (camera body, lens, focal length, genre)
7. For motion_graphic: which Remotion component + key props

Return JSON: { "storyboard": { "oneSentenceConcept": "...", "storyStructure": "...", "totalDurationSeconds": number }, "shots": [{ "shotNumber": number, "act": "hook|conflict|build|resolution|cta", "durationSeconds": number, "shotType": "wide|medium|closeup|macro|pov|insert", "cameraMovement": "static|pan|tilt|orbit|crane|tracking|null", "cinemaStudioPrompt": "string or null", "scriptLine": "string or null", "brollType": "macro|process|reveal|null", "productionMethod": "real|ai_enhanced|ai_generated|motion_graphic", "aiEnhancementNotes": "string or null", "remotionComponent": "string or null", "notes": "string or null" }] }
No emdashes.`;

      console.log(`[storyboards] Generating storyboard for ${videoCode}...`);

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }, { timeout: 120_000 });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));
      const storyboardData = parsed.storyboard;
      const shotsData = parsed.shots || [];

      // Save storyboard
      const savedStoryboard = db
        .insert(storyboards)
        .values({
          videoCode,
          visualStyleId: visualStyleId || null,
          oneSentenceConcept: storyboardData.oneSentenceConcept || null,
          storyStructure: typeof storyboardData.storyStructure === "string"
            ? storyboardData.storyStructure
            : JSON.stringify(storyboardData.storyStructure),
          totalDurationSeconds: storyboardData.totalDurationSeconds || null,
          status: "draft",
        })
        .returning()
        .get();

      // Save shots
      const savedShots = [];
      for (let i = 0; i < shotsData.length; i++) {
        const shot = shotsData[i];
        const savedShot = db
          .insert(storyboardShots)
          .values({
            storyboardId: savedStoryboard.id,
            shotNumber: shot.shotNumber || i + 1,
            act: shot.act || null,
            durationSeconds: shot.durationSeconds || 3,
            shotType: shot.shotType || null,
            cameraMovement: shot.cameraMovement || null,
            cinemaStudioPrompt: shot.cinemaStudioPrompt || null,
            scriptLine: shot.scriptLine || null,
            brollType: shot.brollType || null,
            productionMethod: shot.productionMethod || "real",
            aiEnhancementNotes: shot.aiEnhancementNotes || null,
            remotionComponent: shot.remotionComponent || null,
            notes: shot.notes || null,
            orderIndex: i,
          })
          .returning()
          .get();
        savedShots.push(savedShot);
      }

      console.log(`[storyboards] Generated storyboard for ${videoCode}: ${savedShots.length} shots`);
      res.json({ storyboard: savedStoryboard, shots: savedShots });
    } catch (error) {
      console.error("[storyboards] Generate error:", error);
      res.status(500).json({ error: "Failed to generate storyboard" });
    }
  });

  // GET /api/storyboards/:videoCode - Get storyboard + all shots for a video
  router.get("/:videoCode", async (req, res) => {
    try {
      const { videoCode } = req.params;

      const storyboardRows = db
        .select()
        .from(storyboards)
        .where(eq(storyboards.videoCode, videoCode))
        .orderBy(asc(storyboards.createdAt))
        .all();

      if (storyboardRows.length === 0) {
        res.json({ storyboard: null, shots: [] });
        return;
      }

      // Return the most recent storyboard
      const storyboard = storyboardRows[storyboardRows.length - 1];

      const shots = db
        .select()
        .from(storyboardShots)
        .where(eq(storyboardShots.storyboardId, storyboard.id))
        .orderBy(asc(storyboardShots.orderIndex))
        .all();

      res.json({ storyboard, shots });
    } catch (error) {
      console.error("[storyboards] Get error:", error);
      res.status(500).json({ error: "Failed to get storyboard" });
    }
  });

  // PUT /api/storyboards/:id - Update storyboard metadata (concept, status)
  router.put("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { oneSentenceConcept, storyStructure, totalDurationSeconds, status } = req.body;

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (oneSentenceConcept !== undefined) updates.oneSentenceConcept = oneSentenceConcept;
      if (storyStructure !== undefined) {
        updates.storyStructure = typeof storyStructure === "string"
          ? storyStructure
          : JSON.stringify(storyStructure);
      }
      if (totalDurationSeconds !== undefined) updates.totalDurationSeconds = totalDurationSeconds;
      if (status !== undefined) updates.status = status;

      const result = db
        .update(storyboards)
        .set(updates)
        .where(eq(storyboards.id, id))
        .returning()
        .get();

      if (!result) {
        res.status(404).json({ error: "Storyboard not found" });
        return;
      }

      res.json({ storyboard: result });
    } catch (error) {
      console.error("[storyboards] Update error:", error);
      res.status(500).json({ error: "Failed to update storyboard" });
    }
  });

  // PUT /api/storyboards/:id/shots/:shotId - Update individual shot
  router.put("/:id/shots/:shotId", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const shotId = parseInt(req.params.shotId);

      // Verify the shot belongs to this storyboard
      const existing = db
        .select()
        .from(storyboardShots)
        .where(and(eq(storyboardShots.id, shotId), eq(storyboardShots.storyboardId, id)))
        .limit(1)
        .all();

      if (existing.length === 0) {
        res.status(404).json({ error: "Shot not found in this storyboard" });
        return;
      }

      const {
        shotNumber, act, durationSeconds, shotType, cameraMovement,
        cinemaStudioPrompt, scriptLine, brollType, productionMethod,
        aiEnhancementNotes, remotionComponent, notes, orderIndex,
      } = req.body;

      const updates: Record<string, unknown> = {};
      if (shotNumber !== undefined) updates.shotNumber = shotNumber;
      if (act !== undefined) updates.act = act;
      if (durationSeconds !== undefined) updates.durationSeconds = durationSeconds;
      if (shotType !== undefined) updates.shotType = shotType;
      if (cameraMovement !== undefined) updates.cameraMovement = cameraMovement;
      if (cinemaStudioPrompt !== undefined) updates.cinemaStudioPrompt = cinemaStudioPrompt;
      if (scriptLine !== undefined) updates.scriptLine = scriptLine;
      if (brollType !== undefined) updates.brollType = brollType;
      if (productionMethod !== undefined) updates.productionMethod = productionMethod;
      if (aiEnhancementNotes !== undefined) updates.aiEnhancementNotes = aiEnhancementNotes;
      if (remotionComponent !== undefined) updates.remotionComponent = remotionComponent;
      if (notes !== undefined) updates.notes = notes;
      if (orderIndex !== undefined) updates.orderIndex = orderIndex;

      const result = db
        .update(storyboardShots)
        .set(updates)
        .where(eq(storyboardShots.id, shotId))
        .returning()
        .get();

      res.json({ shot: result });
    } catch (error) {
      console.error("[storyboards] Update shot error:", error);
      res.status(500).json({ error: "Failed to update shot" });
    }
  });

  // POST /api/storyboards/:id/shots - Add a new shot
  router.post("/:id/shots", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Verify storyboard exists
      const storyboard = db
        .select()
        .from(storyboards)
        .where(eq(storyboards.id, id))
        .limit(1)
        .all();

      if (storyboard.length === 0) {
        res.status(404).json({ error: "Storyboard not found" });
        return;
      }

      // Get max order index for this storyboard
      const existingShots = db
        .select()
        .from(storyboardShots)
        .where(eq(storyboardShots.storyboardId, id))
        .orderBy(asc(storyboardShots.orderIndex))
        .all();

      const maxOrder = existingShots.length > 0
        ? Math.max(...existingShots.map((s) => s.orderIndex))
        : -1;
      const maxShotNumber = existingShots.length > 0
        ? Math.max(...existingShots.map((s) => s.shotNumber))
        : 0;

      const {
        shotNumber, act, durationSeconds, shotType, cameraMovement,
        cinemaStudioPrompt, scriptLine, brollType, productionMethod,
        aiEnhancementNotes, remotionComponent, notes, orderIndex,
      } = req.body;

      const result = db
        .insert(storyboardShots)
        .values({
          storyboardId: id,
          shotNumber: shotNumber || maxShotNumber + 1,
          act: act || null,
          durationSeconds: durationSeconds || 3,
          shotType: shotType || null,
          cameraMovement: cameraMovement || null,
          cinemaStudioPrompt: cinemaStudioPrompt || null,
          scriptLine: scriptLine || null,
          brollType: brollType || null,
          productionMethod: productionMethod || "real",
          aiEnhancementNotes: aiEnhancementNotes || null,
          remotionComponent: remotionComponent || null,
          notes: notes || null,
          orderIndex: orderIndex !== undefined ? orderIndex : maxOrder + 1,
        })
        .returning()
        .get();

      res.json({ shot: result });
    } catch (error) {
      console.error("[storyboards] Add shot error:", error);
      res.status(500).json({ error: "Failed to add shot" });
    }
  });

  // DELETE /api/storyboards/:id/shots/:shotId - Remove a shot
  router.delete("/:id/shots/:shotId", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const shotId = parseInt(req.params.shotId);

      // Verify the shot belongs to this storyboard
      const existing = db
        .select()
        .from(storyboardShots)
        .where(and(eq(storyboardShots.id, shotId), eq(storyboardShots.storyboardId, id)))
        .limit(1)
        .all();

      if (existing.length === 0) {
        res.status(404).json({ error: "Shot not found in this storyboard" });
        return;
      }

      db.delete(storyboardShots).where(eq(storyboardShots.id, shotId)).run();

      res.json({ deleted: true });
    } catch (error) {
      console.error("[storyboards] Delete shot error:", error);
      res.status(500).json({ error: "Failed to delete shot" });
    }
  });

  // POST /api/storyboards/:id/shots/:shotId/suggest-enhancement - AI suggests best AI enhancement technique
  router.post("/:id/shots/:shotId/suggest-enhancement", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const id = parseInt(req.params.id);
      const shotId = parseInt(req.params.shotId);

      // Get the shot
      const shotRows = db
        .select()
        .from(storyboardShots)
        .where(and(eq(storyboardShots.id, shotId), eq(storyboardShots.storyboardId, id)))
        .limit(1)
        .all();

      if (shotRows.length === 0) {
        res.status(404).json({ error: "Shot not found in this storyboard" });
        return;
      }

      const shot = shotRows[0];

      // Get the storyboard for video context
      const storyboardRow = db
        .select()
        .from(storyboards)
        .where(eq(storyboards.id, id))
        .limit(1)
        .all();

      if (storyboardRow.length === 0) {
        res.status(404).json({ error: "Storyboard not found" });
        return;
      }

      const sb = storyboardRow[0];

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Suggest the best AI enhancement technique for this shot from a video storyboard.

VIDEO: ${sb.videoCode} | CONCEPT: ${sb.oneSentenceConcept || "N/A"}

SHOT #${shot.shotNumber}:
- Act: ${shot.act || "N/A"}
- Duration: ${shot.durationSeconds}s
- Shot type: ${shot.shotType || "N/A"}
- Script line: ${shot.scriptLine || "N/A"}
- Current production method: ${shot.productionMethod}
- Current B-roll type: ${shot.brollType || "none"}

Available AI tools and techniques:
1. Scene Extension: Film 3-5s real clip, AI continues the scene
2. Impossible Camera Moves: Static footage + Cinema Studio presets (Slow Orbit, Crane Up, Bullet Time)
3. Environment Enhancement: AI transforms background while preserving real performance
4. Mixed Media: Apply signature visual look to real clips
5. Upscale: Match phone footage quality to AI segments
6. Motion Engine: Smooth shaky real footage
7. Remotion motion graphic: TitleCard, StatCard, ChecklistOverlay, MythTruthReveal, StepIndicator, CallToAction, HookText, SectionCard
8. Color-Grade Matching: Match AI-generated shot colors/contrast/warmth to adjacent real footage for seamless cuts
9. Motion Tracking Overlay: AI elements (text, graphics, environmental additions) that track motion in real footage
10. Voice Clone + Lip Sync: AI voice generation with synchronized lip movement (Kling 2.6/3.0 or Lipsync Studio)

For the recommended technique, provide:
- Which technique and why
- Specific Cinema Studio prompt if applicable (camera body, lens, focal length, genre)
- Specific Remotion component if applicable
- Enhancement notes (simple, positive terms)

Return JSON:
{
  "recommendedMethod": "real|ai_enhanced|ai_generated|motion_graphic",
  "technique": "name of the technique",
  "reasoning": "why this is the best choice",
  "cinemaStudioPrompt": "prompt if applicable, null otherwise",
  "remotionComponent": "component name if applicable, null otherwise",
  "aiEnhancementNotes": "enhancement details",
  "alternativeMethod": "second best option",
  "alternativeReasoning": "why it could also work"
}
No emdashes.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const suggestion = JSON.parse(stripCodeFences(textBlock.text));
      res.json({ suggestion, shot });
    } catch (error) {
      console.error("[storyboards] Suggest enhancement error:", error);
      res.status(500).json({ error: "Failed to suggest enhancement" });
    }
  });

  return router;
}
