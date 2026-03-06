import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { savedCaptions, calendarEntries } from "../../shared/schema.js";
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

    const { videoCode, prompt, conversationHistory } = req.body;
    if (!videoCode) {
      res.status(400).json({ error: "videoCode is required" });
      return;
    }

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

      const systemPrompt = buildCaptionSystemPrompt(brandVoice, hookText, {
        format: `${video.format} (${formatInfo?.name || ""})`,
        audience: audienceLabel,
        tags: video.tags,
      });

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      if (conversationHistory?.length > 0) {
        for (const msg of conversationHistory.slice(-10)) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      const userContent = prompt || `Generate captions for all platforms for this video.

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

  return router;
}
