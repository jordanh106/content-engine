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

  // GET /api/carousels/:id - Single carousel with slides
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

  // POST /api/carousels/generate - Create carousel and trigger n8n generation
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

      // Try to trigger n8n webhook
      const webhookUrl = process.env.N8N_CAROUSEL_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              carouselId,
              topic: ideaTopic || videoCode || "carousel",
              hookLine,
              talkingPoints,
              ctaText: ctaText || "",
              platform,
              aspectRatio,
              brandColors: {
                primary: "#0d9488",
                background: "#f8fafc",
                accent: "#14b8a6",
                text: "#0f172a",
              },
            }),
          });

          if (response.ok) {
            const data = await response.json() as Array<{ slideIndex: number; imageBase64: string; filename: string; slideType?: string }>;

            // Save images and create slide records
            for (const slide of data) {
              const filename = slide.filename || `slide-${slide.slideIndex}.png`;
              const filePath = path.join(imgDir, filename);

              // Decode base64 and save
              const buffer = Buffer.from(slide.imageBase64, "base64");
              fs.writeFileSync(filePath, buffer);

              // Insert slide record
              sqlite.prepare(`
                INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                carouselId,
                slide.slideIndex,
                slide.slideType || (slide.slideIndex === 0 ? "cover" : slide.slideIndex === data.length - 1 ? "cta" : "content"),
                `/carousel-images/${carouselId}/${filename}`,
                filename,
              );
            }

            // Mark completed
            sqlite.prepare(
              "UPDATE generated_carousels SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
            ).run(carouselId);
          } else {
            console.error("[carousels] n8n webhook returned:", response.status);
            sqlite.prepare(
              "UPDATE generated_carousels SET status = 'failed' WHERE id = ?"
            ).run(carouselId);
          }
        } catch (n8nErr) {
          console.error("[carousels] n8n webhook error:", n8nErr);
          // Leave as 'generating' - can be retried or manually completed
        }
      } else {
        // No webhook configured - mark as pending (images can be ingested later)
        console.warn("[carousels] N8N_CAROUSEL_WEBHOOK_URL not set. Carousel created but not generated.");
      }

      // Return the carousel (refetch to get latest status)
      const carousel = db
        .select()
        .from(generatedCarousels)
        .where(eq(generatedCarousels.id, carouselId))
        .limit(1)
        .all();

      const slides = db
        .select()
        .from(carouselSlides)
        .where(eq(carouselSlides.carouselId, carouselId))
        .orderBy(carouselSlides.slideIndex)
        .all();

      res.json(mapCarousel(carousel[0], slides));
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

      // Trigger n8n webhook
      const webhookUrl = process.env.N8N_CAROUSEL_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              carouselId,
              topic: video.title,
              hookLine,
              talkingPoints,
              ctaText,
              platform,
              aspectRatio,
              formatId: video.format,
              brandColors: {
                primary: "#0d9488",
                background: "#f8fafc",
                accent: "#14b8a6",
                text: "#0f172a",
              },
            }),
          });

          if (response.ok) {
            const data = await response.json() as Array<{ slideIndex: number; imageBase64: string; filename: string; slideType?: string }>;

            for (const slide of data) {
              const filename = slide.filename || `slide-${slide.slideIndex}.png`;
              const filePath = path.join(imgDir, filename);
              fs.writeFileSync(filePath, Buffer.from(slide.imageBase64, "base64"));

              sqlite.prepare(`
                INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                carouselId,
                slide.slideIndex,
                slide.slideType || (slide.slideIndex === 0 ? "cover" : slide.slideIndex === data.length - 1 ? "cta" : "content"),
                `/carousel-images/${carouselId}/${filename}`,
                filename,
              );
            }

            sqlite.prepare(
              "UPDATE generated_carousels SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
            ).run(carouselId);
          } else {
            sqlite.prepare("UPDATE generated_carousels SET status = 'failed' WHERE id = ?").run(carouselId);
          }
        } catch (n8nErr) {
          console.error("[carousels] n8n webhook error:", n8nErr);
        }
      }

      const carousel = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, carouselId)).limit(1).all();
      const slides = db.select().from(carouselSlides).where(eq(carouselSlides.carouselId, carouselId)).orderBy(carouselSlides.slideIndex).all();

      res.json(mapCarousel(carousel[0], slides));
    } catch (err) {
      console.error("[carousels] POST /:videoCode/from-script error:", err);
      res.status(500).json({ error: "Failed to generate carousel from script" });
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

  return router;
}
