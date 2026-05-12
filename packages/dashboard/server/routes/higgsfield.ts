import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  isConfigured,
  isCliInstalled,
  isAuthenticated,
  getAccountStatus,
  generateImage,
  generateVideo,
  uploadMediaFromUrl,
  estimateBatchCost,
  runCli,
  clearAuthCache,
  IMAGE_MODEL_CATALOG,
  VIDEO_MODEL_CATALOG,
  defaultModelForUseCase,
  type HiggsfieldModelKey,
} from "../lib/higgsfield-client.js";
import { readSkillIfPresent, pickSeedanceSkill, skillInstallStatus } from "../lib/claude-skill-loader.js";
import { sqlite } from "../db.js";

/** Look up the currently active Soul character (or null). */
function getActiveSoulId(): { soulId: string; name: string } | null {
  try {
    const row = sqlite
      .prepare("SELECT soul_id, name FROM higgsfield_characters WHERE active = 1 LIMIT 1")
      .get() as { soul_id?: string; name?: string } | undefined;
    if (row?.soul_id) return { soulId: row.soul_id, name: row.name || "Active character" };
    return null;
  } catch {
    return null;
  }
}

type ShotListItem = {
  second?: number;
  shot?: string;
  action?: string;
  textOverlay?: string | null;
};

type ScriptContext = {
  title: string;
  hookSpoken?: string;
  hookVisual?: string;
  audience?: string;
  format?: string;
};

/**
 * Build a Higgsfield-friendly image prompt from a shot description using the MCSLA recipe
 * (Model, Composition, Subject, Lighting, Aesthetic) baked into the system prompt.
 */
async function expandShotToPrompt(
  shot: ShotListItem,
  scriptCtx: ScriptContext,
  client: Anthropic,
): Promise<string> {
  // Prepend the installed nano-banana-prompts skill as a system prompt when available.
  const nbSkill = readSkillIfPresent("nano-banana-prompts");
  const system = nbSkill
    ? `You are an expert image-prompt engineer. Apply the following installed skill verbatim when crafting prompts:\n\n${nbSkill}\n\nFor THIS request, follow the skill's structure to produce a single optimized prompt.`
    : undefined;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      ...(system ? { system } : {}),
      messages: [
        {
          role: "user",
          content: `Convert this shot description into a single optimized image prompt for Higgsfield's image generator. Return ONLY the prompt — no preamble, no quotes, no explanation. 2-4 sentences max.

VIDEO CONTEXT
Title: ${scriptCtx.title}
Audience: ${scriptCtx.audience || "general adult patient"}
Format: ${scriptCtx.format || "short-form video"}
Hook visual: ${scriptCtx.hookVisual || "—"}

SHOT TO RENDER
Action: ${shot.action || shot.shot || ""}
Shot framing: ${shot.shot || ""}
Text overlay: ${shot.textOverlay || "—"}

CONSTRAINTS
- This is for a chiropractic / health content production. Patient-facing, warm, professional. NO clinical-blue color grading.
- 9:16 vertical, intended for Reel/TikTok B-roll.
- One frame, one moment. Be specific about composition, subject, lighting, and aesthetic.
- No emdashes.`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (block && block.type === "text") {
      return block.text.trim().replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error("[higgsfield] prompt expansion failed:", e);
  }
  return `Cinematic 9:16 shot. ${shot.action || shot.shot || scriptCtx.title}. Warm natural lighting, editorial photography, shallow depth of field, soft film grain.`;
}

/**
 * Build a Seedance 2.0 motion prompt from a still image's existing prompt + the
 * scene context. When the seedance-director skill pack is installed (~/.claude/skills/seedance-director),
 * uses the best matching sub-skill (cinematic / social-hook / fashion / etc.) as the system prompt.
 */
async function expandShotToMotionPrompt(
  shot: ShotListItem & { sourceImagePrompt?: string },
  scriptCtx: ScriptContext,
  duration: number,
  client: Anthropic,
): Promise<string> {
  const hint = `${scriptCtx.title} ${shot.action || ""} ${shot.shot || ""}`;
  const seedanceSkill = pickSeedanceSkill(hint);
  const system = seedanceSkill
    ? `You are an expert Seedance 2.0 prompt engineer. Apply this installed skill verbatim:\n\n${seedanceSkill}\n\nReturn one production-ready prompt that follows the skill's framework.`
    : undefined;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      ...(system ? { system } : {}),
      messages: [
        {
          role: "user",
          content: `Write a Seedance 2.0 motion prompt for a ${duration}-second clip animated from a static B-Roll image. Return ONLY the prompt — no preamble, no quotes.

SOURCE IMAGE PROMPT (the still already exists; describe motion ON TOP of it)
${shot.sourceImagePrompt || "—"}

SCENE
Title: ${scriptCtx.title}
Audience: ${scriptCtx.audience || "general adult patient"}
Action: ${shot.action || shot.shot || ""}
Text overlay (already in image, ignore): ${shot.textOverlay || "—"}

CONSTRAINTS
- Duration: ${duration} seconds exact.
- 9:16 vertical for Reel/TikTok B-Roll.
- Specify camera motion (push-in, slow dolly, pan, handheld) and any subject motion.
- Specify natural ambient audio (not narration — voiceover is added separately).
- Warm, editorial, patient-facing. NO clinical-blue.
- Use the skill's hook framework for the first 2 seconds if applicable.
- No emdashes.`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (block && block.type === "text") {
      return block.text.trim().replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error("[higgsfield] motion prompt expansion failed:", e);
  }
  return `${duration}-second cinematic clip animating the source frame. Slow push-in, subtle subject motion, warm ambient audio. 9:16.`;
}

/**
 * Generate 4 thumbnail prompt variants using different visual angles.
 */
async function expandTitleToThumbnailPrompts(
  scriptCtx: ScriptContext,
  client: Anthropic,
): Promise<string[]> {
  const nbSkill = readSkillIfPresent("nano-banana-prompts");
  const system = nbSkill
    ? `You are an expert image-prompt engineer. Apply this installed skill when crafting each variant:\n\n${nbSkill}\n\nFollow its scene-first + structured template principles for every prompt you return.`
    : undefined;
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    ...(system ? { system } : {}),
    messages: [
      {
        role: "user",
        content: `Generate 4 thumbnail image prompts for the video below. Each prompt targets a different psychological angle to A/B test. Return ONLY a JSON array of 4 strings, no preamble.

VIDEO
Title: ${scriptCtx.title}
Hook (spoken): "${scriptCtx.hookSpoken || ""}"
Hook (visual): ${scriptCtx.hookVisual || "—"}
Audience: ${scriptCtx.audience || "general adult patient"}
Format: ${scriptCtx.format || "short-form video"}

VARIANT ANGLES
1. CURIOSITY GAP — close-up subject with intriguing expression, partial reveal, unanswered question energy
2. STATISTIC STOP — bold number overlay area, clean negative space, data-credibility look
3. SHOCK CONTRAST — before/after split frame OR pattern-interrupt visual (something unexpected)
4. AUTHORITY — confident chiropractor/patient mid-action, premium magazine editorial feel

CONSTRAINTS
- 9:16 vertical thumbnails for Instagram Reels / TikTok / YouTube Shorts.
- Warm, editorial, NO clinical-blue. Apple Music + Stripe Dashboard aesthetic.
- Each prompt: 2-3 sentences max. Specific about composition, subject, lighting.
- Leave generous negative space for a text overlay (mention "negative space for bold text overlay").
- Patient-facing chiropractic content. Professional, warm, real.
- No emdashes.

Return ONLY: ["prompt1", "prompt2", "prompt3", "prompt4"]`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No AI response");
  const raw = block.text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI returned non-JSON");
  const parsed = JSON.parse(jsonMatch[0]) as string[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned no prompts");
  }
  return parsed;
}

export function createHiggsfieldRouter() {
  const router = Router();

  // ── List selectable models (image or video) with metadata + cost ──────────
  router.get("/models", async (req, res) => {
    const type = String(req.query.type || "image");
    if (type === "video") {
      res.json({
        models: VIDEO_MODEL_CATALOG,
        defaults: {
          video: defaultModelForUseCase("video"),
          "video-fast": defaultModelForUseCase("video-fast"),
        },
      });
      return;
    }
    res.json({
      models: IMAGE_MODEL_CATALOG,
      defaults: {
        broll: defaultModelForUseCase("broll"),
        thumbnail: defaultModelForUseCase("thumbnail"),
        carousel: defaultModelForUseCase("carousel"),
        hero: defaultModelForUseCase("hero"),
      },
    });
  });

  // ── Cost estimate for a batch ──────────────────────────────────────────────
  // GET /api/higgsfield/cost-estimate?modelKey=nano_banana_2&count=6&resolution=1k
  router.get("/cost-estimate", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured" });
      return;
    }
    const modelKey = String(req.query.modelKey || "nano_banana_2") as HiggsfieldModelKey;
    const count = parseInt(String(req.query.count || "1"), 10);
    const params: Record<string, string> = {};
    if (req.query.resolution) params.resolution = String(req.query.resolution);
    if (req.query.quality) params.quality = String(req.query.quality);
    if (req.query.aspect_ratio) params.aspect_ratio = String(req.query.aspect_ratio);
    const cost = await estimateBatchCost(modelKey, count, params);
    res.json({ modelKey, count, ...cost });
  });

  // ── Config check ──────────────────────────────────────────────────────────
  router.get("/status", async (req, res) => {
    if (req.query.refresh === "1") clearAuthCache();
    const [cliInstalled, authed] = await Promise.all([isCliInstalled(), isAuthenticated()]);
    const account = authed ? await getAccountStatus() : null;
    const configured = cliInstalled && authed;
    res.json({
      configured,
      cliInstalled,
      authenticated: authed,
      email: account?.email,
      credits: account?.credits,
      skills: skillInstallStatus(),
      hint: !cliInstalled
        ? "Higgsfield CLI not installed. Run: brew install higgsfield-ai/tap/higgsfield  (or: npm install -g @higgsfield/cli)"
        : !authed
        ? "Higgsfield CLI installed but not signed in. Run: higgsfield auth login"
        : "Higgsfield CLI is configured and signed in.",
    });
  });

  // ── Tier A: Generate B-Roll Pack from a script's shotList ─────────────────
  // POST /api/higgsfield/generate-broll
  // Body: { shotList: ShotListItem[], scriptCtx: ScriptContext, modelKey?: HiggsfieldModelKey, aspectRatio?: string }
  // Returns: [{ shotIndex, second, prompt, imageUrl, requestId, status }]
  router.post("/generate-broll", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not installed or not signed in. Run: higgsfield auth login" });
      return;
    }
    let anthropic: Anthropic | null = null;
    try {
      anthropic = new Anthropic();
    } catch {
      res.status(503).json({ error: "Anthropic not configured for prompt expansion." });
      return;
    }
    try {
      const { shotList, scriptCtx, modelKey: bodyModelKey, aspectRatio, maxShots, resolution, quality } = req.body as {
        shotList: ShotListItem[];
        scriptCtx: ScriptContext;
        modelKey?: HiggsfieldModelKey;
        aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
        maxShots?: number;
        resolution?: "1k" | "2k" | "4k";
        quality?: "low" | "medium" | "high" | "basic" | "1.5k" | "2k";
      };
      if (!Array.isArray(shotList) || shotList.length === 0) {
        res.status(400).json({ error: "shotList must be a non-empty array" });
        return;
      }
      if (!scriptCtx?.title) {
        res.status(400).json({ error: "scriptCtx.title required" });
        return;
      }
      const cap = Math.min(shotList.length, maxShots || 6);
      const shots = shotList.slice(0, cap);
      const effectiveModel = bodyModelKey || defaultModelForUseCase("broll");
      const modelInfo = IMAGE_MODEL_CATALOG.find((m) => m.key === effectiveModel);

      // Expand prompts in parallel
      const prompts = await Promise.all(shots.map((s) => expandShotToPrompt(s, scriptCtx, anthropic!)));

      const activeChar = getActiveSoulId();
      const usesSoul = effectiveModel === "soul" || effectiveModel === "soul_cinematic";

      // Submit all generations in parallel (each call is itself a submit+poll)
      const results = await Promise.all(
        shots.map(async (shot, i) => {
          try {
            const { imageUrl, requestId } = await generateImage({
              prompt: prompts[i],
              modelKey: effectiveModel,
              aspectRatio: aspectRatio || "9:16",
              resolution: resolution as "1k" | "2k" | "4k" | undefined,
              quality: quality as "1.5k" | "2k" | undefined,
              customReferenceId: usesSoul && activeChar ? activeChar.soulId : undefined,
            });
            return {
              shotIndex: i,
              second: shot.second,
              shot: shot.shot,
              action: shot.action,
              textOverlay: shot.textOverlay,
              prompt: prompts[i],
              imageUrl,
              requestId,
              status: "completed" as const,
              modelKey: effectiveModel,
              modelDisplay: modelInfo?.displayName,
              creditsExact: modelInfo?.estimatedCredits,
            };
          } catch (e) {
            return {
              shotIndex: i,
              second: shot.second,
              shot: shot.shot,
              action: shot.action,
              textOverlay: shot.textOverlay,
              prompt: prompts[i],
              imageUrl: null,
              requestId: null,
              status: "failed" as const,
              error: String(e instanceof Error ? e.message : e),
              modelKey: effectiveModel,
              modelDisplay: modelInfo?.displayName,
            };
          }
        }),
      );

      res.json({ results, skipped: shotList.length - cap, modelKey: effectiveModel, modelDisplay: modelInfo?.displayName });
    } catch (e) {
      console.error("[higgsfield] generate-broll error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ── Tier B: Generate Thumbnail Pack (4 A/B-ready variants) ────────────────
  // POST /api/higgsfield/thumbnail-pack
  // Body: { title, hookSpoken?, hookVisual?, audience?, format?, aspectRatio? }
  // Returns: { variants: [{ angle, prompt, imageUrl, requestId }] }
  router.post("/thumbnail-pack", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not installed or not signed in. Run: higgsfield auth login" });
      return;
    }
    let anthropic: Anthropic | null = null;
    try {
      anthropic = new Anthropic();
    } catch {
      res.status(503).json({ error: "Anthropic not configured for prompt expansion." });
      return;
    }
    try {
      const { title, hookSpoken, hookVisual, audience, format, aspectRatio, modelKey: bodyModelKey, resolution, quality } = req.body as {
        title: string;
        hookSpoken?: string;
        hookVisual?: string;
        audience?: string;
        format?: string;
        aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
        modelKey?: HiggsfieldModelKey;
        resolution?: "1k" | "2k" | "4k";
        quality?: "low" | "medium" | "high" | "basic" | "1.5k" | "2k";
      };
      if (!title) {
        res.status(400).json({ error: "title required" });
        return;
      }

      const scriptCtx: ScriptContext = { title, hookSpoken, hookVisual, audience, format };
      const prompts = await expandTitleToThumbnailPrompts(scriptCtx, anthropic);

      const ANGLES = ["Curiosity Gap", "Statistic Stop", "Shock Contrast", "Authority"];
      const effectiveModel = bodyModelKey || defaultModelForUseCase("thumbnail");
      const modelInfo = IMAGE_MODEL_CATALOG.find((m) => m.key === effectiveModel);
      const activeChar = getActiveSoulId();
      const usesSoul = effectiveModel === "soul" || effectiveModel === "soul_cinematic";

      const variants = await Promise.all(
        prompts.slice(0, 4).map(async (prompt, i) => {
          try {
            const { imageUrl, requestId } = await generateImage({
              prompt,
              modelKey: effectiveModel,
              aspectRatio: aspectRatio || "9:16",
              resolution: resolution as "1k" | "2k" | "4k" | undefined,
              quality: quality as "1.5k" | "2k" | undefined,
              customReferenceId: usesSoul && activeChar ? activeChar.soulId : undefined,
            });
            return {
              angle: ANGLES[i] || `Variant ${i + 1}`,
              prompt,
              imageUrl,
              requestId,
              status: "completed" as const,
              modelKey: effectiveModel,
              modelDisplay: modelInfo?.displayName,
              creditsExact: modelInfo?.estimatedCredits,
            };
          } catch (e) {
            return {
              angle: ANGLES[i] || `Variant ${i + 1}`,
              prompt,
              imageUrl: null,
              requestId: null,
              status: "failed" as const,
              error: String(e instanceof Error ? e.message : e),
              modelKey: effectiveModel,
              modelDisplay: modelInfo?.displayName,
            };
          }
        }),
      );

      res.json({ variants, modelKey: effectiveModel, modelDisplay: modelInfo?.displayName });
    } catch (e) {
      console.error("[higgsfield] thumbnail-pack error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ── Marketing Studio: list brand kits ──────────────────────────────────────
  router.get("/marketing-studio/brand-kits", async (_req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured" });
      return;
    }
    try {
      const { stdout } = await runCli(["marketing-studio", "brand-kits", "list", "--json", "--no-color"], { timeoutMs: 10_000 });
      const parsed = JSON.parse(stdout.trim());
      res.json({ items: parsed.items || [], total: parsed.total_count || 0 });
    } catch (e) {
      console.error("[hf/ms/brand-kits] error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ── Marketing Studio: list ad formats ──────────────────────────────────────
  router.get("/marketing-studio/ad-formats", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured" });
      return;
    }
    try {
      const type = req.query.type as string | undefined;
      const args = ["marketing-studio", "ad-formats", "list", "--json", "--no-color"];
      if (type) args.push("--type", type);
      const { stdout } = await runCli(args, { timeoutMs: 10_000 });
      const parsed = JSON.parse(stdout.trim());
      res.json({ items: Array.isArray(parsed) ? parsed : parsed.items || [] });
    } catch (e) {
      console.error("[hf/ms/ad-formats] error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ── Marketing Studio: generate a DTC ad image ──────────────────────────────
  router.post("/marketing-studio/generate-ad", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured" });
      return;
    }
    try {
      const { prompt, formatId, brandKitId, aspectRatio, quality, resolution } = req.body as {
        prompt: string;
        formatId: string;
        brandKitId?: string;
        aspectRatio?: string;
        quality?: "low" | "medium" | "high";
        resolution?: "1k" | "2k" | "4k";
      };
      if (!prompt || !formatId) {
        res.status(400).json({ error: "prompt and formatId required" });
        return;
      }
      const args: string[] = [
        "marketing-studio", "dtc-ads", "generate",
        "--prompt", prompt,
        "--format-id", formatId,
        "--aspect-ratio", aspectRatio || "9:16",
        "--quality", quality || "high",
        "--resolution", resolution || "2k",
      ];
      if (brandKitId) args.push("--brand-kit-id", brandKitId);
      args.push("--wait", "--json", "--no-color");

      const { stdout } = await runCli(args, { timeoutMs: 10 * 60_000 });
      const trimmed = stdout.trim();
      const jsonStart = trimmed.search(/[[{]/);
      if (jsonStart < 0) throw new Error("non-JSON output");
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      const job = Array.isArray(parsed) ? parsed[0] : parsed;
      const imageUrl = job?.result_url;
      if (!imageUrl) throw new Error("no result_url");
      res.json({
        imageUrl,
        requestId: job.id,
        formatId,
        brandKitId,
      });
    } catch (e) {
      console.error("[hf/ms/generate-ad] error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ── Tier 1: Animate a B-Roll image into a Seedance / Kling / Veo motion clip ──
  // POST /api/higgsfield/animate-image
  // Body: {
  //   imageUrl: string,         // remote URL (Higgsfield CloudFront) of the source image
  //   endImageUrl?: string,     // NEW: when set, generates a smooth A->B frame-pair transition
  //   sourceImagePrompt?: string, // original prompt used to generate the still
  //   motionPrompt?: string,    // optional user override; otherwise auto-expanded
  //   shot?: { second, action, shot, textOverlay },
  //   scriptCtx?: { title, hookSpoken, hookVisual, audience, format },
  //   modelKey?: "seedance" | "kling" | "veo",
  //   duration?: 4 | 5 | 6 | 8 | 10 | 15,
  //   aspectRatio?: "9:16" | "16:9" | "1:1" | ...,
  //   resolution?: "480p" | "720p" | "1080p",
  //   genre?: "auto" | "action" | ...,
  // }
  router.post("/animate-image", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not installed or not signed in. Run: higgsfield auth login" });
      return;
    }
    let anthropic: Anthropic | null = null;
    try { anthropic = new Anthropic(); } catch { /* prompt expansion will fall back */ }

    try {
      const {
        imageUrl,
        endImageUrl,
        sourceImagePrompt,
        motionPrompt: userMotionPrompt,
        shot,
        scriptCtx,
        modelKey: bodyModelKey,
        duration,
        aspectRatio,
        resolution,
        genre,
      } = req.body as {
        imageUrl: string;
        endImageUrl?: string;
        sourceImagePrompt?: string;
        motionPrompt?: string;
        shot?: ShotListItem;
        scriptCtx?: ScriptContext;
        modelKey?: "seedance" | "kling" | "veo";
        duration?: number;
        aspectRatio?: string;
        resolution?: "480p" | "720p" | "1080p";
        genre?: "auto" | "action" | "horror" | "comedy" | "noir" | "drama" | "epic";
      };

      if (!imageUrl) {
        res.status(400).json({ error: "imageUrl is required" });
        return;
      }

      const effectiveModel = bodyModelKey || "seedance";
      const info = VIDEO_MODEL_CATALOG.find((m) => m.key === effectiveModel);

      // 1. Upload start (and optional end) image
      const uploadId = await uploadMediaFromUrl(imageUrl);
      const endUploadId = endImageUrl ? await uploadMediaFromUrl(endImageUrl) : undefined;

      // 2. Expand the motion prompt (uses Seedance skill if installed)
      let motionPrompt = userMotionPrompt;
      if (!motionPrompt) {
        if (!anthropic) {
          motionPrompt = endUploadId
            ? `Cinematic ${duration ?? 5}-second smooth transition between the start and end frames. Subtle interpolation of camera position and lighting. 9:16.`
            : `Cinematic ${duration ?? 5}-second clip animating the source frame. Slow push-in, subtle subject motion, warm ambient audio. 9:16.`;
        } else {
          motionPrompt = await expandShotToMotionPrompt(
            { ...(shot || {}), sourceImagePrompt },
            scriptCtx || { title: "B-Roll animation" },
            duration ?? 5,
            anthropic,
          );
        }
      }

      // 3. Generate
      const { videoUrl, requestId } = await generateVideo({
        prompt: motionPrompt,
        modelKey: effectiveModel,
        imageUploadIds: [uploadId],
        endImageUploadId: endUploadId,
        duration: duration ?? (info?.durations[0] || 5),
        aspectRatio: aspectRatio || "9:16",
        resolution,
        genre,
      });

      res.json({
        videoUrl,
        requestId,
        prompt: motionPrompt,
        modelKey: effectiveModel,
        modelDisplay: info?.displayName,
        creditsExact: info?.estimatedCredits,
        duration: duration ?? (info?.durations[0] || 5),
        framePair: Boolean(endUploadId),
      });
    } catch (e) {
      console.error("[higgsfield] animate-image error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  return router;
}
