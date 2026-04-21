import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { db } from "../db.js";
import { videoStatus, contentWaterfall, performanceMetrics, scriptVersions, vaultHooks, thumbnailConcepts, savedCaptions } from "../../shared/schema.js";
import { parseContentLibrary, updateVideoScript, invalidateCache } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";
import { loadAllFormatTimings } from "../parsers/format-timing.js";
import { parseVibeMotion } from "../parsers/vibe-motion.js";
import { buildTimeline } from "../parsers/timeline-builder.js";
import { parseProductionPlans } from "../parsers/production-plans.js";
import path from "path";
import type { VideoSummary, ProductionStatus, ProductionStyle, FormatId } from "../../shared/types.js";
import { PRODUCTION_STYLES } from "../../shared/types.js";

export function createVideosRouter(
  contentLibraryPath: string,
  configPath: string,
  formatsDir: string,
) {
  const router = Router();

  // GET /api/videos - list all videos with optional filters
  router.get("/", (_req, res) => {
    const { audience, format, status, search, style } = _req.query;

    let videos = parseContentLibrary(contentLibraryPath);

    // Get all status records
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(
      statusRecords.map((s) => [s.videoCode, s]),
    );

    // Build summaries
    let summaries: VideoSummary[] = videos.map((v) => {
      const statusRecord = statusMap.get(v.code);
      return {
        code: v.code,
        title: v.title,
        format: v.format,
        formatName: v.formatName,
        duration: v.duration,
        audience: v.audience,
        audienceLabel: v.audienceLabel,
        tags: v.tags,
        status: (statusRecord?.currentStatus as ProductionStatus) || "SCRIPTED",
        productionStyle: (statusRecord?.productionStyle as ProductionStyle) || null,
        scriptPreview:
          v.script.split("\n").find((l) => l.trim() && !l.startsWith("["))?.slice(0, 120) || "",
        remotionGraphicsRequired: Boolean(v.vibeMotion),
        remotionGraphicsNotes: v.vibeMotion,
      };
    });

    // Apply filters
    if (audience && typeof audience === "string") {
      summaries = summaries.filter((v) => v.audience === audience);
    }
    if (format && typeof format === "string") {
      summaries = summaries.filter((v) => v.format === format);
    }
    if (status && typeof status === "string") {
      summaries = summaries.filter((v) => v.status === status);
    }
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      summaries = summaries.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)) ||
          v.scriptPreview.toLowerCase().includes(q),
      );
    }
    if (style && typeof style === "string") {
      if (style === "none") {
        summaries = summaries.filter((v) => !v.productionStyle);
      } else {
        summaries = summaries.filter((v) => v.productionStyle === style);
      }
    }

    res.json(summaries);
  });

  // GET /api/videos/:code - full video detail
  router.get("/:code", (req, res) => {
    const { code } = req.params;
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find(
      (v) => v.code.toLowerCase() === code.toLowerCase(),
    );

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const statusRecord = db
      .select()
      .from(videoStatus)
      .where(eq(videoStatus.videoCode, video.code))
      .get();

    res.json({
      ...video,
      status: (statusRecord?.currentStatus as ProductionStatus) || "SCRIPTED",
      productionStyle: (statusRecord?.productionStyle as ProductionStyle) || null,
      statusUpdatedAt: statusRecord?.statusUpdatedAt || null,
      notes: statusRecord?.notes || null,
      remotionGraphicsRequired: Boolean(video.vibeMotion),
      remotionGraphicsNotes: video.vibeMotion,
    });
  });

  // GET /api/videos/:code/timeline - unified timeline
  router.get("/:code/timeline", (req, res) => {
    const { code: videoCode } = req.params;
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find(
      (v) => v.code.toLowerCase() === videoCode.toLowerCase(),
    );

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const formatTimings = loadAllFormatTimings(formatsDir);
    const formatTiming = formatTimings.get(video.format);

    if (!formatTiming) {
      res.status(404).json({ error: `No timing data for format ${video.format}` });
      return;
    }

    const components = parseVibeMotion(video.vibeMotion ?? "", video);
    const items = buildTimeline(video, components, formatTiming);

    res.json({
      items,
      formatTiming,
      totalDuration: video.duration,
    });
  });

  // GET /api/config - industry config
  router.get("/config/industry", (_req, res) => {
    const config = parseConfig(configPath);
    res.json(config);
  });

  // GET /api/videos/:code/production-plan - Get production plan if available
  router.get("/:code/production-plan", (req, res) => {
    const { code } = req.params;
    const productionPlansDir = path.join(path.dirname(contentLibraryPath), "production-plans");
    const plans = parseProductionPlans(productionPlansDir);
    const plan = plans.get(code);

    if (plan) {
      res.json({ available: true, plan });
    } else {
      res.json({ available: false, plan: null });
    }
  });

  // GET /api/videos/:code/waterfall - List waterfall derivatives
  router.get("/:code/waterfall", (req, res) => {
    try {
      const items = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, req.params.code))
        .orderBy(desc(contentWaterfall.createdAt))
        .all();
      res.json({ items });
    } catch (error) {
      console.error("[videos] Waterfall error:", error);
      res.status(500).json({ error: "Failed to list waterfall items" });
    }
  });

  // POST /api/videos/:code/waterfall - Add waterfall derivative
  router.post("/:code/waterfall", (req, res) => {
    try {
      const { tier, platform, description, status } = req.body;
      if (!tier) {
        res.status(400).json({ error: "tier is required" });
        return;
      }
      const result = db.insert(contentWaterfall).values({
        sourceVideoCode: req.params.code,
        tier,
        platform: platform || null,
        description: description || null,
        status: status || "idea",
      }).returning().get();
      res.json({ item: result });
    } catch (error) {
      console.error("[videos] Waterfall add error:", error);
      res.status(500).json({ error: "Failed to add waterfall item" });
    }
  });

  // PUT /api/videos/:code/waterfall/:id - Update waterfall item
  router.put("/:code/waterfall/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, performanceNote, description } = req.body;
      const updates: Record<string, string> = {};
      if (status) updates.status = status;
      if (performanceNote !== undefined) updates.performanceNote = performanceNote;
      if (description !== undefined) updates.description = description;

      db.update(contentWaterfall)
        .set(updates)
        .where(eq(contentWaterfall.id, id))
        .run();
      res.json({ updated: true });
    } catch (error) {
      console.error("[videos] Waterfall update error:", error);
      res.status(500).json({ error: "Failed to update waterfall item" });
    }
  });

  // DELETE /api/videos/:code/waterfall/:id - Remove waterfall item
  router.delete("/:code/waterfall/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      db.delete(contentWaterfall).where(eq(contentWaterfall.id, id)).run();
      res.json({ deleted: true });
    } catch (error) {
      console.error("[videos] Waterfall delete error:", error);
      res.status(500).json({ error: "Failed to delete waterfall item" });
    }
  });

  // POST /api/videos/:code/waterfall/auto-generate - Matt Gray system: 1 video → 10 derivatives
  router.post("/:code/waterfall/auto-generate", async (req, res) => {
    const { code } = req.params;
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const scriptExcerpt = video.script?.slice(0, 400) ?? video.title;
      const format = video.format ?? "A";

      // Matt Gray formula: deterministic 10-item template
      const TEMPLATE: Array<{ tier: "short" | "text" | "carousel"; platform: string; role: string; platformVoice: string }> = [
        { tier: "short", platform: "instagram", role: "Hook cut — first 5s hook moment (15–30s)", platformVoice: "Fast, visual, hook in frame 1" },
        { tier: "short", platform: "instagram", role: "Value cut — core educational moment (20–30s)", platformVoice: "Educational, save-worthy, text overlays help" },
        { tier: "short", platform: "instagram", role: "CTA cut — closing + call to action (15–20s)", platformVoice: "Warm, direct, clear next step" },
        { tier: "short", platform: "tiktok", role: "Hook cut — punchy opener for TikTok (15–30s)", platformVoice: "Entertaining, curiosity-first, trending audio friendly" },
        { tier: "short", platform: "tiktok", role: "Value cut — most shareable insight (20–30s)", platformVoice: "Surprising fact or counterintuitive claim works best" },
        { tier: "short", platform: "youtube_shorts", role: "Hook cut — strong open, retention-optimised (30–45s)", platformVoice: "Slightly longer, more educational than TikTok" },
        { tier: "short", platform: "youtube_shorts", role: "Value cut — standalone educational clip (30–60s)", platformVoice: "Can be slower-paced, subscribe CTA at end" },
        { tier: "text", platform: "x", role: "X thread — 7-tweet breakdown of the core concept", platformVoice: "Tweet 1 is the hook, tweets 2-6 are numbered insights, tweet 7 is CTA" },
        { tier: "text", platform: "linkedin", role: "LinkedIn post — single insight with personal angle", platformVoice: "Professional, story-led, 3-5 short paragraphs, no hashtag spam" },
        { tier: "text", platform: "instagram", role: "IG caption — scroll-stopping caption for grid post", platformVoice: "First line is hook, body is value, end with question for comments" },
        { tier: "carousel", platform: "instagram", role: "IG Carousel — 7-slide educational breakdown", platformVoice: "Slide 1: bold hook/cover. Slides 2-6: one insight per slide, max 15 words each. Slide 7: CTA + save prompt." },
        { tier: "carousel", platform: "linkedin", role: "LinkedIn Carousel — 6-slide professional insight post", platformVoice: "Slide 1: bold claim. Slides 2-5: one evidence point or step per slide. Slide 6: key takeaway + follow CTA." },
      ];

      // Load existing waterfall to skip duplicates (same tier + platform)
      const existing = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, code))
        .all();
      const existingKeys = new Set(existing.map((e) => `${e.tier}::${e.platform}`));

      const toCreate = TEMPLATE.filter((t) => !existingKeys.has(`${t.tier}::${t.platform}`));

      if (toCreate.length === 0) {
        res.json({ created: 0, skipped: TEMPLATE.length, items: existing });
        return;
      }

      // Use Claude Haiku to write platform-specific descriptions in parallel
      const anthropic = new Anthropic();

      const descriptions = await Promise.all(
        toCreate.map(async (t) => {
          try {
            const isCarousel = t.tier === "carousel";
            const slideCount = t.platform === "instagram" ? 7 : 6;
            const promptContent = isCarousel
              ? `Video: "${video.title}" (chiropractic health content)\nScript excerpt: "${scriptExcerpt}"\n\nWrite a ${slideCount}-slide ${t.platform} carousel outline based on this video.\nFormat exactly as: "Slide 1: [text]. Slide 2: [text]. Slide 3: [text]..." — max 12 words per slide, no bullet points.\n${t.platformVoice}\nRespond with only the slide outline, no preamble.`
              : `Video: "${video.title}" (Format ${format} — chiropractic health content)\nDerivative: ${t.role}\nPlatform voice: ${t.platformVoice}\nScript excerpt: "${scriptExcerpt}"\n\nWrite a single specific sentence describing exactly what to clip or write for this derivative. Be concrete — mention the moment, angle, or content approach. No preamble.`;
            const msg = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: isCarousel ? 300 : 120,
              messages: [{ role: "user", content: promptContent }],
            });
            return (msg.content[0] as { text: string }).text.trim();
          } catch {
            return t.role;
          }
        })
      );

      // Insert all new items
      const inserted = toCreate.map((t, i) =>
        db.insert(contentWaterfall).values({
          sourceVideoCode: code,
          tier: t.tier,
          platform: t.platform,
          description: descriptions[i],
          status: "idea",
        }).returning().get()
      );

      const allItems = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, code))
        .orderBy(desc(contentWaterfall.createdAt))
        .all();

      res.json({ created: inserted.length, skipped: TEMPLATE.length - toCreate.length, items: allItems });
    } catch (error) {
      console.error("[videos] Waterfall auto-generate error:", error);
      res.status(500).json({ error: "Failed to auto-generate waterfall" });
    }
  });

  // POST /api/videos/:code/adapt-script - Rewrite script for a specific platform
  router.post("/:code/adapt-script", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { code } = req.params;
      const { platform } = req.body as { platform: string };
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const platformSpecs: Record<string, string> = {
        tiktok: "TikTok: 6-15 seconds max. Hook MUST land in first 0.5 seconds. Text-heavy overlay style. Fast pace. End with a loop-friendly transition or strong CTA. Use trending patterns.",
        instagram_reels: "Instagram Reels: 15-30 seconds. Visual hook in first 1-2 seconds. Slower cuts outperform rapid cuts. Optimize for saves and shares. Clean, polished feel.",
        youtube_shorts: "YouTube Shorts: Up to 60 seconds. Slightly more educational depth allowed. Hook in first 2 seconds. Clear value proposition. End with subscribe CTA.",
        youtube_long: "YouTube Long-form: 3-5 minutes. Expand the core message with deeper explanation, examples, and B-roll cues in brackets. Include [B-ROLL: description] markers. Pattern: you speaking > graphic > B-roll > back to you. Add chapter markers with timestamps.",
      };

      const spec = platformSpecs[platform] || "General short-form: 15-60 seconds.";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Rewrite this video script optimized for the target platform. Keep the core message but restructure for the platform's format and audience behavior.

ORIGINAL SCRIPT (Format ${video.format}):
${video.script}

TARGET PLATFORM REQUIREMENTS:
${spec}

Rules:
- Keep delivery cues in [brackets]
- No emdashes
- Maintain the educational value
- Adapt pacing, length, and structure for the platform
- If expanding (YouTube Long), add [B-ROLL: description] markers

Return ONLY the adapted script text, no JSON, no explanation.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      res.json({ script: textBlock.text.trim(), platform });
    } catch (error) {
      console.error("[videos] Script adaptation error:", error);
      res.status(500).json({ error: "Failed to adapt script" });
    }
  });

  // POST /api/videos/:code/repurpose-suggestions - AI suggests derivative content
  router.post("/:code/repurpose-suggestions", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { code } = req.params;
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const scriptPreview = video.script
        ? video.script.split("\n").slice(0, 15).join("\n")
        : "No script available";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: `Generate repurposing suggestions for this video. Each suggestion should include actual content, not just "make a shorter version."

VIDEO: ${code} - "${video.title}"
FORMAT: ${video.format} (${video.formatName || ""})
AUDIENCE: ${video.audienceLabel}
TAGS: ${video.tags.join(", ")}
SCRIPT:
${scriptPreview}

Generate 5-7 derivative content suggestions across these tiers:
- cutdown: Shorter video versions (15s, 30s, 60s)
- short: Platform-specific micro-content
- text: Written posts (X threads, LinkedIn posts, carousel scripts)

For each suggestion, include the actual draft content or outline.

Respond with JSON only, no emdashes:
{
  "suggestions": [
    {
      "tier": "cutdown|short|text",
      "platform": "TikTok|Instagram|YouTube Shorts|X/Twitter|LinkedIn",
      "description": "Brief label for this derivative",
      "content": "The actual draft content, script outline, or post text (2-4 sentences)"
    }
  ]
}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(cleaned);
      res.json(parsed);
    } catch (error) {
      console.error("[videos] Repurpose suggestions error:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // POST /api/videos/:code/virality-score - AI-powered pre-publish score
  router.post("/:code/virality-score", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { code } = req.params;
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      // Gather context for scoring
      const allMetrics = db.select().from(performanceMetrics).all();

      // Format-level performance benchmarks
      const formatMetrics = allMetrics.filter((m) => {
        const v = videos.find((vv) => vv.code === m.videoCode);
        return v && v.format === video.format;
      });
      const formatAvgViews = formatMetrics.length > 0
        ? Math.round(formatMetrics.reduce((s, m) => s + (m.views ?? 0), 0) / formatMetrics.length)
        : null;

      // Hook used (if any)
      const latestScript = db.select().from(scriptVersions)
        .all()
        .filter((s) => s.videoCode === code)
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
      let hookInfo = "";
      if (latestScript?.hookId) {
        const hook = db.select().from(vaultHooks).all().find((h) => h.id === latestScript.hookId);
        if (hook) hookInfo = `Hook pattern used: "${hook.pattern}" (category: ${hook.category}, optimizes: ${hook.optimizes || "unknown"})`;
      }

      // Script preview
      const scriptPreview = video.script
        ? video.script.split("\n").slice(0, 8).join("\n")
        : "No script available";

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Score this video's virality potential (0-100) based on the following data. Be realistic and specific.

VIDEO: ${code} - "${video.title}"
FORMAT: ${video.format} (${video.formatName || ""})
AUDIENCE: ${video.audienceLabel}
TAGS: ${video.tags.join(", ")}
SCRIPT PREVIEW:
${scriptPreview}

${hookInfo}

BENCHMARK DATA:
- Format ${video.format} average views: ${formatAvgViews !== null ? formatAvgViews : "No data yet"}
- Total published videos with metrics: ${allMetrics.length}

Score on these 5 dimensions (each 0-20):
1. HOOK STRENGTH: Is the opening attention-grabbing? Does it create curiosity?
2. TOPIC RELEVANCE: Is this topic trending or evergreen? Would people search for this?
3. FORMAT FIT: Does the format match the content type well?
4. SHAREABILITY: Would viewers share this? Does it provide value worth spreading?
5. PLATFORM POTENTIAL: How well does this content work for short-form platforms?

Respond with JSON only:
{
  "score": <total 0-100>,
  "dimensions": {
    "hookStrength": { "score": <0-20>, "note": "<1 sentence>" },
    "topicRelevance": { "score": <0-20>, "note": "<1 sentence>" },
    "formatFit": { "score": <0-20>, "note": "<1 sentence>" },
    "shareability": { "score": <0-20>, "note": "<1 sentence>" },
    "platformPotential": { "score": <0-20>, "note": "<1 sentence>" }
  },
  "suggestion": "<1-2 sentences on the single biggest improvement to boost virality>"
}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(cleaned);
      res.json(parsed);
    } catch (error) {
      console.error("[videos] Virality score error:", error);
      res.status(500).json({ error: "Failed to generate virality score" });
    }
  });

  // POST /api/videos/:code/thumbnail-concepts - AI generates thumbnail concepts
  router.post("/:code/thumbnail-concepts", async (req, res) => {
    const { code } = req.params;
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) { res.status(404).json({ error: "Video not found" }); return; }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.status(400).json({ error: "ANTHROPIC_API_KEY not set" }); return; }

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Generate 3 thumbnail concepts for this video. Each concept should drive clicks.

Video: "${video.title}"
Format: ${video.formatName}
Script hook: ${video.script.split("\n").find((l) => l.trim())?.slice(0, 150)}

Return JSON array of 3 objects with these fields:
- textOverlay: short text for the thumbnail (2-5 words, provocative/curious)
- expression: facial expression or pose direction
- background: background suggestion
- colorScheme: 2-3 colors that pop
- style: overall thumbnail aesthetic (e.g. "clean minimal", "bold contrast", "cinematic")

Return ONLY the JSON array, no markdown.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") { res.status(500).json({ error: "No AI response" }); return; }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      const concepts = JSON.parse(cleaned) as Array<{ textOverlay: string; expression: string; background: string; colorScheme: string; style: string }>;

      // Clear old concepts and save new ones
      const existing = db.select().from(thumbnailConcepts).all().filter((t) => t.videoCode === code);
      for (const e of existing) {
        db.delete(thumbnailConcepts).where(eq(thumbnailConcepts.id, e.id)).run();
      }

      for (const c of concepts) {
        db.insert(thumbnailConcepts).values({
          videoCode: code,
          textOverlay: c.textOverlay,
          expression: c.expression || null,
          background: c.background || null,
          colorScheme: c.colorScheme || null,
          style: c.style || null,
        }).run();
      }

      res.json({ concepts });
    } catch (error) {
      console.error("[videos] Thumbnail concepts error:", error);
      res.status(500).json({ error: "Failed to generate thumbnail concepts" });
    }
  });

  // GET /api/videos/:code/thumbnail-concepts - Get saved thumbnail concepts
  router.get("/:code/thumbnail-concepts", (req, res) => {
    const { code } = req.params;
    const concepts = db.select().from(thumbnailConcepts).all().filter((t) => t.videoCode === code);
    res.json({ concepts });
  });

  // POST /api/videos/:code/consistency-check - Voice/style consistency check
  router.post("/:code/consistency-check", async (req, res) => {
    const { code } = req.params;
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) { res.status(404).json({ error: "Video not found" }); return; }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.status(400).json({ error: "ANTHROPIC_API_KEY not set" }); return; }

      // Load brand guide if available
      const brandPath = path.join(path.dirname(contentLibraryPath), "brand.md");
      let brandGuide = "";
      try { brandGuide = fs.readFileSync(brandPath, "utf-8").slice(0, 2000); } catch { /* no brand file */ }

      // Find other scripts in same audience for comparison
      const sameAudience = videos.filter((v) => v.audience === video.audience && v.code !== code).slice(0, 3);
      const comparisons = sameAudience.map((v) => v.script.slice(0, 200)).join("\n---\n");

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Check this script for voice/style consistency.

Script to check:
${video.script.slice(0, 1500)}

${brandGuide ? `Brand guidelines:\n${brandGuide.slice(0, 800)}` : ""}

${comparisons ? `Other scripts in same audience category for comparison:\n${comparisons}` : ""}

Rate these dimensions 1-10 and give brief feedback:
1. voiceConsistency: Does it match brand voice guidelines?
2. hookStrength: Is the hook compelling? (avg top performers use 8 words or fewer)
3. toneMatch: Does it match the tone of other scripts in this audience?
4. structureQuality: Does it follow the format structure well?
5. deliveryCues: Are delivery cues clear and helpful?

Return JSON: { "scores": { "voiceConsistency": N, "hookStrength": N, "toneMatch": N, "structureQuality": N, "deliveryCues": N }, "overallScore": N, "issues": ["issue1", ...], "strengths": ["strength1", ...] }
Return ONLY JSON, no markdown.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") { res.status(500).json({ error: "No AI response" }); return; }
      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error("[videos] Consistency check error:", error);
      res.status(500).json({ error: "Failed to run consistency check" });
    }
  });

  // ==========================================
  // Production Style
  // ==========================================

  // PUT /api/videos/:code/production-style - Set production style
  router.put("/:code/production-style", (req, res) => {
    const code = req.params.code.toUpperCase();
    const { style } = req.body as { style: ProductionStyle };

    if (!PRODUCTION_STYLES.includes(style)) {
      res.status(400).json({ error: `Invalid production style. Must be one of: ${PRODUCTION_STYLES.join(", ")}` });
      return;
    }

    const now = new Date().toISOString();
    const record = db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get();

    if (record) {
      db.update(videoStatus)
        .set({ productionStyle: style, updatedAt: now })
        .where(eq(videoStatus.videoCode, code))
        .run();
    } else {
      db.insert(videoStatus)
        .values({ videoCode: code, currentStatus: "SCRIPTED", productionStyle: style })
        .run();
    }

    res.json({ code, productionStyle: style });
  });

  // PUT /api/videos/bulk-production-style - Bulk assign production style
  router.put("/bulk-production-style", (req, res) => {
    const { codes, style } = req.body as { codes: string[]; style: ProductionStyle };

    if (!Array.isArray(codes) || codes.length === 0) {
      res.status(400).json({ error: "codes array is required" });
      return;
    }
    if (!PRODUCTION_STYLES.includes(style)) {
      res.status(400).json({ error: `Invalid production style. Must be one of: ${PRODUCTION_STYLES.join(", ")}` });
      return;
    }

    const now = new Date().toISOString();
    let updated = 0;

    for (const rawCode of codes) {
      const code = rawCode.toUpperCase();
      const record = db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get();

      if (record) {
        db.update(videoStatus)
          .set({ productionStyle: style, updatedAt: now })
          .where(eq(videoStatus.videoCode, code))
          .run();
      } else {
        db.insert(videoStatus)
          .values({ videoCode: code, currentStatus: "SCRIPTED", productionStyle: style })
          .run();
      }
      updated++;
    }

    res.json({ updated, style });
  });

  // ==========================================
  // Assembly Checklist (4.5)
  // ==========================================

  const ASSEMBLY_ITEMS = [
    "voiceover_synced",
    "graphics_overlaid",
    "captions_added",
    "music_sfx_added",
    "color_graded",
    "exported",
  ];

  // GET /api/videos/:code/assembly-checklist
  router.get("/:code/assembly-checklist", (req, res) => {
    const code = req.params.code.toUpperCase();
    const record = db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get();
    const raw = (record as Record<string, unknown>)?.assembly_checklist;
    const checklist: Record<string, boolean> = raw ? JSON.parse(raw as string) : {};

    const items = ASSEMBLY_ITEMS.map((key) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      completed: checklist[key] ?? false,
    }));

    const completedCount = items.filter((i) => i.completed).length;

    res.json({ items, completedCount, totalCount: items.length, allComplete: completedCount === items.length });
  });

  // PUT /api/videos/:code/assembly-checklist - Toggle item
  router.put("/:code/assembly-checklist", (req, res) => {
    const code = req.params.code.toUpperCase();
    const { key, completed } = req.body as { key: string; completed: boolean };

    if (!key || !ASSEMBLY_ITEMS.includes(key)) {
      res.status(400).json({ error: "Invalid checklist key" });
      return;
    }

    const record = db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get();
    const raw = (record as Record<string, unknown>)?.assembly_checklist;
    const checklist: Record<string, boolean> = raw ? JSON.parse(raw as string) : {};
    checklist[key] = completed;

    if (record) {
      db.update(videoStatus)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(videoStatus.videoCode, code))
        .run();
      // Direct SQL for the TEXT column not in Drizzle schema
      const sqlite = db as unknown as { $client: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } };
      sqlite.$client.prepare("UPDATE video_status SET assembly_checklist = ? WHERE video_code = ?").run(JSON.stringify(checklist), code);
    }

    const items = ASSEMBLY_ITEMS.map((k) => ({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      completed: checklist[k] ?? false,
    }));

    const completedCount = items.filter((i) => i.completed).length;
    res.json({ items, completedCount, totalCount: items.length, allComplete: completedCount === items.length });
  });

  // ── Phase 1: Script Editor API ──────────────────────────────────────

  // PUT /api/videos/:code/script - Update script in content-library.md + create version
  router.put("/:code/script", (req, res) => {
    try {
      const { code } = req.params;
      const { script, changeNote } = req.body as { script: string; changeNote?: string };

      if (!script || typeof script !== "string") {
        res.status(400).json({ error: "Missing script field" });
        return;
      }

      // Verify video exists
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      // Write to content-library.md
      const success = updateVideoScript(contentLibraryPath, code, script);
      if (!success) {
        res.status(500).json({ error: "Failed to update script in content-library.md" });
        return;
      }

      // Get current max version for this video
      const existing = db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.videoCode, code))
        .all();
      const maxVersion = existing.reduce((max, v) => Math.max(max, v.version ?? 0), 0);
      const newVersion = maxVersion + 1;

      // Create script version record
      db.insert(scriptVersions).values({
        videoCode: code,
        ideaTopic: video.title,
        version: newVersion,
        script,
        changeNote: changeNote || `Manual edit v${newVersion}`,
      }).run();

      res.json({ success: true, version: newVersion });
    } catch (error) {
      console.error("[videos] PUT /:code/script error:", error);
      res.status(500).json({ error: "Failed to save script" });
    }
  });

  // GET /api/videos/:code/script-versions - List all versions for a video
  router.get("/:code/script-versions", (req, res) => {
    try {
      const { code } = req.params;
      const versions = db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.videoCode, code))
        .orderBy(desc(scriptVersions.version))
        .all();

      res.json({ versions });
    } catch (error) {
      console.error("[videos] GET /:code/script-versions error:", error);
      res.status(500).json({ error: "Failed to fetch script versions" });
    }
  });

  // POST /api/videos/:code/refine-script - AI refinement (returns suggestion, doesn't persist)
  router.post("/:code/refine-script", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { code } = req.params;
      const { currentScript, instruction } = req.body as { currentScript: string; instruction: string };

      if (!currentScript || !instruction) {
        res.status(400).json({ error: "Missing currentScript or instruction" });
        return;
      }

      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      // Load brand voice
      const brandPath = path.resolve(contentLibraryPath, "../../brand.md");
      let brandVoice = "";
      try { brandVoice = fs.readFileSync(brandPath, "utf-8"); } catch { /* no brand file */ }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are refining a video script for a chiropractic practice. Apply the user's instruction while preserving the script's format, delivery cues, and educational value.

BRAND VOICE (follow this):
${brandVoice.slice(0, 1500)}

CURRENT SCRIPT (Format ${video.format} - ${video.formatName}, ${video.duration}s):
${currentScript}

USER INSTRUCTION: "${instruction}"

Rules:
- Keep delivery cues in [brackets] (e.g., [Warm, empathetic])
- No emdashes. Use commas, periods, or restructure.
- Maintain the educational core message
- Match the target duration (~${video.duration}s when spoken)
- Patient-facing tone: warm, educational, empowering

Return the refined script text only. No explanation, no JSON wrapper.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      res.json({ script: textBlock.text.trim(), instruction });
    } catch (error) {
      console.error("[videos] POST /:code/refine-script error:", error);
      res.status(500).json({ error: "Failed to refine script" });
    }
  });

  // ============================================
  // Repurpose Everywhere — one-click orchestration
  // Chains: auto-generate waterfall → generate captions for all platforms
  // ============================================
  router.post("/:code/repurpose-everywhere", async (req, res) => {
    const { code } = req.params;
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === code);
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const anthropic = new Anthropic();
      const scriptExcerpt = video.script?.slice(0, 400) ?? video.title;
      const format = video.format ?? "A";

      // ── Step 1: Auto-generate waterfall items (skip existing) ──────────
      const TEMPLATE: Array<{ tier: "short" | "text" | "carousel"; platform: string; role: string; platformVoice: string }> = [
        { tier: "short", platform: "instagram", role: "Hook cut — first 5s hook moment (15-30s)", platformVoice: "Fast, visual, hook in frame 1" },
        { tier: "short", platform: "instagram", role: "Value cut — core educational moment (20-30s)", platformVoice: "Educational, save-worthy, text overlays help" },
        { tier: "short", platform: "instagram", role: "CTA cut — closing + call to action (15-20s)", platformVoice: "Warm, direct, clear next step" },
        { tier: "short", platform: "tiktok", role: "Hook cut — punchy opener for TikTok (15-30s)", platformVoice: "Entertaining, curiosity-first, trending audio friendly" },
        { tier: "short", platform: "tiktok", role: "Value cut — most shareable insight (20-30s)", platformVoice: "Surprising fact or counterintuitive claim works best" },
        { tier: "short", platform: "youtube_shorts", role: "Hook cut — strong open, retention-optimised (30-45s)", platformVoice: "Slightly longer, more educational than TikTok" },
        { tier: "short", platform: "youtube_shorts", role: "Value cut — standalone educational clip (30-60s)", platformVoice: "Can be slower-paced, subscribe CTA at end" },
        { tier: "text", platform: "x", role: "X thread — 7-tweet breakdown of the core concept", platformVoice: "Tweet 1 is the hook, tweets 2-6 are numbered insights, tweet 7 is CTA" },
        { tier: "text", platform: "linkedin", role: "LinkedIn post — single insight with personal angle", platformVoice: "Professional, story-led, 3-5 short paragraphs, no hashtag spam" },
        { tier: "text", platform: "instagram", role: "IG caption — scroll-stopping caption for grid post", platformVoice: "First line is hook, body is value, end with question for comments" },
        { tier: "carousel", platform: "instagram", role: "IG Carousel — 7-slide educational breakdown", platformVoice: "Slide 1: bold hook/cover. Slides 2-6: one insight per slide, max 15 words each. Slide 7: CTA + save prompt." },
        { tier: "carousel", platform: "linkedin", role: "LinkedIn Carousel — 6-slide professional insight post", platformVoice: "Slide 1: bold claim. Slides 2-5: one evidence point or step per slide. Slide 6: key takeaway + follow CTA." },
      ];

      const existing = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, code))
        .all();
      const existingKeys = new Set(existing.map((e) => `${e.tier}::${e.platform}`));
      const toCreate = TEMPLATE.filter((t) => !existingKeys.has(`${t.tier}::${t.platform}`));

      let waterfallCreated = 0;
      if (toCreate.length > 0) {
        const descriptions = await Promise.all(
          toCreate.map(async (t) => {
            try {
              const isCarousel = t.tier === "carousel";
              const slideCount = t.platform === "instagram" ? 7 : 6;
              const promptContent = isCarousel
                ? `Video: "${video.title}" (chiropractic health content)\nScript excerpt: "${scriptExcerpt}"\n\nWrite a ${slideCount}-slide ${t.platform} carousel outline based on this video.\nFormat exactly as: "Slide 1: [text]. Slide 2: [text]. Slide 3: [text]..." — max 12 words per slide, no bullet points.\n${t.platformVoice}\nRespond with only the slide outline, no preamble.`
                : `Video: "${video.title}" (Format ${format} — chiropractic health content)\nDerivative: ${t.role}\nPlatform voice: ${t.platformVoice}\nScript excerpt: "${scriptExcerpt}"\n\nWrite a single specific sentence describing exactly what to clip or write for this derivative. Be concrete — mention the moment, angle, or content approach. No preamble.`;
              const msg = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: isCarousel ? 300 : 120,
                messages: [{ role: "user", content: promptContent }],
              });
              return (msg.content[0] as { text: string }).text.trim();
            } catch {
              return t.role;
            }
          })
        );

        for (let i = 0; i < toCreate.length; i++) {
          db.insert(contentWaterfall).values({
            sourceVideoCode: code,
            tier: toCreate[i].tier,
            platform: toCreate[i].platform,
            description: descriptions[i],
            status: "idea",
          }).run();
        }
        waterfallCreated = toCreate.length;
      }

      // ── Step 2: Generate captions for all 4 video platforms ────────────
      const captionPlatforms = ["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"];
      const captionPlatformNames: Record<string, string> = {
        instagram_reels: "Instagram Reels",
        tiktok: "TikTok",
        youtube_shorts: "YouTube Shorts",
        youtube_long: "YouTube Long",
      };

      // Check which platforms already have captions
      const existingCaptions = db.select().from(savedCaptions)
        .where(eq(savedCaptions.videoCode, code))
        .all();
      const captionedPlatforms = new Set(existingCaptions.map((c) => c.platform));
      const missingPlatforms = captionPlatforms.filter((p) => !captionedPlatforms.has(p));

      let captionsGenerated = 0;
      if (missingPlatforms.length > 0) {
        const brandSnippet = (() => {
          try {
            const brandPath = path.join(path.dirname(contentLibraryPath), "brand.md");
            return fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 1200) : "";
          } catch { return ""; }
        })();

        const targetNames = missingPlatforms.map((p) => captionPlatformNames[p]);
        const captionPrompt = `You are a social media caption writer for a chiropractic practice.

Video: "${video.title}" (Format ${format})
Audience: ${video.audience || "general"}
Script: "${scriptExcerpt}"
${brandSnippet ? `\nBrand voice:\n${brandSnippet.slice(0, 600)}` : ""}

Generate 1 caption per platform: ${targetNames.join(", ")}.

Rules:
- No emdashes anywhere
- Instagram: Hook first line, value body, end with question CTA, 5-10 relevant hashtags
- TikTok: Short, punchy, trending-friendly, 3-5 hashtags
- YouTube Shorts: SEO-friendly description with keywords, clear CTA
- YouTube Long: Full description with timestamps placeholder, subscribe CTA, 3 hashtags

Return ONLY valid JSON: [{"platform": "instagram_reels", "caption": "..."}, ...]`;

        try {
          const captionMsg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [{ role: "user", content: captionPrompt }],
          });

          const captionText = (captionMsg.content[0] as { text: string }).text.trim();
          // Extract JSON from response
          let cleaned = captionText;
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
          }
          if (!cleaned.startsWith("[")) {
            const match = cleaned.match(/\[[\s\S]*\]/);
            if (match) cleaned = match[0];
          }

          const captionArray = JSON.parse(cleaned) as Array<{ platform: string; caption: string }>;
          for (const c of captionArray) {
            if (c.platform && c.caption && missingPlatforms.includes(c.platform)) {
              db.insert(savedCaptions).values({
                videoCode: code,
                platform: c.platform,
                caption: c.caption,
                variant: 1,
                status: "draft",
              }).run();
              captionsGenerated++;
            }
          }
        } catch (captionErr) {
          console.error("[repurpose-everywhere] Caption generation error:", captionErr);
          // Continue — waterfall was still created successfully
        }
      }

      // ── Return combined results ────────────────────────────────────────
      const allWaterfall = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, code))
        .orderBy(desc(contentWaterfall.createdAt))
        .all();

      const allCaptions = db.select().from(savedCaptions)
        .where(eq(savedCaptions.videoCode, code))
        .all();

      res.json({
        waterfall: { created: waterfallCreated, skipped: TEMPLATE.length - toCreate.length, total: allWaterfall.length },
        captions: { generated: captionsGenerated, existing: captionedPlatforms.size, total: allCaptions.length },
        totalDerivatives: allWaterfall.length + allCaptions.length,
      });
    } catch (error) {
      console.error("[repurpose-everywhere] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to repurpose" });
    }
  });

  return router;
}
