import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { db, sqlite } from "../db.js";
import { generatedCarousels, carouselSlides, performanceMetrics } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import type {
  CarouselPlatform,
  CarouselAspectRatio,
  CarouselGenerateRequest,
  GeneratedCarousel,
  CarouselSlide,
} from "../../shared/types.js";

// Resolve paths for autoresearch editable assets
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const templatesDir = path.resolve(import.meta.dirname, "..", "carousel-templates");
const strategyPath = path.join(repoRoot, "industries", "chiropractic", "carousel-strategy.md");

/** Get short git hash for a file/directory to stamp versions for autoresearch tracking */
function getGitVersion(filePath: string): string | null {
  try {
    return execSync(`git log -1 --format=%h -- "${filePath}"`, { cwd: repoRoot, encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

/** Read the carousel strategy file (autoresearch editable asset) */
export function readCarouselStrategy(): string | null {
  try {
    return fs.existsSync(strategyPath) ? fs.readFileSync(strategyPath, "utf-8") : null;
  } catch {
    return null;
  }
}

/** Read a carousel template file */
export function readTemplate(name: string): string | null {
  try {
    const p = path.join(templatesDir, name);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null;
  } catch {
    return null;
  }
}

export function createCarouselsRouter(contentLibraryPath: string, carouselImagesDir: string) {
  const router = Router();

  // Ensure images directory exists
  if (!fs.existsSync(carouselImagesDir)) {
    fs.mkdirSync(carouselImagesDir, { recursive: true });
  }

  // Helper: map DB row to API response
  function mapCarousel(row: typeof generatedCarousels.$inferSelect, slides?: (typeof carouselSlides.$inferSelect)[]): GeneratedCarousel {
    return {
      id: row.id,
      videoCode: row.videoCode,
      ideaTopic: row.ideaTopic,
      platform: row.platform as CarouselPlatform,
      aspectRatio: row.aspectRatio as CarouselAspectRatio,
      slideCount: row.slideCount,
      hookLine: row.hookLine,
      talkingPoints: row.talkingPoints ? JSON.parse(row.talkingPoints) : [],
      ctaText: row.ctaText,
      status: row.status as GeneratedCarousel["status"],
      generationSource: row.generationSource as GeneratedCarousel["generationSource"],
      templateVersion: row.templateVersion,
      strategyVersion: row.strategyVersion,
      compositeScore: row.compositeScore,
      n8nExecutionId: row.n8nExecutionId,
      hookArchetype: (row as Record<string, unknown>).hookArchetype as string | null ?? null,
      audience: (row as Record<string, unknown>).audience as string | null ?? null,
      canvaDesignId: (row as Record<string, unknown>).canvaDesignId as string | null ?? null,
      canvaDesignUrl: (row as Record<string, unknown>).canvaDesignUrl as string | null ?? null,
      createdAt: row.createdAt ?? "",
      completedAt: row.completedAt,
      slides: slides?.map((s) => ({
        id: s.id,
        carouselId: s.carouselId,
        slideIndex: s.slideIndex,
        slideType: s.slideType as CarouselSlide["slideType"],
        imagePath: s.imagePath,
        filename: s.filename,
        heading: (s as Record<string, unknown>).heading as string | null ?? null,
        bodyText: (s as Record<string, unknown>).bodyText as string | null ?? null,
        visualSuggestion: (s as Record<string, unknown>).visualSuggestion as string | null ?? null,
        createdAt: s.createdAt ?? "",
      })),
    };
  }

  // GET /api/carousels - List all carousels with optional filters
  router.get("/", (req, res) => {
    try {
      const { videoCode, platform, status } = req.query;

      let query = db.select().from(generatedCarousels).orderBy(desc(generatedCarousels.createdAt));

      const rows = query.all();
      let filtered = rows;

      if (videoCode) {
        filtered = filtered.filter((r) => r.videoCode === videoCode);
      }
      if (platform) {
        filtered = filtered.filter((r) => r.platform === platform);
      }
      if (status) {
        filtered = filtered.filter((r) => r.status === status);
      }

      // Attach slides to each carousel
      const result = filtered.map((row) => {
        const slides = db
          .select()
          .from(carouselSlides)
          .where(eq(carouselSlides.carouselId, row.id))
          .orderBy(carouselSlides.slideIndex)
          .all();
        return mapCarousel(row, slides);
      });

      res.json(result);
    } catch (err) {
      console.error("[carousels] GET / error:", err);
      res.status(500).json({ error: "Failed to fetch carousels" });
    }
  });

  // ── Slide data structure
  type SlideData = {
    slideIndex: number;
    slideType: string;
    filename: string;
    heading: string;
    bodyText: string;
    visualSuggestion: string;
  };

  // ── Build slide metadata (text content for each slide)
  function buildSlideData(
    hookLine: string, topic: string, talkingPoints: string[], ctaText: string | null,
    platform: string, aspectRatio: string,
  ): SlideData[] {
    const slides: SlideData[] = [];
    const totalSlides = 1 + talkingPoints.length + (ctaText ? 1 : 0);

    slides.push({
      slideIndex: 0, slideType: "cover", filename: "slide-0.png",
      heading: hookLine, bodyText: topic,
      visualSuggestion: `Cover slide: bold hook on dark gradient. Platform: ${platform}, ratio: ${aspectRatio}.`,
    });

    talkingPoints.forEach((point, i) => {
      const idx = i + 1;
      const sentences = point.split(/(?<=[.!?])\s+/);
      const title = sentences[0] || point;
      const body = sentences.slice(1).join(" ") || point;
      slides.push({
        slideIndex: idx, slideType: "content", filename: `slide-${idx}.png`,
        heading: title, bodyText: body,
        visualSuggestion: `Content slide ${idx} of ${totalSlides}: numbered step with bold title and supporting body text.`,
      });
    });

    if (ctaText) {
      const ctaIdx = slides.length;
      slides.push({
        slideIndex: ctaIdx, slideType: "cta", filename: `slide-${ctaIdx}.png`,
        heading: "Ready to Feel Better?", bodyText: ctaText,
        visualSuggestion: "CTA slide: high contrast dark gradient, prominent Book Now button.",
      });
    }

    return slides;
  }

  // ── Gemini (Nano Banana 2) image generation
  function buildImagePrompt(slide: SlideData, aspectRatio: string, totalSlides: number): string {
    const brandNote = "Brand colors: teal (#0d9488), dark slate (#0f172a), light background (#f8fafc). Font: clean sans-serif. Logo text at bottom: Collective Family Chiropractic.";

    if (slide.slideType === "cover") {
      return `Create a ${aspectRatio} social media carousel cover slide image.
Bold large white headline text: "${slide.heading}"
Smaller subtext below: "${slide.bodyText}"
Bottom-right corner: "SWIPE >" in small text.
Bottom-left corner: "Collective Family Chiropractic" in small uppercase.
Background: dramatic dark gradient from #0f172a to #0d9488 with subtle abstract healthcare-related shapes.
Accent bar: thin teal (#14b8a6) line across the top.
Style: modern, professional, high contrast. The text must be the focal point, large and perfectly readable.
${brandNote}`;
    }

    if (slide.slideType === "cta") {
      return `Create a ${aspectRatio} social media carousel CTA (call-to-action) slide image.
Large heading text: "${slide.heading}"
Below that: "${slide.bodyText}" in lighter text.
Prominent rounded button in center: "BOOK NOW" (white text on dark background).
Bottom center: "Collective Family Chiropractic" in small uppercase.
Background: bold gradient from #0f172a to #0d9488, high contrast and urgent feel.
Thin teal (#14b8a6) accent bar at the bottom.
Style: modern, professional, the button should stand out prominently.
${brandNote}`;
    }

    // Content slide
    return `Create a ${aspectRatio} social media carousel content slide image. This is slide ${slide.slideIndex + 1} of ${totalSlides}.
Top-right corner: "${slide.slideIndex + 1} / ${totalSlides}" in small gray text.
Large faded number "${String(slide.slideIndex).padStart(2, "0")}" as a watermark at 15% opacity in teal.
Bold heading text: "${slide.heading}"
Below in lighter gray text: "${slide.bodyText}"
Bottom-left: "Collective Family Chiropractic" in very small uppercase text at low opacity.
Left edge: thin vertical teal (#0d9488) accent bar running the full height.
Background: clean light (#f8fafc) with subtle texture.
Style: modern, professional, easy to read. The heading should be the largest element.
${brandNote}`;
  }

  async function generateSlideImage(prompt: string): Promise<Buffer | null> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.warn("[carousels] GEMINI_API_KEY not set, skipping image generation");
      return null;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            },
          }),
          signal: AbortSignal.timeout(60000),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("[carousels] Gemini API error:", response.status, errText);
        return null;
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> };
        }>;
      };

      // Find the image part in the response
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }

      console.warn("[carousels] Gemini response contained no image data");
      return null;
    } catch (err) {
      console.error("[carousels] Gemini image generation failed:", err);
      return null;
    }
  }

  // ── Generate full carousel with AI images (runs in background)
  async function generateCarouselImages(carouselId: number, slides: SlideData[], aspectRatio: string) {
    const imgDir = path.join(carouselImagesDir, String(carouselId));
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    let successCount = 0;

    for (const slide of slides) {
      const prompt = buildImagePrompt(slide, aspectRatio, slides.length);
      console.log(`[carousels] Generating image for carousel ${carouselId}, slide ${slide.slideIndex}...`);

      const imageBuffer = await generateSlideImage(prompt);

      if (imageBuffer) {
        // Save image file
        const filePath = path.join(imgDir, slide.filename);
        fs.writeFileSync(filePath, imageBuffer);

        // Insert slide with image path
        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          `/carousel-images/${carouselId}/${slide.filename}`, slide.filename,
          slide.heading, slide.bodyText, slide.visualSuggestion,
        );
        successCount++;
      } else {
        // Fallback: save text-only slide (no image)
        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          slide.filename, slide.heading, slide.bodyText, slide.visualSuggestion,
        );
      }
    }

    // Mark completed
    const status = successCount > 0 ? "completed" : "failed";
    sqlite.prepare(
      "UPDATE generated_carousels SET status = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(status, carouselId);

    console.log(`[carousels] Carousel ${carouselId} generation complete: ${successCount}/${slides.length} images generated, status=${status}`);
  }

  // POST /api/carousels/generate - Create carousel and generate slides
  router.post("/generate", async (req, res) => {
    try {
      const body = req.body as CarouselGenerateRequest & { hookArchetype?: string; audience?: string };
      const { platform, aspectRatio, hookLine, talkingPoints, ctaText, videoCode, ideaTopic } = body;
      const hookArchetype = body.hookArchetype || null;
      const audience = body.audience || null;

      if (!platform || !aspectRatio || !hookLine || !talkingPoints?.length) {
        res.status(400).json({ error: "Missing required fields: platform, aspectRatio, hookLine, talkingPoints" });
        return;
      }

      // Calculate slide count: cover + content slides + CTA
      const slideCount = 1 + talkingPoints.length + (ctaText ? 1 : 0);

      // Stamp versions for autoresearch tracking
      const templateVersion = getGitVersion(templatesDir);
      const strategyVersion = getGitVersion(strategyPath);

      // Insert carousel record
      const result = sqlite.prepare(`
        INSERT INTO generated_carousels (video_code, idea_topic, platform, aspect_ratio, slide_count, hook_line, talking_points, cta_text, status, generation_source, template_version, strategy_version, hook_archetype, audience)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generating', 'manual', ?, ?, ?, ?)
      `).run(
        videoCode || null,
        ideaTopic || null,
        platform,
        aspectRatio,
        slideCount,
        hookLine,
        JSON.stringify(talkingPoints),
        ctaText || null,
        templateVersion,
        strategyVersion,
        hookArchetype,
        audience,
      );

      const carouselId = Number(result.lastInsertRowid);

      // Create carousel images subdirectory
      const imgDir = path.join(carouselImagesDir, String(carouselId));
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      // Build slide data
      const slides = buildSlideData(hookLine, ideaTopic || videoCode || "carousel", talkingPoints, ctaText || null, platform, aspectRatio);

      // Start AI image generation in background (don't block the response)
      generateCarouselImages(carouselId, slides, aspectRatio).catch((err) => {
        console.error("[carousels] Background generation failed:", err);
        sqlite.prepare("UPDATE generated_carousels SET status = 'failed' WHERE id = ?").run(carouselId);
      });

      // Return immediately with "generating" status — frontend polls for completion
      const carousel = db
        .select()
        .from(generatedCarousels)
        .where(eq(generatedCarousels.id, carouselId))
        .limit(1)
        .all();

      res.json(mapCarousel(carousel[0], []));
    } catch (err) {
      console.error("[carousels] POST /generate error:", err);
      res.status(500).json({ error: "Failed to generate carousel" });
    }
  });

  // POST /api/carousels/:videoCode/from-script - Auto-extract content from video script
  router.post("/:videoCode/from-script", async (req, res) => {
    try {
      const { videoCode } = req.params;
      const { platform, aspectRatio } = req.body as { platform: CarouselPlatform; aspectRatio: CarouselAspectRatio };

      if (!platform || !aspectRatio) {
        res.status(400).json({ error: "Missing required fields: platform, aspectRatio" });
        return;
      }

      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find((v) => v.code === videoCode);
      if (!video) {
        res.status(404).json({ error: `Video ${videoCode} not found in content library` });
        return;
      }

      // Extract hook line (first line of script, strip delivery cues)
      const scriptLines = video.script.split("\n").filter((l) => l.trim());
      const hookLine = scriptLines[0]?.replace(/\[.*?\]\s*/g, "").trim() || video.title;

      // Extract talking points (remaining script lines, cleaned)
      const talkingPoints = scriptLines
        .slice(1)
        .map((l) => l.replace(/\[.*?\]\s*/g, "").trim())
        .filter((l) => l.length > 10)
        .slice(0, 6); // Max 6 content slides

      const ctaText = "Book your appointment today at Collective Family Chiropractic";

      // Forward to generate endpoint logic
      const generateReq = {
        ...req,
        body: { videoCode, platform, aspectRatio, hookLine, talkingPoints, ctaText },
      };

      // Reuse generate logic by calling it internally
      const slideCount = 1 + talkingPoints.length + 1;

      // Stamp versions for autoresearch tracking
      const templateVersion = getGitVersion(templatesDir);
      const strategyVersion = getGitVersion(strategyPath);

      const result = sqlite.prepare(`
        INSERT INTO generated_carousels (video_code, platform, aspect_ratio, slide_count, hook_line, talking_points, cta_text, status, generation_source, template_version, strategy_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'generating', 'manual', ?, ?)
      `).run(videoCode, platform, aspectRatio, slideCount, hookLine, JSON.stringify(talkingPoints), ctaText, templateVersion, strategyVersion);

      const carouselId = Number(result.lastInsertRowid);

      const imgDir = path.join(carouselImagesDir, String(carouselId));
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      // Build slide data and generate AI images in background
      const slides = buildSlideData(hookLine, video.title, talkingPoints, ctaText, platform, aspectRatio);

      generateCarouselImages(carouselId, slides, aspectRatio).catch((err) => {
        console.error("[carousels] from-script generation failed:", err);
        sqlite.prepare("UPDATE generated_carousels SET status = 'failed' WHERE id = ?").run(carouselId);
      });

      const carousel = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, carouselId)).limit(1).all();
      res.json(mapCarousel(carousel[0], []));
    } catch (err) {
      console.error("[carousels] POST /:videoCode/from-script error:", err);
      res.status(500).json({ error: "Failed to generate carousel from script" });
    }
  });

  // POST /api/carousels/:id/retry - Retry a failed or stuck carousel
  router.post("/:id/retry", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const rows = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, id)).limit(1).all();
      if (rows.length === 0) { res.status(404).json({ error: "Carousel not found" }); return; }
      const c = rows[0];

      // Delete existing slides and reset status
      sqlite.prepare("DELETE FROM carousel_slides WHERE carousel_id = ?").run(id);
      sqlite.prepare("UPDATE generated_carousels SET status = 'generating' WHERE id = ?").run(id);

      // Re-generate with AI images in background
      const talkingPoints: string[] = JSON.parse(c.talkingPoints || "[]");
      const slides = buildSlideData(
        c.hookLine || "Untitled", c.ideaTopic || c.videoCode || "carousel",
        talkingPoints, c.ctaText || null, c.platform, c.aspectRatio,
      );

      generateCarouselImages(id, slides, c.aspectRatio).catch((err) => {
        console.error("[carousels] Retry generation failed:", err);
        sqlite.prepare("UPDATE generated_carousels SET status = 'failed' WHERE id = ?").run(id);
      });

      const carousel = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, id)).limit(1).all();
      res.json(mapCarousel(carousel[0], []));
    } catch (err) {
      console.error("[carousels] POST /:id/retry error:", err);
      res.status(500).json({ error: "Failed to retry carousel" });
    }
  });

  // GET /api/carousels/test-webhook - Diagnostic: test n8n webhook connectivity
  router.get("/test-webhook", async (req, res) => {
    const url = process.env.N8N_CAROUSEL_WEBHOOK_URL;
    if (!url) {
      res.json({ error: "N8N_CAROUSEL_WEBHOOK_URL not set", envKeys: Object.keys(process.env).filter(k => k.startsWith("N8N_")) });
      return;
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carouselId: -1,
          topic: "test",
          hookLine: "test hook",
          talkingPoints: ["test point one"],
          ctaText: "test cta",
          platform: "instagram",
          aspectRatio: "1:1",
          brandColors: { primary: "#0d9488", background: "#f8fafc", accent: "#14b8a6", text: "#0f172a" },
        }),
      });
      const body = await response.text();
      res.json({ status: response.status, ok: response.ok, body: body.slice(0, 2000), url });
    } catch (err: any) {
      res.json({ error: err.message, code: err.code, url });
    }
  });

  // POST /api/carousels/ingest - Receive completed carousel images from n8n batch workflow
  router.post("/ingest", (req, res) => {
    try {
      const { carouselId, slides } = req.body as {
        carouselId: number;
        slides: Array<{ slideIndex: number; imageBase64: string; filename: string; slideType: string }>;
      };

      if (!carouselId || !slides?.length) {
        res.status(400).json({ error: "Missing carouselId or slides" });
        return;
      }

      const imgDir = path.join(carouselImagesDir, String(carouselId));
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      for (const slide of slides) {
        const filename = slide.filename || `slide-${slide.slideIndex}.png`;
        const filePath = path.join(imgDir, filename);
        fs.writeFileSync(filePath, Buffer.from(slide.imageBase64, "base64"));

        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename)
          VALUES (?, ?, ?, ?, ?)
        `).run(carouselId, slide.slideIndex, slide.slideType, `/carousel-images/${carouselId}/${filename}`, filename);
      }

      sqlite.prepare(
        "UPDATE generated_carousels SET status = 'completed', completed_at = datetime('now'), slide_count = ? WHERE id = ?"
      ).run(slides.length, carouselId);

      res.json({ success: true, carouselId, slideCount: slides.length });
    } catch (err) {
      console.error("[carousels] POST /ingest error:", err);
      res.status(500).json({ error: "Failed to ingest carousel" });
    }
  });

  // DELETE /api/carousels/:id - Remove carousel and image files
  router.delete("/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      // Delete image files
      const imgDir = path.join(carouselImagesDir, String(id));
      if (fs.existsSync(imgDir)) {
        fs.rmSync(imgDir, { recursive: true, force: true });
      }

      // Delete from DB (cascade deletes slides)
      sqlite.prepare("DELETE FROM generated_carousels WHERE id = ?").run(id);

      res.json({ success: true });
    } catch (err) {
      console.error("[carousels] DELETE /:id error:", err);
      res.status(500).json({ error: "Failed to delete carousel" });
    }
  });

  // GET /api/carousels/templates - Serve current templates + strategy for n8n Code node
  router.get("/templates", (_req, res) => {
    try {
      const config = readTemplate("config.json");
      res.json({
        strategy: readCarouselStrategy(),
        strategyVersion: getGitVersion(strategyPath),
        templateVersion: getGitVersion(templatesDir),
        config: config ? JSON.parse(config) : null,
        templates: {
          cover: readTemplate("cover.html"),
          content: readTemplate("content.html"),
          cta: readTemplate("cta.html"),
          thumbnail: readTemplate("thumbnail.html"),
        },
      });
    } catch (err) {
      console.error("[carousels] GET /templates error:", err);
      res.status(500).json({ error: "Failed to read templates" });
    }
  });

  // GET /api/carousels/metrics/score - Composite engagement score for autoresearch verify command
  router.get("/metrics/score", (req, res) => {
    try {
      const { strategyVersion } = req.query;

      // Join carousels with performance_metrics to compute composite score
      // Only include completed carousels from last 30 days with sufficient data
      let query = `
        SELECT
          pm.views, pm.likes, pm.saves, pm.shares, pm.comments,
          gc.id as carousel_id, gc.template_version, gc.strategy_version
        FROM generated_carousels gc
        JOIN performance_metrics pm ON pm.video_code = gc.video_code AND pm.platform = gc.platform
        WHERE gc.status = 'completed'
          AND gc.completed_at >= datetime('now', '-30 days')
          AND pm.views > 100
      `;

      const params: string[] = [];
      if (strategyVersion && strategyVersion !== "current") {
        query += " AND gc.strategy_version = ?";
        params.push(strategyVersion as string);
      }

      const rows = sqlite.prepare(query).all(...params) as Array<{
        views: number; likes: number; saves: number; shares: number; comments: number;
        carousel_id: number; template_version: string | null; strategy_version: string | null;
      }>;

      if (rows.length === 0) {
        res.json({
          compositeScore: 0,
          sampleSize: 0,
          breakdown: { saveRate: 0, shareRate: 0, engagementRate: 0, ctr: 0 },
        });
        return;
      }

      // Calculate rates
      let totalSaveRate = 0;
      let totalShareRate = 0;
      let totalEngagementRate = 0;

      for (const row of rows) {
        const views = row.views || 1;
        totalSaveRate += (row.saves || 0) / views;
        totalShareRate += (row.shares || 0) / views;
        totalEngagementRate += ((row.likes || 0) + (row.comments || 0) + (row.saves || 0) + (row.shares || 0)) / views;
      }

      const n = rows.length;
      const avgSaveRate = totalSaveRate / n;
      const avgShareRate = totalShareRate / n;
      const avgEngagementRate = totalEngagementRate / n;

      // Composite: save_rate*0.4 + share_rate*0.3 + engagement*0.2 + ctr*0.1
      // CTR not available from current metrics, use 0
      const compositeScore = avgSaveRate * 0.4 + avgShareRate * 0.3 + avgEngagementRate * 0.2;

      res.json({
        compositeScore: Math.round(compositeScore * 10000) / 10000,
        sampleSize: n,
        breakdown: {
          saveRate: Math.round(avgSaveRate * 10000) / 10000,
          shareRate: Math.round(avgShareRate * 10000) / 10000,
          engagementRate: Math.round(avgEngagementRate * 10000) / 10000,
          ctr: 0,
        },
      });
    } catch (err) {
      console.error("[carousels] GET /metrics/score error:", err);
      res.status(500).json({ error: "Failed to compute carousel metrics" });
    }
  });

  // GET /api/carousels/metrics/by-version - Performance breakdown by template/strategy version
  router.get("/metrics/by-version", (req, res) => {
    try {
      const rows = sqlite.prepare(`
        SELECT
          gc.template_version,
          gc.strategy_version,
          COUNT(*) as count,
          AVG(gc.composite_score) as avg_score
        FROM generated_carousels gc
        WHERE gc.status = 'completed' AND gc.composite_score IS NOT NULL
        GROUP BY gc.template_version, gc.strategy_version
        ORDER BY avg_score DESC
      `).all() as Array<{
        template_version: string | null;
        strategy_version: string | null;
        count: number;
        avg_score: number;
      }>;

      res.json(rows);
    } catch (err) {
      console.error("[carousels] GET /metrics/by-version error:", err);
      res.status(500).json({ error: "Failed to fetch version metrics" });
    }
  });

  // PUT /api/carousels/:id/slides/:slideIndex - Update slide text fields (Carousel Lab editor)
  router.put("/:id/slides/:slideIndex", (req, res) => {
    try {
      const carouselId = parseInt(req.params.id, 10);
      const slideIndex = parseInt(req.params.slideIndex, 10);
      const { heading, bodyText, visualSuggestion } = req.body as { heading?: string; bodyText?: string; visualSuggestion?: string };

      sqlite.prepare(`
        UPDATE carousel_slides
        SET heading = ?, body_text = ?, visual_suggestion = ?
        WHERE carousel_id = ? AND slide_index = ?
      `).run(heading ?? null, bodyText ?? null, visualSuggestion ?? null, carouselId, slideIndex);

      res.json({ success: true });
    } catch (err) {
      console.error("[carousels] PUT /:id/slides/:slideIndex error:", err);
      res.status(500).json({ error: "Failed to update slide" });
    }
  });

  // PUT /api/carousels/:id/canva - Save Canva design URL after /carousel-lab skill push
  router.put("/:id/canva", (req, res) => {
    try {
      const { canvaDesignId, canvaDesignUrl } = req.body as { canvaDesignId?: string; canvaDesignUrl?: string };

      sqlite.prepare(`
        UPDATE generated_carousels
        SET canva_design_id = ?, canva_design_url = ?
        WHERE id = ?
      `).run(canvaDesignId ?? null, canvaDesignUrl ?? null, parseInt(req.params.id, 10));

      res.json({ success: true });
    } catch (err) {
      console.error("[carousels] PUT /:id/canva error:", err);
      res.status(500).json({ error: "Failed to update Canva fields" });
    }
  });

  // --- Suggest-points constants ---

  const ARCHETYPE_FRAMING: Record<string, string> = {
    teacher:       "Structure as clear actionable steps. First point identifies the pain/problem. Remaining points give specific methods. Tone: authoritative but warm.",
    contrarian:    "Each point challenges a common belief with evidence. At least one point MUST cite a real statistic or study. Tone: provocative, confident.",
    fortuneteller: "Frame each point as a prediction or emerging trend. First point describes current state, rest predict consequences. Tone: forward-looking, urgent.",
    experimenter:  "Frame as test results. First point sets up what was tested. Remaining points reveal specific measured outcomes. Tone: candid, specific numbers.",
    magician:      "Lead with the most surprising fact. Each subsequent point explains the mechanism behind the surprise. Tone: revelatory, wonder-inducing.",
    investigator:  "Frame as uncovered hidden insights. First point reveals what's hidden. Remaining points provide research-backed evidence. Tone: detective-like, methodical.",
  };

  const SLIDE_WORD_TARGETS: Record<string, { title: [number, number]; body: [number, number] }> = {
    instagram_portrait: { title: [5, 8],  body: [20, 35] },
    instagram_square:   { title: [4, 7],  body: [15, 25] },
    linkedin:           { title: [5, 10], body: [25, 40] },
    tiktok:             { title: [3, 6],  body: [12, 20] },
  };

  function extractJson(raw: string): string {
    // Strip markdown fences
    let s = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    // Find the JSON array boundaries
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start !== -1 && end > start) s = s.slice(start, end + 1);
    return s;
  }

  function flattenPoints(parsed: unknown[]): string[] {
    return parsed.map((p: any) =>
      typeof p === "string" ? p : `${p.title}. ${p.body}`
    );
  }

  // POST /api/carousels/suggest-points - Framework-driven content point suggestions
  // Perplexity (web search + generation) when key is set; Claude fallback otherwise
  router.post("/suggest-points", async (req, res) => {
    try {
      const { topic, audience, archetype, hookLine, platform, aspectRatio, count } = req.body as {
        topic: string;
        audience?: string;
        archetype?: string;
        hookLine?: string;
        platform?: string;
        aspectRatio?: string;
        count?: number;
      };
      const pointCount = Math.min(Math.max(count || 3, 1), 6);

      if (!topic?.trim()) {
        res.status(400).json({ error: "topic is required" });
        return;
      }

      // Resolve platform key for word targets
      const arch = archetype || "teacher";
      const framing = ARCHETYPE_FRAMING[arch] || ARCHETYPE_FRAMING.teacher;
      let platformKey = "instagram_portrait";
      if (platform === "tiktok") platformKey = "tiktok";
      else if (platform === "linkedin") platformKey = "linkedin";
      else if (platform === "instagram" && aspectRatio === "1:1") platformKey = "instagram_square";
      const targets = SLIDE_WORD_TARGETS[platformKey];

      const systemPrompt = `You are a carousel slide copywriter for a chiropractic practice. Your job: find real facts via web research, then reframe them as punchy, scannable slide fragments. You write slide copy, NOT encyclopedia entries. Every word must earn its place.`;

      const userPrompt = `Generate ${pointCount} content slide points for a ${platform || "instagram"} carousel.

TOPIC: "${topic}"
ARCHETYPE: ${arch}
${framing}
${hookLine ? `COVER HOOK: "${hookLine}"` : ""}
${audience ? `AUDIENCE: ${audience}` : ""}

FORMAT: Return a JSON array of ${pointCount} objects with "title" and "body" keys:
[{"title": "Short punchy title", "body": "Supporting detail as sentence fragment"}]

WORD LIMITS (${platformKey}):
- title: ${targets.title[0]}-${targets.title[1]} words (punchy headline fragment)
- body: ${targets.body[0]}-${targets.body[1]} words (supporting fact or detail)

RULES:
- Sentence FRAGMENTS, not full sentences. Drop articles ("the", "a") and filler words
- Each point independently valuable if screenshotted alone
- Use real research-backed facts, but frame as slide copy not textbook prose
- If hook mentions a number, deliver exactly that many points
- If archetype is contrarian, at least one point MUST cite a real stat or study
- Specific concrete details > generic statements ("60lbs of pressure" not "a lot of strain")
- No filler phrases ("Remember that...", "It's important to...", "Did you know...")
- No emdashes

GOOD output examples:
[
  {"title": "Your spine runs the show", "body": "31 nerve pairs. Every organ, every muscle. One misalignment disrupts the chain."},
  {"title": "Desk posture rewires your neck", "body": "8 hours daily. 60lbs of forward head pressure. Your muscles compensate until they can't."},
  {"title": "Adjustments reset the signal", "body": "Restored nerve flow means better sleep, digestion, and energy. Not just pain relief."}
]

BAD output (do NOT produce):
- "Your spine houses 31 nerve pairs controlling every organ, muscle, and tissue in your body."
- "Subluxations (spinal misalignments) can compress nerves and disrupt signals before symptoms appear."
These are bad because: full sentences, encyclopedia tone, too wordy, no urgency, reads like a textbook.

Return ONLY the JSON array. No preamble, no explanation.`;

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (perplexityKey) {
        const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (perplexityRes.ok) {
          const perplexityData = await perplexityRes.json() as {
            choices: Array<{ message: { content: string } }>;
          };
          const raw = perplexityData.choices[0]?.message?.content?.trim() ?? "";
          const cleaned = extractJson(raw);
          const parsed = JSON.parse(cleaned);
          if (!Array.isArray(parsed)) throw new Error("Invalid Perplexity response format");
          res.json({ points: flattenPoints(parsed), source: "perplexity" });
          return;
        }
        console.warn("[carousels] Perplexity call failed, falling back to Claude");
      }

      // Claude fallback
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const raw = (message.content[0] as { type: string; text: string }).text.trim();
      const cleaned = extractJson(raw);
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Invalid response format");
      res.json({ points: flattenPoints(parsed), source: "claude" });
    } catch (err) {
      console.error("[carousels] suggest-points error:", err);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // GET /api/carousels/experiments - TSV-compatible experiment log for autoresearch
  router.get("/experiments", (req, res) => {
    try {
      const rows = sqlite.prepare(`
        SELECT id, template_version, strategy_version, composite_score, status, platform, slide_count, created_at
        FROM generated_carousels
        ORDER BY created_at DESC
        LIMIT 200
      `).all() as Array<{
        id: number;
        template_version: string | null;
        strategy_version: string | null;
        composite_score: number | null;
        status: string;
        platform: string;
        slide_count: number;
        created_at: string;
      }>;

      res.json(rows);
    } catch (err) {
      console.error("[carousels] GET /experiments error:", err);
      res.status(500).json({ error: "Failed to fetch experiments" });
    }
  });

  // GET /api/carousels/:id - Single carousel with slides
  // IMPORTANT: This must be the LAST GET route to avoid catching named routes like /test-webhook, /templates, etc.
  router.get("/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const rows = db
        .select()
        .from(generatedCarousels)
        .where(eq(generatedCarousels.id, id))
        .limit(1)
        .all();

      if (rows.length === 0) {
        res.status(404).json({ error: "Carousel not found" });
        return;
      }

      const slides = db
        .select()
        .from(carouselSlides)
        .where(eq(carouselSlides.carouselId, id))
        .orderBy(carouselSlides.slideIndex)
        .all();

      res.json(mapCarousel(rows[0], slides));
    } catch (err) {
      console.error("[carousels] GET /:id error:", err);
      res.status(500).json({ error: "Failed to fetch carousel" });
    }
  });

  return router;
}
