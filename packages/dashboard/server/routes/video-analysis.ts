import fs from "fs";
import os from "os";
import path from "path";
import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { parseContentLibrary } from "../parsers/content-library.js";
import { FORMATS } from "../../shared/types.js";

// Set ffmpeg binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Configure multer for temp storage
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function extractFrames(videoPath: string, outputDir: string, intervalSeconds = 2): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const frames: string[] = [];
    const outputPattern = path.join(outputDir, "frame_%04d.jpg");

    ffmpeg(videoPath)
      .outputOptions([
        `-vf`, `fps=1/${intervalSeconds},scale=810:1440:force_original_aspect_ratio=decrease`,
        `-q:v`, `3`,
      ])
      .output(outputPattern)
      .on("end", () => {
        // Read extracted frames
        const files = fs.readdirSync(outputDir)
          .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
          .sort()
          .map((f) => path.join(outputDir, f));
        resolve(files);
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

async function transcribeAudio(videoPath: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: openaiKey });
    const fileStream = fs.createReadStream(videoPath);
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fileStream as unknown as File,
    });
    return transcription.text || null;
  } catch (err) {
    console.warn("[video-analysis] Whisper transcription failed:", err);
    return null;
  }
}

export function createVideoAnalysisRouter(contentLibraryPath: string) {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[video-analysis] ANTHROPIC_API_KEY not set.");
  }

  // POST /api/video-analysis/analyze
  router.post("/analyze", upload.single("video"), async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No video file uploaded" });
      return;
    }

    const videoCode = req.body.videoCode as string | undefined;
    const requestedPlatforms = req.body.platforms as string | undefined;
    const framesDir = path.join(os.tmpdir(), `ce-frames-${Date.now()}`);

    try {
      fs.mkdirSync(framesDir, { recursive: true });

      // Extract frames + transcribe in parallel
      const [framePaths, transcript] = await Promise.all([
        extractFrames(file.path, framesDir),
        transcribeAudio(file.path),
      ]);

      if (framePaths.length === 0) {
        res.status(400).json({ error: "Could not extract frames from video" });
        return;
      }

      // Always load practice context from config
      const configPath = contentLibraryPath.replace("content-library.md", "config.json");
      let practiceContext = "";
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        practiceContext = `\nPRACTICE CONTEXT: This video is for "${config.name}" - ${config.description} Content covers: ${(config.audiences as Array<{ label: string }>).map((a) => a.label).join(", ")}. Captions should reflect this practice's brand and audience.`;
      } catch { /* optional */ }

      // Build context from existing video data if videoCode provided
      let videoContext = "";
      if (videoCode) {
        try {
          const videos = parseContentLibrary(contentLibraryPath);
          const video = videos.find((v) => v.code === videoCode);
          if (video) {
            const formatInfo = FORMATS[video.format];
            videoContext = `\n\nEXISTING VIDEO CONTEXT:
Title: ${video.title}
Format: ${video.format} (${formatInfo?.name || ""})
Audience: ${video.audienceLabel}
Tags: ${video.tags.join(", ")}
Script: ${video.script.slice(0, 1000)}`;
          }
        } catch { /* optional context */ }
      }

      // Build Claude vision message with frames as base64 images
      const imageContent: Anthropic.ImageBlockParam[] = framePaths.slice(0, 20).map((fp) => {
        const data = fs.readFileSync(fp).toString("base64");
        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/jpeg" as const,
            data,
          },
        };
      });

      const platformList = requestedPlatforms
        ? requestedPlatforms.split(",").map((p) => p.trim())
        : ["instagram_reels", "tiktok", "youtube_shorts", "youtube_long"];

      const analysisPrompt = `Analyze this video (shown as ${framePaths.length} extracted frames at ~2s intervals) for social media captioning.
${practiceContext}
${transcript ? `\nAUDIO TRANSCRIPT: "${transcript}"` : "\n(No audio transcript available)"}
${videoContext}

IMPORTANT: Describe EXACTLY what you see in the frames. Note:
- Who appears (gender, clothing, setting)
- Any visible text on clothing, walls, signs, or equipment
- The physical environment (office type, medical equipment, decor)
- Actions being performed
- Mood and energy conveyed through body language
Do NOT guess what the video is about from a single detail. Look at ALL frames before forming your description.

TARGET PLATFORMS: ${platformList.join(", ")}

Respond with a JSON object containing:
{
  "visualDescription": "Detailed description of what's happening in the video based on what you actually see",
  "mood": "One word mood (energetic, calming, educational, humorous, authentic, personal, etc.)",
  "hookSuggestions": ["3-5 hook ideas based on the visual content"],
  "captionSuggestions": {
    "instagram_reels": "Full caption with hashtags",
    "tiktok": "Short punchy caption",
    "youtube_shorts": "SEO-friendly title/caption",
    "youtube_long": "Longer description with keywords"
  },
  "hashtagSuggestions": ["8-12 relevant hashtags with # prefix"],
  "keyMoments": [{"timestamp": "0:05", "description": "What happens"}],
  "transcript": "the transcript if available, or null"
}

Only include platforms from the target list. Your response must be valid JSON only.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 2048,
        system: "You are a social media content analyst. Describe EXACTLY what you see in the video frames - real people, settings, actions, visible text on clothing, equipment, etc. Do not guess or hallucinate details you cannot see. If unsure about something, say so. Your analysis will be used to write platform-specific captions.",
        messages: [{
          role: "user",
          content: [
            ...imageContent,
            { type: "text", text: analysisPrompt },
          ],
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No analysis response from AI" });
        return;
      }

      // Parse JSON response (strip code fences if present)
      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const analysis = JSON.parse(cleaned);
      // Include transcript in response
      if (transcript && !analysis.transcript) {
        analysis.transcript = transcript;
      }

      res.json({ analysis });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Video analysis failed";
      console.error("[video-analysis] Error:", msg);
      res.status(500).json({ error: msg });
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(framesDir)) {
          for (const f of fs.readdirSync(framesDir)) {
            fs.unlinkSync(path.join(framesDir, f));
          }
          fs.rmdirSync(framesDir);
        }
      } catch { /* cleanup is best-effort */ }
    }
  });

  return router;
}
