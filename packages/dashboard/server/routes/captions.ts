import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { savedCaptions, calendarEntries, hashtagGroups, captionTemplates, performanceMetrics } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import { parseConfig } from "../parsers/config.js";
import { FORMATS } from "../../shared/types.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

function buildCaptionSystemPrompt(
  brandVoice: string,
  hookPatterns: string,
  videoContext: {
    format: string;
    audience: string;
    tags: string[];
  },
): string {
  return `You are a social media caption writer for a chiropractic practice's short-form video content.

BRAND VOICE:
${brandVoice}

HOOK PATTERNS LIBRARY (use patterns that match this format and audience):
${hookPatterns.slice(0, 2000)}

VIDEO FORMAT: ${videoContext.format}
TARGET AUDIENCE: ${videoContext.audience}
TAGS: ${videoContext.tags.join(", ")}

PLATFORM GUIDELINES:
- Instagram Reels: Hook in first line (before "...more"), 2-3 short paragraphs, 3-5 relevant hashtags at end, warm/educational tone, end with a question or CTA to drive comments
- TikTok: Ultra-short (1-2 lines max), punchy and casual, trending/viral language welcome, 2-3 hashtags mixed in, text-heavy overlays assumed so caption complements
- YouTube Shorts: Slightly longer, SEO-friendly keywords in first line, educational tone, include a CTA to subscribe/watch more, no hashtags (use description tags instead)
- YouTube Long: SEO-heavy title and description, timestamps if applicable, educational tone, CTA to subscribe, link to related content

CTA PATTERNS (match to video format):
- Formats B, C: "Save this for when you need it." (optimizes saves)
- Formats D, G: "Tag someone who needs to see this." (optimizes shares)
- Format D: "Drop a comment if this is you." (optimizes comments)
- Format A: "Follow for more." (optimizes follows)

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Match the brand voice: warm, educational, empowering, never clinical.
3. The caption should complement (not repeat) the video script.
4. Each platform caption should feel native to that platform.
5. Include relevant emojis sparingly (1-3 per caption, not excessive).
6. Match CTA style to the video format for maximum engagement.

RESPONSE FORMAT:
Return a JSON object with:
- "captions": array of objects with "platform" (one of: "Instagram", "TikTok", "YouTube Shorts", "YouTube Long") and "caption" (the text)
- "message": a brief conversational note (1 sentence)

Your entire response must be a single valid JSON object. No markdown code fences, no extra text.`;
}

export function createCaptionsRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const brandPath = path.join(industryDir, "brand.md");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const configPath = path.join(industryDir, "config.json");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[captions] ANTHROPIC_API_KEY not set.");
  }

  // GET /api/captions/counts - batch platform counts per video
  router.get("/counts", (_req, res) => {
    const rows = db
      .select({
        videoCode: savedCaptions.videoCode,
        platform: savedCaptions.platform,
      })
      .from(savedCaptions)
      .all();

    const counts: Record<string, number> = {};
    const seen: Record<string, Set<string>> = {};
    for (const row of rows) {
      if (!seen[row.videoCode]) seen[row.videoCode] = new Set();
      seen[row.videoCode].add(row.platform);
    }
    for (const [code, platforms] of Object.entries(seen)) {
      counts[code] = platforms.size;
    }
    res.json(counts);
  });

  // GET /api/captions/:videoCode - all captions for a video
  router.get("/:videoCode", (req, res) => {
    const rows = db
      .select()
      .from(savedCaptions)
      .where(eq(savedCaptions.videoCode, req.params.videoCode))
      .orderBy(savedCaptions.platform, savedCaptions.variant)
      .all();
    res.json({ captions: rows });
  });

  // POST /api/captions - save a caption
  router.post("/", (req, res) => {
    const { videoCode, platform, caption, variant, status } = req.body;
    if (!videoCode || !platform || !caption) {
      res.status(400).json({ error: "videoCode, platform, and caption are required" });
      return;
    }
    const result = db
      .insert(savedCaptions)
      .values({
        videoCode,
        platform,
        caption,
        variant: variant || 1,
        status: status || "draft",
      })
      .returning()
      .get();
    res.status(201).json(result);
  });

  // PUT /api/captions/:id - edit caption text
  router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { caption } = req.body;
    if (!caption) {
      res.status(400).json({ error: "caption is required" });
      return;
    }
    const result = db
      .update(savedCaptions)
      .set({ caption, updatedAt: new Date().toISOString() })
      .where(eq(savedCaptions.id, id))
      .returning()
      .get();
    if (!result) {
      res.status(404).json({ error: "Caption not found" });
      return;
    }
    res.json(result);
  });

  // DELETE /api/captions/:id
  router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.delete(savedCaptions).where(eq(savedCaptions.id, id)).run();
    res.json({ deleted: true });
  });

  // PUT /api/captions/:id/status - change draft/approved/posted
  router.put("/:id/status", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!["draft", "approved", "posted"].includes(status)) {
      res.status(400).json({ error: "status must be draft, approved, or posted" });
      return;
    }
    const result = db
      .update(savedCaptions)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(savedCaptions.id, id))
      .returning()
      .get();
    if (!result) {
      res.status(404).json({ error: "Caption not found" });
      return;
    }
    res.json(result);
  });

  // POST /api/captions/generate - AI caption generation with video context
  router.post("/generate", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    const { videoCode, prompt, conversationHistory, platforms: requestedPlatforms } = req.body;
    if (!videoCode) {
      res.status(400).json({ error: "videoCode is required" });
      return;
    }

    // Platform filter: generate only for specified platforms
    const platformMap: Record<string, string> = {
      instagram_reels: "Instagram",
      tiktok: "TikTok",
      youtube_shorts: "YouTube Shorts",
      youtube_long: "YouTube Long",
    };
    const allPlatformKeys = Object.keys(platformMap);
    const targetPlatformKeys: string[] = requestedPlatforms?.length
      ? (requestedPlatforms as string[]).filter((p: string) => allPlatformKeys.includes(p))
      : allPlatformKeys;
    const targetPlatformNames = targetPlatformKeys.map((k) => platformMap[k]);

    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === videoCode);
      if (!video) {
        res.status(404).json({ error: `Video ${videoCode} not found` });
        return;
      }

      const brandVoice = fs.existsSync(brandPath)
        ? fs.readFileSync(brandPath, "utf-8").slice(0, 1500)
        : "";

      const hookCategories = parseHookPatterns(hookPatternsPath);
      const hookText = hookCategories
        .map((c) => `${c.name}:\n${c.patterns.map((p) => `- ${p.pattern}: "${p.example}" (${p.platform}, optimizes ${p.optimizes})`).join("\n")}`)
        .join("\n\n");

      const config = fs.existsSync(configPath) ? parseConfig(configPath) : null;
      const audienceLabel = config?.audiences.find((a) => a.id === video.audience)?.label || video.audience;

      const formatInfo = FORMATS[video.format];

      // Metrics-informed: find top performers in same format
      let provenPatterns = "";
      try {
        const topMetrics = db
          .select()
          .from(performanceMetrics)
          .orderBy(desc(performanceMetrics.views))
          .limit(20)
          .all();

        if (topMetrics.length > 0) {
          // Get unique top video codes
          const topCodes = [...new Set(topMetrics.map((m) => m.videoCode))].slice(0, 5);
          const topCaptions = topCodes.flatMap((code) =>
            db.select().from(savedCaptions)
              .where(and(eq(savedCaptions.videoCode, code), eq(savedCaptions.status, "approved")))
              .all(),
          );
          if (topCaptions.length > 0) {
            const examples = topCaptions.slice(0, 5).map((c) => {
              const metrics = topMetrics.find((m) => m.videoCode === c.videoCode);
              return `[${c.platform}] (${metrics ? `${metrics.views} views, ${metrics.likes} likes` : "top performer"}):\n${c.caption.slice(0, 300)}`;
            });
            provenPatterns = `\n\nPROVEN CAPTION PATTERNS (from your top-performing videos):\n${examples.join("\n\n")}`;
          }
        }
      } catch {
        // Metrics lookup is optional
      }

      const systemPrompt = buildCaptionSystemPrompt(brandVoice, hookText, {
        format: `${video.format} (${formatInfo?.name || ""})`,
        audience: audienceLabel,
        tags: video.tags,
      }) + provenPatterns;

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      if (conversationHistory?.length > 0) {
        for (const msg of conversationHistory.slice(-10)) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      const platformInstruction = targetPlatformNames.length < 4
        ? `Generate captions ONLY for these platforms: ${targetPlatformNames.join(", ")}.`
        : "Generate captions for all platforms.";

      const userContent = prompt || `${platformInstruction}

Video: ${video.code} - ${video.title}
Format: ${formatInfo?.name || video.format} (${video.duration}s)
Script:
${video.script.slice(0, 1500)}`;

      messages.push({ role: "user", content: userContent });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text)) as {
        captions: Array<{ platform: string; caption: string }>;
        message: string;
      };

      // Auto-save generated captions
      const saved = [];
      for (const cap of parsed.captions) {
        // Map platform names to platform keys
        const platformKey = cap.platform
          .toLowerCase()
          .replace("instagram", "instagram_reels")
          .replace("tiktok", "tiktok")
          .replace("youtube shorts", "youtube_shorts")
          .replace("youtube long", "youtube_long");

        // Check if a caption already exists for this video+platform
        const existing = db
          .select()
          .from(savedCaptions)
          .where(
            and(
              eq(savedCaptions.videoCode, videoCode),
              eq(savedCaptions.platform, platformKey),
            ),
          )
          .all();

        const variant = existing.length + 1;

        const row = db
          .insert(savedCaptions)
          .values({
            videoCode,
            platform: platformKey,
            caption: cap.caption,
            variant,
            status: "draft",
          })
          .returning()
          .get();
        saved.push(row);
      }

      res.json({
        captions: parsed.captions,
        message: parsed.message,
        saved,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Caption generation failed";
      console.error("[captions] Generate error:", message);
      res.status(500).json({ error: message });
    }
  });

  // --- Hashtag Groups CRUD ---

  // GET /api/captions/hashtag-groups
  router.get("/hashtag-groups", (_req, res) => {
    const rows = db.select().from(hashtagGroups).orderBy(desc(hashtagGroups.createdAt)).all();
    res.json({ groups: rows });
  });

  // POST /api/captions/hashtag-groups
  router.post("/hashtag-groups", (req, res) => {
    const { name, hashtags, category } = req.body;
    if (!name || !hashtags) {
      res.status(400).json({ error: "name and hashtags are required" });
      return;
    }
    const row = db
      .insert(hashtagGroups)
      .values({ name, hashtags: JSON.stringify(hashtags), category: category || null })
      .returning()
      .get();
    res.status(201).json(row);
  });

  // DELETE /api/captions/hashtag-groups/:id
  router.delete("/hashtag-groups/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.delete(hashtagGroups).where(eq(hashtagGroups.id, id)).run();
    res.json({ deleted: true });
  });

  // POST /api/captions/suggest-hashtags - AI-suggested hashtags
  router.post("/suggest-hashtags", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable" });
      return;
    }
    const { videoCode, platform, caption } = req.body;
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === videoCode);
      const context = video
        ? `Topic: ${video.title}\nAudience: ${video.audience}\nTags: ${video.tags.join(", ")}`
        : "";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `Suggest 8-12 relevant hashtags for this ${platform || "Instagram"} post about chiropractic content.

${context}
${caption ? `Current caption: ${caption.slice(0, 500)}` : ""}

Return ONLY a JSON array of hashtag strings (including the # symbol). No other text.`,
        }],
      });
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") {
        res.status(500).json({ error: "No response" });
        return;
      }
      const tags = JSON.parse(stripCodeFences(text.text));
      res.json({ hashtags: tags });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed";
      res.status(500).json({ error: msg });
    }
  });

  // --- Caption Templates CRUD ---

  // GET /api/captions/templates
  router.get("/templates", (_req, res) => {
    const rows = db.select().from(captionTemplates).orderBy(desc(captionTemplates.usageCount)).all();
    res.json({ templates: rows });
  });

  // POST /api/captions/templates
  router.post("/templates", (req, res) => {
    const { name, platform, template, format } = req.body;
    if (!name || !template) {
      res.status(400).json({ error: "name and template are required" });
      return;
    }
    const row = db
      .insert(captionTemplates)
      .values({ name, platform: platform || null, template, format: format || null })
      .returning()
      .get();
    res.status(201).json(row);
  });

  // DELETE /api/captions/templates/:id
  router.delete("/templates/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.delete(captionTemplates).where(eq(captionTemplates.id, id)).run();
    res.json({ deleted: true });
  });

  // --- Bulk Status Update ---

  // PUT /api/captions/bulk-status
  router.put("/bulk-status", (req, res) => {
    const { videoCode, status } = req.body;
    if (!videoCode || !status || !["draft", "approved", "posted"].includes(status)) {
      res.status(400).json({ error: "videoCode and valid status required" });
      return;
    }
    const rows = db
      .update(savedCaptions)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(savedCaptions.videoCode, videoCode))
      .returning()
      .get();
    res.json({ updated: rows });
  });

  // --- Batch Generation ---

  // POST /api/captions/generate-batch
  router.post("/generate-batch", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable" });
      return;
    }
    const { videoCodes } = req.body;
    if (!Array.isArray(videoCodes) || videoCodes.length === 0) {
      res.status(400).json({ error: "videoCodes array required" });
      return;
    }

    const results: Array<{ videoCode: string; status: string; error?: string }> = [];
    const videos = parseContentLibrary(contentLibraryPath);

    const brandVoice = fs.existsSync(brandPath)
      ? fs.readFileSync(brandPath, "utf-8").slice(0, 1500)
      : "";
    const hookCategories = parseHookPatterns(hookPatternsPath);
    const hookText = hookCategories
      .map((c) => `${c.name}:\n${c.patterns.map((p) => `- ${p.pattern}: "${p.example}" (${p.platform}, optimizes ${p.optimizes})`).join("\n")}`)
      .join("\n\n");
    const config = fs.existsSync(configPath) ? parseConfig(configPath) : null;

    for (const videoCode of videoCodes) {
      try {
        const video = videos.find((v) => v.code === videoCode);
        if (!video) {
          results.push({ videoCode, status: "error", error: "Video not found" });
          continue;
        }

        const audienceLabel = config?.audiences.find((a) => a.id === video.audience)?.label || video.audience;
        const formatInfo = FORMATS[video.format];
        const systemPrompt = buildCaptionSystemPrompt(brandVoice, hookText, {
          format: `${video.format} (${formatInfo?.name || ""})`,
          audience: audienceLabel,
          tags: video.tags,
        });

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `Generate captions for all platforms for this video.\n\nVideo: ${video.code} - ${video.title}\nFormat: ${formatInfo?.name || video.format} (${video.duration}s)\nScript:\n${video.script.slice(0, 1500)}`,
          }],
        });

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          results.push({ videoCode, status: "error", error: "No AI response" });
          continue;
        }

        const parsed = JSON.parse(stripCodeFences(textBlock.text));
        const platformKeyMap: Record<string, string> = {
          instagram: "instagram_reels",
          tiktok: "tiktok",
          "youtube shorts": "youtube_shorts",
          "youtube long": "youtube_long",
        };

        for (const cap of parsed.captions) {
          const platformKey = platformKeyMap[cap.platform.toLowerCase()] || cap.platform.toLowerCase();
          const existing = db
            .select()
            .from(savedCaptions)
            .where(and(eq(savedCaptions.videoCode, videoCode), eq(savedCaptions.platform, platformKey)))
            .all();
          db.insert(savedCaptions)
            .values({ videoCode, platform: platformKey, caption: cap.caption, variant: existing.length + 1, status: "draft" })
            .run();
        }

        results.push({ videoCode, status: "success" });
      } catch (error) {
        results.push({ videoCode, status: "error", error: error instanceof Error ? error.message : "Failed" });
      }
    }

    res.json({ results });
  });

  // GET /api/captions/publish-kit/:videoCode - enriched publish data
  router.get("/publish-kit/:videoCode", (req, res) => {
    const videoCode = req.params.videoCode;

    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((v) => v.code === videoCode);
    if (!video) {
      res.status(404).json({ error: `Video ${videoCode} not found` });
      return;
    }

    const captions = db
      .select()
      .from(savedCaptions)
      .where(eq(savedCaptions.videoCode, videoCode))
      .orderBy(savedCaptions.platform, savedCaptions.variant)
      .all();

    const entries = db
      .select()
      .from(calendarEntries)
      .where(eq(calendarEntries.videoCode, videoCode))
      .orderBy(calendarEntries.date)
      .all();

    const allPlatforms = ["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"];
    const coveredPlatforms = new Set(captions.map((c) => c.platform));
    const missingPlatforms = allPlatforms.filter((p) => !coveredPlatforms.has(p));

    res.json({
      video: {
        code: video.code,
        title: video.title,
        format: video.format,
        scriptPreview: video.script.slice(0, 300),
        tags: video.tags,
        audience: video.audienceLabel,
      },
      captions,
      calendarEntries: entries,
      missingPlatforms,
      coveredCount: coveredPlatforms.size,
      totalPlatforms: allPlatforms.length,
    });
  });

  // POST /api/captions/virality-score - Score script before publishing
  router.post("/virality-score", async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY must be set" });
      return;
    }

    const { script, hook, platform, format, tags } = req.body as {
      script?: string;
      hook?: string;
      platform?: string;
      format?: string;
      tags?: string[];
    };

    if (!script) {
      res.status(400).json({ error: "script is required" });
      return;
    }

    try {
      const client = new Anthropic({ apiKey });

      // Get calibration data from our own performance metrics
      const metrics = db.select().from(performanceMetrics)
        .orderBy(desc(performanceMetrics.recordedAt))
        .limit(20)
        .all();

      const calibration = metrics.length > 0
        ? `\nCALIBRATION DATA (our published video performance):\n${metrics.slice(0, 10).map((m) => `- ${m.platform}: ${m.views} views, ${m.likes} likes, ${m.saves} saves`).join("\n")}\n`
        : "";

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Score this short-form video script for virality potential (0-99).

SCRIPT:
${script}
${hook ? `\nHOOK: "${hook}"` : ""}
${platform ? `TARGET PLATFORM: ${platform}` : ""}
${format ? `FORMAT: ${format}` : ""}
${tags?.length ? `TAGS: ${tags.join(", ")}` : ""}
${calibration}
Score on three dimensions (each 0-33):

1. HOOK STRENGTH (0-33): Does it open a curiosity loop? Zeigarnik effect? Pattern interrupt? Would someone stop scrolling?
2. FLOW (0-33): Does it follow a micro story arc? Mirror (relate) > Friction (tension) > Shift (insight) > Invitation (CTA)? Does pacing feel natural?
3. PLATFORM FIT (0-33): Is it native to the target platform? Right length, tone, visual format? Does it match what performs well there?

Respond with JSON only:
{
  "total": 78,
  "hook": 28,
  "flow": 25,
  "platformFit": 25,
  "suggestions": ["specific improvement 1", "specific improvement 2"]
}`,
        }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));
      res.json(parsed);
    } catch (error) {
      console.error("[captions] Virality score error:", error);
      res.status(500).json({ error: "Failed to score script" });
    }
  });

  return router;
}
