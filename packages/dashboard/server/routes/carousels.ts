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
  CarouselStyle,
  CarouselOutputFormat,
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
      remixSourceUrl: (row as Record<string, unknown>).remixSourceUrl as string | null ?? null,
      remixSourceType: (row as Record<string, unknown>).remixSourceType as string | null ?? null,
      sourceCarouselId: (row as Record<string, unknown>).sourceCarouselId as number | null ?? null,
      carouselStyle: ((row as Record<string, unknown>).carouselStyle as string | null ?? "flat") as GeneratedCarousel["carouselStyle"],
      outputFormat: ((row as Record<string, unknown>).outputFormat as string | null ?? "static") as GeneratedCarousel["outputFormat"],
      videoPath: (row as Record<string, unknown>).videoPath as string | null ?? null,
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

  // ── Remotion 3D slide rendering
  const remotionRoot = path.resolve(import.meta.dirname, "..", "..", "..", "remotion-studio");

  async function renderRemotion3DSlides(carouselId: number, slides: SlideData[]) {
    const imgDir = path.join(carouselImagesDir, String(carouselId));
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    let successCount = 0;
    const accentObjects = ["torus", "sphere", "octahedron", "icosahedron"];

    for (const slide of slides) {
      const props = JSON.stringify({
        heading: slide.heading,
        bodyText: slide.bodyText || "",
        slideType: slide.slideType === "rehook" ? "content" : slide.slideType,
        slideIndex: slide.slideIndex,
        totalSlides: slides.length,
        accentObject: accentObjects[slide.slideIndex % accentObjects.length],
        durationInSeconds: 4,
        theme: {
          primaryColor: "#0d9488",
          accentColor: "#faf5ef",
          darkBackground: "#1a1a2e",
          lightBackground: "#faf5ef",
          textColor: "#ffffff",
          headingFont: "Georgia",
          bodyFont: "Nunito Sans",
          primaryGradientEnd: "#065f46",
          accentGradientEnd: "#e7ddd0",
          glowColor: "#0d9488",
          surfaceColor: "rgba(255, 255, 255, 0.06)",
          borderColor: "rgba(255, 255, 255, 0.08)",
          noiseOpacity: 0.03,
          glassBlur: 20,
          glassOpacity: 0.08,
        },
      });

      const outputPath = path.join(imgDir, slide.filename);

      try {
        console.log(`[carousels] Rendering Remotion 3D slide ${slide.slideIndex} for carousel ${carouselId}...`);
        execSync(
          `npx remotion still src/index.ts CarouselSlide3D --gl=angle --frame=60 --props='${props.replace(/'/g, "'\\''")}' --output="${outputPath}"`,
          { cwd: remotionRoot, timeout: 60000, stdio: "pipe" },
        );

        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          `/carousel-images/${carouselId}/${slide.filename}`, slide.filename,
          slide.heading, slide.bodyText, "Remotion 3D rendered",
        );
        successCount++;
      } catch (err) {
        console.error(`[carousels] Remotion 3D render failed for slide ${slide.slideIndex}:`, err);
        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          slide.filename, slide.heading, slide.bodyText, "Remotion 3D render failed",
        );
      }
    }

    const status = successCount > 0 ? "completed" : "failed";
    sqlite.prepare(
      "UPDATE generated_carousels SET status = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(status, carouselId);

    console.log(`[carousels] Remotion 3D carousel ${carouselId} complete: ${successCount}/${slides.length} slides rendered`);
  }

  // ── Blender 3D slide rendering (photorealistic ray-traced backgrounds + FFmpeg text overlay)
  const blenderScriptsDir = path.resolve(import.meta.dirname, "..", "..", "..", "..", "blender", "scripts");

  async function renderBlender3DSlides(carouselId: number, slides: SlideData[]) {
    const imgDir = path.join(carouselImagesDir, String(carouselId));
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    let successCount = 0;
    const accentObjects = ["torus", "sphere", "octahedron", "icosahedron"];

    for (const slide of slides) {
      const accent = accentObjects[slide.slideIndex % accentObjects.length];
      const slideType = slide.slideType === "rehook" ? "content" : slide.slideType;
      const bgPath = path.join(imgDir, `bg-${slide.slideIndex}.png`);
      const outputPath = path.join(imgDir, slide.filename);

      try {
        // Step 1: Render 3D background with Blender
        console.log(`[carousels] Blender rendering bg for slide ${slide.slideIndex}...`);
        const renderScript = path.join(blenderScriptsDir, "render_bg.py");
        execSync(
          `blender --background --python "${renderScript}" -- --accent-object ${accent} --slide-type ${slideType} --output "${bgPath}" --samples 48`,
          { timeout: 180000, stdio: "pipe" },
        );

        // Step 2: Composite text via ImageMagick
        console.log(`[carousels] ImageMagick compositing text for slide ${slide.slideIndex}...`);
        const heading = slide.heading.replace(/"/g, '\\"');
        const body = slide.bodyText.replace(/"/g, '\\"');
        const counter = `${slide.slideIndex + 1} / ${slides.length}`;
        const isCover = slideType === "cover";
        const isCta = slideType === "cta";

        const headingSize = isCover ? 52 : isCta ? 46 : 42;
        const georgiaFont = "/System/Library/Fonts/Supplemental/Georgia.ttf";
        const helveticaFont = "/System/Library/Fonts/Helvetica.ttc";

        const magickArgs: string[] = [
          `"${bgPath}"`,
          // Dark gradient overlay for text readability
          `-fill "rgba(0,0,0,0.5)" -draw "rectangle 0,864 1080,1920"`,
          // Accent line
          `-fill "#14b8a6" -draw "rectangle 60,1596 140,1600"`,
          // Heading
          `-font "${georgiaFont}" -fill white -pointsize ${headingSize} -gravity SouthWest -annotate +60+280 "${heading}"`,
        ];

        // Body text
        if (body) {
          magickArgs.push(`-font "${helveticaFont}" -fill "#d4d4d8" -pointsize 22 -gravity SouthWest -annotate +60+180 "${body}"`);
        }

        // Counter
        magickArgs.push(`-font "${helveticaFont}" -fill "#6b7280" -pointsize 14 -gravity NorthEast -annotate +60+80 "${counter}"`);

        // Badge
        if (isCover) {
          magickArgs.push(`-font "${helveticaFont}" -fill "#0d9488" -pointsize 13 -gravity NorthWest -annotate +60+80 "SWIPE >"`);
        } else if (isCta) {
          magickArgs.push(`-font "${helveticaFont}" -fill "#f59e0b" -pointsize 13 -gravity NorthWest -annotate +60+80 "TAKE ACTION"`);
        }

        // Brand mark
        magickArgs.push(`-font "${helveticaFont}" -fill "#4b5563" -pointsize 10 -gravity SouthWest -annotate +60+60 "COLLECTIVE FAMILY CHIROPRACTIC"`);

        magickArgs.push(`"${outputPath}"`);

        execSync(`magick ${magickArgs.join(" ")}`, { timeout: 30000, stdio: "pipe" });

        // Insert slide record
        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          `/carousel-images/${carouselId}/${slide.filename}`, slide.filename,
          slide.heading, slide.bodyText, "Blender 3D + FFmpeg text",
        );
        successCount++;

        // Clean up bg file
        try { fs.unlinkSync(bgPath); } catch { /* ignore */ }
      } catch (err) {
        console.error(`[carousels] Blender render failed for slide ${slide.slideIndex}:`, err);
        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          slide.filename, slide.heading, slide.bodyText, "Blender render failed",
        );
      }
    }

    const status = successCount > 0 ? "completed" : "failed";
    sqlite.prepare(
      "UPDATE generated_carousels SET status = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(status, carouselId);
    console.log(`[carousels] Blender carousel ${carouselId} complete: ${successCount}/${slides.length} slides rendered`);
  }

  // ── Video carousel: render animated slides + FFmpeg concat
  async function renderVideoCarousel(carouselId: number, slides: SlideData[]) {
    const imgDir = path.join(carouselImagesDir, String(carouselId));
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    const clipPaths: string[] = [];
    const accentObjects = ["torus", "sphere", "octahedron", "icosahedron"];

    for (const slide of slides) {
      const props = JSON.stringify({
        heading: slide.heading,
        bodyText: slide.bodyText || "",
        slideType: slide.slideType === "rehook" ? "content" : slide.slideType,
        slideIndex: slide.slideIndex,
        totalSlides: slides.length,
        accentObject: accentObjects[slide.slideIndex % accentObjects.length],
        durationInSeconds: 4,
        theme: {
          primaryColor: "#0d9488",
          accentColor: "#faf5ef",
          darkBackground: "#1a1a2e",
          lightBackground: "#faf5ef",
          textColor: "#ffffff",
          headingFont: "Georgia",
          bodyFont: "Nunito Sans",
          primaryGradientEnd: "#065f46",
          accentGradientEnd: "#e7ddd0",
          glowColor: "#0d9488",
          surfaceColor: "rgba(255, 255, 255, 0.06)",
          borderColor: "rgba(255, 255, 255, 0.08)",
          noiseOpacity: 0.03,
          glassBlur: 20,
          glassOpacity: 0.08,
        },
      });

      const clipPath = path.join(imgDir, `clip-${slide.slideIndex}.mp4`);

      try {
        console.log(`[carousels] Rendering video clip for slide ${slide.slideIndex}...`);
        execSync(
          `npx remotion render src/index.ts CarouselSlide3D --gl=angle --props='${props.replace(/'/g, "'\\''")}' --output="${clipPath}"`,
          { cwd: remotionRoot, timeout: 120000, stdio: "pipe" },
        );
        clipPaths.push(clipPath);

        // Also render a still thumbnail for the slide record
        const stillPath = path.join(imgDir, slide.filename);
        execSync(
          `npx remotion still src/index.ts CarouselSlide3D --gl=angle --frame=60 --props='${props.replace(/'/g, "'\\''")}' --output="${stillPath}"`,
          { cwd: remotionRoot, timeout: 60000, stdio: "pipe" },
        );

        sqlite.prepare(`
          INSERT INTO carousel_slides (carousel_id, slide_index, slide_type, image_path, filename, heading, body_text, visual_suggestion)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          carouselId, slide.slideIndex, slide.slideType,
          `/carousel-images/${carouselId}/${slide.filename}`, slide.filename,
          slide.heading, slide.bodyText, "Remotion 3D video rendered",
        );
      } catch (err) {
        console.error(`[carousels] Video render failed for slide ${slide.slideIndex}:`, err);
      }
    }

    // Concatenate clips with FFmpeg crossfade
    if (clipPaths.length > 0) {
      const concatFile = path.join(imgDir, "concat.txt");
      fs.writeFileSync(concatFile, clipPaths.map((p) => `file '${p}'`).join("\n"));
      const videoPath = path.join(imgDir, "carousel.mp4");

      try {
        execSync(
          `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p "${videoPath}"`,
          { timeout: 120000, stdio: "pipe" },
        );
        sqlite.prepare(
          "UPDATE generated_carousels SET status = 'completed', completed_at = datetime('now'), video_path = ? WHERE id = ?"
        ).run(`/carousel-images/${carouselId}/carousel.mp4`, carouselId);
        console.log(`[carousels] Video carousel ${carouselId} assembled: ${videoPath}`);
      } catch (err) {
        console.error(`[carousels] FFmpeg concat failed:`, err);
        sqlite.prepare(
          "UPDATE generated_carousels SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
        ).run(carouselId);
      }

      // Clean up concat file
      try { fs.unlinkSync(concatFile); } catch { /* ignore */ }
    } else {
      sqlite.prepare(
        "UPDATE generated_carousels SET status = 'failed', completed_at = datetime('now') WHERE id = ?"
      ).run(carouselId);
    }
  }

  // POST /api/carousels/generate - Create carousel and generate slides
  router.post("/generate", async (req, res) => {
    try {
      const body = req.body as CarouselGenerateRequest & { hookArchetype?: string; audience?: string };
      const { platform, aspectRatio, hookLine, talkingPoints, ctaText, videoCode, ideaTopic } = body;
      const hookArchetype = body.hookArchetype || null;
      const audience = body.audience || null;
      const carouselStyle = body.carouselStyle || "flat";
      const outputFormat = body.outputFormat || "static";

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
        INSERT INTO generated_carousels (video_code, idea_topic, platform, aspect_ratio, slide_count, hook_line, talking_points, cta_text, status, generation_source, template_version, strategy_version, hook_archetype, audience, carousel_style, output_format)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generating', 'manual', ?, ?, ?, ?, ?, ?)
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
        carouselStyle,
        outputFormat,
      );

      const carouselId = Number(result.lastInsertRowid);

      // Create carousel images subdirectory
      const imgDir = path.join(carouselImagesDir, String(carouselId));
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      // Build slide data
      const slides = buildSlideData(hookLine, ideaTopic || videoCode || "carousel", talkingPoints, ctaText || null, platform, aspectRatio);

      // Route to the appropriate renderer based on style and format
      const renderFn = outputFormat === "video"
        ? () => renderVideoCarousel(carouselId, slides)
        : carouselStyle === "blender3d"
          ? () => renderBlender3DSlides(carouselId, slides)
          : carouselStyle === "remotion3d"
            ? () => renderRemotion3DSlides(carouselId, slides)
            : () => generateCarouselImages(carouselId, slides, aspectRatio);

      renderFn().catch((err) => {
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
      const { platform, aspectRatio, carouselStyle: style, outputFormat: format } = req.body as {
        platform: CarouselPlatform;
        aspectRatio: CarouselAspectRatio;
        carouselStyle?: CarouselStyle;
        outputFormat?: CarouselOutputFormat;
      };
      const carouselStyle = style || "flat";
      const outputFormat = format || "static";

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
        INSERT INTO generated_carousels (video_code, platform, aspect_ratio, slide_count, hook_line, talking_points, cta_text, status, generation_source, template_version, strategy_version, carousel_style, output_format)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'generating', 'manual', ?, ?, ?, ?)
      `).run(videoCode, platform, aspectRatio, slideCount, hookLine, JSON.stringify(talkingPoints), ctaText, templateVersion, strategyVersion, carouselStyle, outputFormat);

      const carouselId = Number(result.lastInsertRowid);

      const imgDir = path.join(carouselImagesDir, String(carouselId));
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      // Build slide data and route to the appropriate renderer
      const slides = buildSlideData(hookLine, video.title, talkingPoints, ctaText, platform, aspectRatio);

      const renderFn = outputFormat === "video"
        ? () => renderVideoCarousel(carouselId, slides)
        : carouselStyle === "remotion3d"
          ? () => renderRemotion3DSlides(carouselId, slides)
          : () => generateCarouselImages(carouselId, slides, aspectRatio);

      renderFn().catch((err) => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 1: Carousel Remix — Analyze screenshot/URL and generate original carousel
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/remix-analyze", async (req, res) => {
    try {
      const { url, imageBase64, topic, audience, archetype, platform, aspectRatio } = req.body as {
        url?: string;
        imageBase64?: string;
        topic: string;
        audience?: string;
        archetype?: string;
        platform?: string;
        aspectRatio?: string;
      };

      if (!url && !imageBase64) {
        res.status(400).json({ error: "Provide either a URL or image" });
        return;
      }
      if (!topic?.trim()) {
        res.status(400).json({ error: "Topic is required to generate original content" });
        return;
      }

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Build image content for Claude vision
      let imageContent: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];

      if (imageBase64) {
        // Direct screenshot upload
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        imageContent = [{
          type: "image",
          source: { type: "base64", media_type: "image/png", data: cleanBase64 },
        }];
      } else if (url) {
        // Try to fetch post image via oEmbed or direct fetch
        try {
          const oembedUrl = url.includes("instagram.com")
            ? `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${process.env.INSTAGRAM_TOKEN || ""}`
            : url.includes("tiktok.com")
            ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
            : url.includes("linkedin.com")
            ? null
            : null;

          if (oembedUrl) {
            const oembedRes = await fetch(oembedUrl);
            if (oembedRes.ok) {
              const oembedData = await oembedRes.json() as { thumbnail_url?: string };
              if (oembedData.thumbnail_url) {
                const imgRes = await fetch(oembedData.thumbnail_url);
                if (imgRes.ok) {
                  const buffer = Buffer.from(await imgRes.arrayBuffer());
                  imageContent = [{
                    type: "image",
                    source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") },
                  }];
                }
              }
            }
          }
        } catch {
          // Image fetch failed, proceed with text-only analysis
        }
      }

      // Claude vision analysis of the carousel structure
      const analysisPrompt = `Analyze this social media carousel post and extract its structural DNA.${url ? ` Source URL: ${url}` : ""}

Return a JSON object with these fields:
{
  "layoutPattern": "text-over-gradient | split-layout | minimal-text | bold-typography | image-heavy",
  "hookTechnique": "listicle-promise | myth-opener | stat-anchor | regret-frame | quick-win | contrarian",
  "contentFlow": "problem-solution | listicle | story-arc | myth-truth | step-by-step",
  "slideCount": number,
  "ctaStyle": "save-first | share-trigger | follow | action | comment",
  "colorScheme": "dark-gradient | light-clean | bold-contrast | pastel | brand-heavy",
  "slideSummaries": ["brief summary of each slide's content/purpose"]
}

Be specific and actionable. If you can't see images, infer from the URL and context.
Return ONLY the JSON object.`;

      const userContent = imageContent.length > 0
        ? [...imageContent, { type: "text" as const, text: analysisPrompt }]
        : [{ type: "text" as const, text: analysisPrompt }];

      const analysisMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user" as const, content: userContent as any }],
      });

      const analysisRaw = (analysisMsg.content[0] as { text: string }).text.trim();
      const analysisClean = extractJson(analysisRaw);
      const analysis = JSON.parse(analysisClean);

      // Now generate original content based on the detected structure
      const slideCount = analysis.slideCount || 5;
      const pointCount = Math.max(1, Math.min(slideCount - 2, 6)); // minus cover and CTA

      const generatePrompt = `Generate original carousel content inspired by this structural pattern, but with completely original content for MY niche.

STRUCTURAL PATTERN DETECTED:
- Layout: ${analysis.layoutPattern}
- Hook technique: ${analysis.hookTechnique}
- Content flow: ${analysis.contentFlow}
- Slide count: ${slideCount}
- CTA style: ${analysis.ctaStyle}

MY CONTENT:
- Topic: ${topic}
- Audience: ${audience || "general"}
- Archetype: ${archetype || "teacher"}
- Brand: Collective Family Chiropractic

Generate a JSON object:
{
  "hookLine": "original hook using the ${analysis.hookTechnique} technique for my topic",
  "talkingPoints": [${pointCount} original content points as "Title. Supporting detail" strings],
  "ctaText": "CTA using ${analysis.ctaStyle} style",
  "suggestedArchetype": "best matching archetype"
}

RULES:
- 100% original content, zero copied text
- Adapt the STRUCTURE, not the content
- Use real facts relevant to chiropractic
- No emdashes, no filler words
- Sentence fragments, not full sentences

Return ONLY the JSON object.`;

      const genMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: generatePrompt }],
      });

      const genRaw = (genMsg.content[0] as { text: string }).text.trim();
      const genClean = extractJson(genRaw);
      const generated = JSON.parse(genClean);

      res.json({
        analysis,
        generated: {
          hookLine: generated.hookLine,
          talkingPoints: generated.talkingPoints,
          ctaText: generated.ctaText,
          suggestedArchetype: generated.suggestedArchetype,
        },
        sourceUrl: url || null,
        sourceType: imageBase64 ? "screenshot" : "url",
      });
    } catch (err) {
      console.error("[carousels] remix-analyze error:", err);
      res.status(500).json({ error: "Failed to analyze carousel for remix" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 2: Cross-Platform Multiplier — Generate optimized variants for other platforms
  // ═══════════════════════════════════════════════════════════════════════════

  const PLATFORM_SLIDE_TARGETS: Record<string, number> = {
    instagram_portrait: 7, instagram_square: 7, linkedin: 6, tiktok: 5,
  };

  const PLATFORM_CTA_DEFAULTS: Record<string, string> = {
    instagram: "Save this for your next visit",
    linkedin: "Share this with someone who needs it",
    tiktok: "Which one surprised you most?",
  };

  router.post("/:id/multiply", async (req, res) => {
    try {
      const sourceId = parseInt(req.params.id, 10);
      const { targetPlatforms } = req.body as {
        targetPlatforms: Array<{ platform: string; aspectRatio: string }>;
      };

      if (!targetPlatforms?.length) {
        res.status(400).json({ error: "targetPlatforms required" });
        return;
      }

      // Fetch source carousel
      const sourceRows = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, sourceId)).limit(1).all();
      if (sourceRows.length === 0) { res.status(404).json({ error: "Source carousel not found" }); return; }
      const source = sourceRows[0];
      const sourceTalkingPoints: string[] = JSON.parse(source.talkingPoints || "[]");

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const createdCarousels: number[] = [];

      for (const target of targetPlatforms) {
        const platformKey = target.platform === "instagram"
          ? (target.aspectRatio === "4:5" ? "instagram_portrait" : "instagram_square")
          : target.platform;
        const targetSlides = PLATFORM_SLIDE_TARGETS[platformKey] || 6;
        const targetPointCount = Math.max(1, targetSlides - 2);
        const ctaText = PLATFORM_CTA_DEFAULTS[target.platform] || source.ctaText || "Save this";

        // Rewrite content for platform
        const rewritePrompt = `Rewrite this carousel content for ${target.platform} (${target.aspectRatio}).

ORIGINAL CONTENT (${source.platform}, ${sourceTalkingPoints.length} points):
Hook: "${source.hookLine}"
Points:
${sourceTalkingPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

TARGET: ${target.platform} needs ${targetPointCount} content points.
${targetPointCount < sourceTalkingPoints.length ? "Condense: merge the weakest points, keep the strongest." : "Expand: add relevant supporting points."}

Platform word targets for ${platformKey}:
${platformKey === "tiktok" ? "Titles: 3-6 words, Body: 12-20 words (ultra punchy)" : platformKey === "linkedin" ? "Titles: 5-10 words, Body: 25-40 words (slightly more professional)" : "Titles: 4-8 words, Body: 15-30 words"}

Return JSON:
{
  "hookLine": "rewritten hook optimized for ${target.platform}",
  "talkingPoints": [exactly ${targetPointCount} "Title. Body" strings]
}

RULES: Original content reworded, not copied. No emdashes. Sentence fragments. Return ONLY JSON.`;

        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: rewritePrompt }],
        });

        const raw = (msg.content[0] as { text: string }).text.trim();
        const cleaned = extractJson(raw);
        const rewritten = JSON.parse(cleaned);

        const slideCount = 1 + (rewritten.talkingPoints?.length || targetPointCount) + 1;
        const templateVersion = getGitVersion(templatesDir);
        const strategyVersion = getGitVersion(strategyPath);

        const result = sqlite.prepare(`
          INSERT INTO generated_carousels (idea_topic, platform, aspect_ratio, slide_count, hook_line, talking_points, cta_text, status, generation_source, template_version, strategy_version, hook_archetype, audience, source_carousel_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'generating', 'multiplied', ?, ?, ?, ?, ?)
        `).run(
          source.ideaTopic, target.platform, target.aspectRatio, slideCount,
          rewritten.hookLine || source.hookLine, JSON.stringify(rewritten.talkingPoints || sourceTalkingPoints),
          ctaText, templateVersion, strategyVersion,
          (source as Record<string, unknown>).hookArchetype as string || null,
          (source as Record<string, unknown>).audience as string || null,
          sourceId,
        );

        const carouselId = Number(result.lastInsertRowid);
        createdCarousels.push(carouselId);

        // Generate images in background
        const slides = buildSlideData(
          rewritten.hookLine || source.hookLine || "Untitled",
          source.ideaTopic || "carousel",
          rewritten.talkingPoints || sourceTalkingPoints,
          ctaText, target.platform, target.aspectRatio,
        );
        generateCarouselImages(carouselId, slides, target.aspectRatio).catch((err) => {
          console.error(`[carousels] Multiply generation failed for ${carouselId}:`, err);
          sqlite.prepare("UPDATE generated_carousels SET status = 'failed' WHERE id = ?").run(carouselId);
        });
      }

      res.json({ sourceId, createdCarouselIds: createdCarousels });
    } catch (err) {
      console.error("[carousels] multiply error:", err);
      res.status(500).json({ error: "Failed to multiply carousel" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 4: Engagement Autopsy — Diagnose why a carousel over/underperformed
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/:id/autopsy", async (req, res) => {
    try {
      const carouselId = parseInt(req.params.id, 10);

      // Get carousel data
      const rows = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, carouselId)).limit(1).all();
      if (rows.length === 0) { res.status(404).json({ error: "Carousel not found" }); return; }
      const carousel = rows[0];

      // Get slides
      const slides = db.select().from(carouselSlides)
        .where(eq(carouselSlides.carouselId, carouselId))
        .orderBy(carouselSlides.slideIndex).all();

      // Get this carousel's metrics
      const metrics = sqlite.prepare(`
        SELECT views, likes, saves, shares, comments FROM performance_metrics
        WHERE video_code = ? AND platform = ?
        ORDER BY recorded_at DESC LIMIT 1
      `).get(carousel.videoCode, carousel.platform) as { views: number; likes: number; saves: number; shares: number; comments: number } | undefined;

      // Get average metrics for same platform + archetype
      const avgRows = sqlite.prepare(`
        SELECT AVG(pm.saves * 1.0 / CASE WHEN pm.views > 0 THEN pm.views ELSE 1 END) as avg_save_rate,
               AVG(pm.shares * 1.0 / CASE WHEN pm.views > 0 THEN pm.views ELSE 1 END) as avg_share_rate,
               AVG((pm.likes + pm.comments + pm.saves + pm.shares) * 1.0 / CASE WHEN pm.views > 0 THEN pm.views ELSE 1 END) as avg_engagement_rate,
               COUNT(*) as sample_size
        FROM generated_carousels gc
        JOIN performance_metrics pm ON pm.video_code = gc.video_code AND pm.platform = gc.platform
        WHERE gc.platform = ? AND gc.status = 'completed' AND pm.views > 50
      `).get(carousel.platform) as { avg_save_rate: number; avg_share_rate: number; avg_engagement_rate: number; sample_size: number };

      const views = metrics?.views || 0;
      const saveRate = views > 0 ? (metrics?.saves || 0) / views : 0;
      const shareRate = views > 0 ? (metrics?.shares || 0) / views : 0;
      const engagementRate = views > 0 ? ((metrics?.likes || 0) + (metrics?.comments || 0) + (metrics?.saves || 0) + (metrics?.shares || 0)) / views : 0;
      const compositeScore = saveRate * 0.4 + shareRate * 0.3 + engagementRate * 0.2;

      const avgComposite = (avgRows?.avg_save_rate || 0) * 0.4 + (avgRows?.avg_share_rate || 0) * 0.3 + (avgRows?.avg_engagement_rate || 0) * 0.2;

      // AI analysis
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const slideTexts = slides.map((s, i) => `Slide ${i + 1} (${(s as Record<string, unknown>).slideType || "content"}): ${(s as Record<string, unknown>).heading || ""} — ${(s as Record<string, unknown>).bodyText || ""}`).join("\n");

      const prompt = `Analyze this carousel's performance and give actionable improvements.

CAROUSEL:
Platform: ${carousel.platform}
Hook: "${carousel.hookLine}"
Topic: "${carousel.ideaTopic}"
Archetype: ${(carousel as Record<string, unknown>).hookArchetype || "unknown"}
Slides:
${slideTexts}

PERFORMANCE:
This carousel: composite score ${(compositeScore * 100).toFixed(2)}%
  - Save rate: ${(saveRate * 100).toFixed(2)}%
  - Share rate: ${(shareRate * 100).toFixed(2)}%
  - Engagement rate: ${(engagementRate * 100).toFixed(2)}%
  - Views: ${views}

Platform average: composite ${(avgComposite * 100).toFixed(2)}% (sample: ${avgRows?.sample_size || 0})
Delta: ${compositeScore > avgComposite ? "+" : ""}${((compositeScore - avgComposite) * 100).toFixed(2)}%

${metrics ? "" : "NOTE: No metrics data found yet. Provide general analysis based on content quality."}

Return JSON:
{
  "verdict": "overperformer" | "average" | "underperformer",
  "strengths": ["2-3 things that worked well"],
  "weaknesses": ["2-3 things that could improve"],
  "improvements": [
    {"slideIndex": 0, "original": "current text", "suggested": "improved text", "reason": "why this is better"}
  ]
}

Focus on: hook strength, content flow, comprehension (readability), CTA effectiveness, slide count for platform.
Return ONLY JSON.`;

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = (msg.content[0] as { text: string }).text.trim();
      const cleaned = extractJson(raw);
      const analysis = JSON.parse(cleaned);

      res.json({
        carouselId,
        compositeScore: Math.round(compositeScore * 10000) / 10000,
        averageScore: Math.round(avgComposite * 10000) / 10000,
        delta: Math.round((compositeScore - avgComposite) * 10000) / 10000,
        metrics: metrics || null,
        sampleSize: avgRows?.sample_size || 0,
        ...analysis,
      });
    } catch (err) {
      console.error("[carousels] autopsy error:", err);
      res.status(500).json({ error: "Failed to generate autopsy" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 5: Trend Pulse — Live trending carousel topics from niche
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/carousels/trending/refresh — Trigger n8n Carousel Trend Scanner workflow, then ingest results
  router.post("/trending/refresh", async (req, res) => {
    try {
      const n8nUrl = process.env.N8N_URL || "https://n8n.srv1290877.hstgr.cloud";
      const n8nApiKey = process.env.N8N_API_KEY;

      // Invalidate both trending cache AND raw seed data so next GET does a full fresh scan
      sqlite.prepare("DELETE FROM research_reports WHERE type = 'carousel_trending'").run();
      sqlite.prepare("DELETE FROM research_reports WHERE type = 'carousel_trending_raw'").run();

      // Try triggering n8n webhook
      const webhookUrl = `${n8nUrl}/webhook/carousel-trends`;
      let n8nResult: Record<string, unknown> | null = null;
      try {
        const n8nRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "dashboard_refresh", timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(120000),
        });
        if (n8nRes.ok) {
          n8nResult = await n8nRes.json() as Record<string, unknown>;
          // If n8n returned trend data directly, cache it
          if (n8nResult && (n8nResult.trends || Array.isArray(n8nResult))) {
            const trendsData = Array.isArray(n8nResult) ? { trends: n8nResult, source: "n8n_carousel_trend_scanner" } : n8nResult;
            sqlite.prepare(
              "INSERT INTO research_reports (type, data) VALUES (?, ?)"
            ).run("carousel_trending", JSON.stringify(trendsData));
            res.json({ ok: true, source: "n8n_workflow", trendCount: (trendsData as { trends?: unknown[] }).trends?.length || 0 });
            return;
          }
        }
      } catch {
        // n8n not available, fall through to direct refresh
      }

      // Fallback: trigger direct refresh by clearing cache (next GET will regenerate)
      res.json({ ok: true, source: "cache_cleared", message: "Cache cleared. Next trending request will fetch fresh data." });
    } catch (err) {
      console.error("[carousels] trending refresh error:", err);
      res.status(500).json({ error: "Failed to refresh trends" });
    }
  });

  // POST /api/carousels/trending/seed — Ingest real social data (called by CLI/automation with Xpoz data)
  router.post("/trending/seed", (req, res) => {
    try {
      const { posts } = req.body as {
        posts: Array<{
          platform: string;
          username: string;
          caption: string;
          likeCount: number;
          commentCount: number;
          createdAt: string;
          postType?: string;
          collectCount?: number;
          playCount?: number;
          postUrl?: string;
          thumbnailUrl?: string;
          imageUrl?: string; // Xpoz field name alias
          codeUrl?: string;  // Xpoz field name alias for postUrl
        }>;
      };
      if (!posts?.length) { res.status(400).json({ error: "posts array required" }); return; }

      // Normalize Xpoz field names: codeUrl → postUrl, imageUrl → thumbnailUrl
      const normalized = posts.map((p) => ({
        ...p,
        postUrl: p.postUrl || p.codeUrl || undefined,
        thumbnailUrl: p.thumbnailUrl || p.imageUrl || undefined,
      }));

      // Store raw posts for the analysis step
      sqlite.prepare(
        "INSERT INTO research_reports (type, data) VALUES (?, ?)"
      ).run("carousel_trending_raw", JSON.stringify({ posts: normalized, seededAt: new Date().toISOString() }));

      // Invalidate any existing trend cache so next GET re-analyzes
      sqlite.prepare(
        "DELETE FROM research_reports WHERE type = 'carousel_trending'"
      ).run();

      res.json({ ok: true, postsIngested: posts.length });
    } catch (err) {
      console.error("[carousels] trending seed error:", err);
      res.status(500).json({ error: "Failed to seed trending data" });
    }
  });

  router.get("/trending", async (_req, res) => {
    try {
      // Check cache first (6 hour TTL)
      const cached = sqlite.prepare(
        "SELECT data, created_at FROM research_reports WHERE type = 'carousel_trending' AND created_at > datetime('now', '-6 hours') ORDER BY created_at DESC LIMIT 1"
      ).get() as { data: string; created_at: string } | undefined;

      if (cached) {
        res.json(JSON.parse(cached.data));
        return;
      }

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Step 1: Check if we have seeded real social data to analyze
      const rawData = sqlite.prepare(
        "SELECT data FROM research_reports WHERE type = 'carousel_trending_raw' ORDER BY created_at DESC LIMIT 1"
      ).get() as { data: string } | undefined;

      let trendsData: { trends: unknown[] } | null = null;

      if (rawData) {
        // Analyze REAL social data from Xpoz seed
        const { posts } = JSON.parse(rawData.data) as {
          posts: Array<{ platform: string; username: string; caption: string; likeCount: number; commentCount: number; collectCount?: number; playCount?: number; postUrl?: string; thumbnailUrl?: string }>;
        };

        // Sort by engagement and pick top performers
        const sorted = [...posts]
          .map((p) => ({ ...p, engagement: (p.likeCount || 0) + (p.commentCount || 0) * 3 + (p.collectCount || 0) * 5 }))
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 15);

        // Build a lookup of source posts for enrichment after analysis
        const postLookup = new Map<string, { postUrl?: string; thumbnailUrl?: string; username: string; platform: string }>();
        for (const p of sorted) {
          postLookup.set(p.username.toLowerCase(), { postUrl: p.postUrl, thumbnailUrl: p.thumbnailUrl, username: p.username, platform: p.platform });
        }

        const analysisPrompt = `Analyze these REAL social media posts from Instagram and TikTok (sorted by engagement) and extract 6 carousel-worthy trending topics for a chiropractic practice.

REAL POSTS DATA:
${sorted.map((p, i) => `${i + 1}. [${p.platform}] @${p.username} (${p.likeCount} likes, ${p.commentCount} comments${p.collectCount ? `, ${p.collectCount} saves` : ""}${p.playCount ? `, ${p.playCount} plays` : ""})${p.postUrl ? ` URL: ${p.postUrl}` : ""}
"${p.caption.slice(0, 200)}"`).join("\n\n")}

For each topic you identify from this REAL data, return:
{
  "trends": [
    {
      "topic": "specific carousel topic derived from what's actually performing",
      "hookLine": "scroll-stopping hook for this topic",
      "archetype": "teacher|contrarian|fortuneteller|experimenter|magician|investigator",
      "audience": "best audience segment",
      "platform": "instagram|tiktok|linkedin",
      "aspectRatio": "4:5|1:1|9:16",
      "proof": "Based on real post by @username with X likes (cite actual data above)",
      "engagementSignal": "high|medium",
      "creatorHandle": "the @username of the source post (without @)",
      "postUrl": "the URL of the source post if available, or null",
      "thumbnailUrl": null
    }
  ]
}

RULES:
- Extract REAL topics from the actual posts above, not imagined ones
- "proof" MUST reference the real post data (username, engagement numbers)
- "creatorHandle" MUST be the exact username from the post data above
- "postUrl" MUST be the exact URL from the post data if provided, null otherwise
- Mark as "high" if the source post had 1000+ likes or 100+ comments
- Adapt topics for chiropractic/wellness niche if needed
- Return ONLY the JSON object.`;

        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: analysisPrompt }],
        });
        const raw = (msg.content[0] as { text: string }).text.trim();
        const parsed = JSON.parse(extractJson(raw));
        trendsData = Array.isArray(parsed) ? { trends: parsed } : parsed;

        // Enrich trends with post URLs and thumbnails
        if (trendsData?.trends) {
          const trendThumbDir = path.join(carouselImagesDir, "trending-thumbnails");
          if (!fs.existsSync(trendThumbDir)) fs.mkdirSync(trendThumbDir, { recursive: true });

          for (const [idx, trend] of (trendsData.trends as Array<Record<string, unknown>>).entries()) {
            const handle = String(trend.creatorHandle || "").toLowerCase();
            const source = postLookup.get(handle);

            // Fill in postUrl from seeded data if AI didn't return it
            if (!trend.postUrl && source?.postUrl) trend.postUrl = source.postUrl;

            // Try to download thumbnail from seeded CDN URL (works for TikTok, may fail for IG)
            const thumbUrl = source?.thumbnailUrl as string | undefined;
            if (thumbUrl) {
              try {
                const filename = `trend-${idx}.jpg`;
                const filepath = path.join(trendThumbDir, filename);
                const resp = await fetch(thumbUrl, {
                  signal: AbortSignal.timeout(10000),
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": "https://www.instagram.com/",
                  },
                });
                if (resp.ok) {
                  const buffer = Buffer.from(await resp.arrayBuffer());
                  if (buffer.length > 500) {
                    fs.writeFileSync(filepath, buffer);
                    trend.thumbnailUrl = `/carousel-images/trending-thumbnails/${filename}`;
                    continue;
                  }
                }
              } catch { /* download failed */ }
            }

            // Fallback for TikTok: try oEmbed
            if (trend.postUrl && String(trend.platform).includes("tiktok")) {
              try {
                const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(String(trend.postUrl))}`;
                const oRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
                if (oRes.ok) {
                  const oData = await oRes.json() as { thumbnail_url?: string };
                  if (oData.thumbnail_url) {
                    const filename = `trend-${idx}.jpg`;
                    const filepath = path.join(trendThumbDir, filename);
                    const imgRes = await fetch(oData.thumbnail_url, { signal: AbortSignal.timeout(10000) });
                    if (imgRes.ok) {
                      const buffer = Buffer.from(await imgRes.arrayBuffer());
                      if (buffer.length > 500) {
                        fs.writeFileSync(filepath, buffer);
                        trend.thumbnailUrl = `/carousel-images/trending-thumbnails/${filename}`;
                        continue;
                      }
                    }
                  }
                }
              } catch { /* oEmbed failed */ }
            }

            // Pass engagement data to frontend for rich placeholder rendering
            if (source) {
              trend.sourceEngagement = {
                likes: (sorted.find(p => p.username.toLowerCase() === handle) as Record<string, unknown> | undefined)?.likeCount || 0,
                comments: (sorted.find(p => p.username.toLowerCase() === handle) as Record<string, unknown> | undefined)?.commentCount || 0,
              };
            }
            if (!trend.thumbnailUrl) trend.thumbnailUrl = null;
          }
        }

        if (trendsData) (trendsData as Record<string, unknown>).source = "xpoz_real_data";
      }

      // Step 2: If no seeded data, use Claude web search to find real trends
      if (!trendsData) {
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          tools: [{
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          }],
          messages: [{
            role: "user",
            content: `Search Instagram and TikTok for the most popular chiropractic, posture, back pain, and wellness posts from the last 2 weeks. Find posts with high engagement (likes, saves, shares).

Then extract 6 carousel-worthy trending topics for a chiropractic practice based on what you find.

Return ONLY a JSON object:
{
  "trends": [
    {
      "topic": "specific topic from real trending content",
      "hookLine": "scroll-stopping hook",
      "archetype": "teacher|contrarian|fortuneteller|experimenter|magician|investigator",
      "audience": "best audience segment",
      "platform": "instagram|tiktok|linkedin",
      "aspectRatio": "4:5|1:1|9:16",
      "proof": "why this is trending with real source data",
      "engagementSignal": "high|medium",
      "creatorHandle": "username of the source creator (without @)",
      "postUrl": "direct URL to the source post if you can find it, or null",
      "thumbnailUrl": null
    }
  ]
}

CRITICAL: Base trends on REAL posts you find via web search, not imagined content. Cite actual creators/posts in the "proof" field. Include the post URL when you find one.`,
          }],
        });

        let responseText = "";
        for (const block of msg.content) {
          if (block.type === "text") responseText += block.text;
        }

        try {
          const parsed = JSON.parse(extractJson(responseText.trim()));
          trendsData = Array.isArray(parsed) ? { trends: parsed } : parsed;
          if (trendsData) (trendsData as Record<string, unknown>).source = "web_search";
        } catch {
          // Final fallback: basic Claude generation
          trendsData = null;
        }
      }

      // Step 3: Fallback if web search also failed
      if (!trendsData) {
        const fallbackMsg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          messages: [{ role: "user", content: `Generate 6 trending carousel topics for a chiropractic practice based on current social media wellness trends. Return JSON: {"trends": [{"topic": "...", "hookLine": "...", "archetype": "teacher|contrarian|fortuneteller|experimenter|magician|investigator", "audience": "...", "platform": "instagram|tiktok|linkedin", "aspectRatio": "4:5|1:1|9:16", "proof": "...", "engagementSignal": "high|medium"}]}. Return ONLY the JSON.` }],
        });
        const raw = (fallbackMsg.content[0] as { text: string }).text.trim();
        const parsed = JSON.parse(extractJson(raw));
        trendsData = Array.isArray(parsed) ? { trends: parsed } : parsed;
        if (trendsData) (trendsData as Record<string, unknown>).source = "ai_generated";
      }

      // Cache the result
      sqlite.prepare(
        "INSERT INTO research_reports (type, data) VALUES (?, ?)"
      ).run("carousel_trending", JSON.stringify(trendsData));

      res.json(trendsData);
    } catch (err) {
      console.error("[carousels] trending error:", err);
      res.status(500).json({ error: "Failed to fetch trending topics" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 6: Slide-Level A/B Variants
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/:id/slides/:slideIndex/variants", async (req, res) => {
    try {
      const carouselId = parseInt(req.params.id, 10);
      const slideIndex = parseInt(req.params.slideIndex, 10);

      // Get carousel context
      const rows = db.select().from(generatedCarousels).where(eq(generatedCarousels.id, carouselId)).limit(1).all();
      if (rows.length === 0) { res.status(404).json({ error: "Carousel not found" }); return; }
      const carousel = rows[0];

      // Get the specific slide
      const slide = sqlite.prepare(
        "SELECT * FROM carousel_slides WHERE carousel_id = ? AND slide_index = ?"
      ).get(carouselId, slideIndex) as { heading: string; body_text: string; slide_type: string } | undefined;

      if (!slide) { res.status(404).json({ error: "Slide not found" }); return; }

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = `Generate 3 alternative versions of this carousel slide, each using a different persuasion angle.

CURRENT SLIDE (${slide.slide_type}, index ${slideIndex}):
Heading: "${slide.heading || ""}"
Body: "${slide.body_text || ""}"

CAROUSEL CONTEXT:
Topic: "${carousel.ideaTopic}"
Hook: "${carousel.hookLine}"
Platform: ${carousel.platform}
Archetype: ${(carousel as Record<string, unknown>).hookArchetype || "teacher"}

Generate 3 variants with different angles:
1. Emotional — connects through feeling, empathy, personal experience
2. Data-driven — leads with a specific number, stat, or research finding
3. Contrarian — challenges an assumption, flips a common belief

Return JSON:
[
  {"angle": "emotional", "heading": "new heading", "bodyText": "new body"},
  {"angle": "data-driven", "heading": "new heading", "bodyText": "new body"},
  {"angle": "contrarian", "heading": "new heading", "bodyText": "new body"}
]

RULES:
- Same topic, completely different framing
- Match platform word limits (${carousel.platform === "tiktok" ? "ultra short" : "standard"})
- Sentence fragments, not full sentences
- No emdashes
- Return ONLY the JSON array.`;

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = (msg.content[0] as { text: string }).text.trim();
      const cleaned = extractJson(raw);
      const variants = JSON.parse(cleaned);

      res.json({ slideIndex, currentHeading: slide.heading, currentBody: slide.body_text, variants });
    } catch (err) {
      console.error("[carousels] slide variants error:", err);
      res.status(500).json({ error: "Failed to generate variants" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE 7: Competitor Carousel Watch — Monitor accounts
  // ═══════════════════════════════════════════════════════════════════════════

  // Add/list/remove watched accounts
  router.get("/watch/accounts", (_req, res) => {
    try {
      const accounts = sqlite.prepare("SELECT * FROM carousel_watch_accounts ORDER BY created_at DESC").all();
      res.json(accounts);
    } catch (err) {
      console.error("[carousels] watch accounts error:", err);
      res.status(500).json({ error: "Failed to fetch watched accounts" });
    }
  });

  router.post("/watch/accounts", (req, res) => {
    try {
      const { platform, handle, displayName } = req.body as { platform: string; handle: string; displayName?: string };
      if (!platform || !handle) { res.status(400).json({ error: "platform and handle required" }); return; }

      const cleanHandle = handle.replace(/^@/, "");
      sqlite.prepare(
        "INSERT OR IGNORE INTO carousel_watch_accounts (platform, handle, display_name) VALUES (?, ?, ?)"
      ).run(platform, cleanHandle, displayName || null);

      const account = sqlite.prepare(
        "SELECT * FROM carousel_watch_accounts WHERE platform = ? AND handle = ?"
      ).get(platform, cleanHandle);

      res.json(account);
    } catch (err) {
      console.error("[carousels] add watch account error:", err);
      res.status(500).json({ error: "Failed to add watch account" });
    }
  });

  router.delete("/watch/accounts/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      sqlite.prepare("DELETE FROM carousel_watch_accounts WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      console.error("[carousels] delete watch account error:", err);
      res.status(500).json({ error: "Failed to delete watch account" });
    }
  });

  // Get watched posts feed
  router.get("/watch/feed", (_req, res) => {
    try {
      const posts = sqlite.prepare(`
        SELECT wp.*, wa.handle, wa.platform as account_platform, wa.display_name
        FROM carousel_watch_posts wp
        JOIN carousel_watch_accounts wa ON wa.id = wp.account_id
        ORDER BY wp.fetched_at DESC
        LIMIT 50
      `).all();

      // Parse analysis JSON
      const mapped = (posts as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        analysis: p.analysis_json ? JSON.parse(p.analysis_json as string) : null,
      }));

      res.json(mapped);
    } catch (err) {
      console.error("[carousels] watch feed error:", err);
      res.status(500).json({ error: "Failed to fetch watch feed" });
    }
  });

  // Manually trigger a scan for a watched account (stores posts in DB)
  router.post("/watch/accounts/:id/scan", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id, 10);
      const account = sqlite.prepare("SELECT * FROM carousel_watch_accounts WHERE id = ?").get(accountId) as {
        id: number; platform: string; handle: string;
      } | undefined;

      if (!account) { res.status(404).json({ error: "Account not found" }); return; }

      // Use Anthropic web search to find recent posts
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const searchPrompt = `Find the 5 most recent carousel posts by @${account.handle} on ${account.platform}. For each post, provide:

Return JSON array:
[
  {
    "postUrl": "full URL to the post",
    "caption": "first 100 chars of caption",
    "thumbnailUrl": "thumbnail image URL if available, null otherwise",
    "estimatedLikes": number or 0,
    "estimatedComments": number or 0,
    "hookTechnique": "listicle|myth|stat|story|contrarian|quick-win",
    "contentFlow": "brief description of the carousel structure"
  }
]

Only include carousel/multi-image posts, not single images or videos.
If you can't find carousel posts, return an empty array [].
Return ONLY the JSON array.`;

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        }],
        messages: [{ role: "user", content: searchPrompt }],
      });

      // Extract text from the response (may have tool use blocks)
      let responseText = "";
      for (const block of msg.content) {
        if (block.type === "text") responseText += block.text;
      }

      let posts: Array<Record<string, unknown>> = [];
      try {
        posts = JSON.parse(extractJson(responseText.trim()));
        if (!Array.isArray(posts)) posts = [];
      } catch {
        posts = [];
      }

      let inserted = 0;
      for (const post of posts) {
        if (!post.postUrl) continue;
        try {
          sqlite.prepare(`
            INSERT OR IGNORE INTO carousel_watch_posts (account_id, post_url, platform, thumbnail_url, caption, likes, comments, analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            accountId, post.postUrl, account.platform,
            post.thumbnailUrl || null, post.caption || null,
            post.estimatedLikes || 0, post.estimatedComments || 0,
            JSON.stringify({ hookTechnique: post.hookTechnique, contentFlow: post.contentFlow }),
          );
          inserted++;
        } catch {
          // Duplicate URL, skip
        }
      }

      res.json({ account: account.handle, postsFound: posts.length, postsInserted: inserted });
    } catch (err) {
      console.error("[carousels] watch scan error:", err);
      res.status(500).json({ error: "Failed to scan account" });
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
