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

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function extractFrames(videoPath: string, outputDir: string, intervalSeconds = 2): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, "frame_%04d.jpg");

    ffmpeg(videoPath)
      .outputOptions([
        `-vf`, `fps=1/${intervalSeconds},scale=810:1440:force_original_aspect_ratio=decrease`,
        `-q:v`, `3`,
      ])
      .output(outputPattern)
      .on("end", () => {
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

function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(["-vn", "-ac", "1", "-ab", "64k", "-f", "mp3"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .run();
  });
}

async function transcribeAudio(videoPath: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  const audioPath = videoPath + ".audio.mp3";
  try {
    // Extract audio track as small MP3 (mono 64kbps, ~550KB per minute)
    console.log("[video-analysis] Extracting audio track...");
    await extractAudio(videoPath, audioPath);

    const audioSize = fs.statSync(audioPath).size;
    console.log(`[video-analysis] Audio extracted: ${(audioSize / 1024).toFixed(0)}KB`);
    if (audioSize < 1024) {
      console.log("[video-analysis] Audio too small, likely silent video");
      return null;
    }

    console.log("[video-analysis] Starting Whisper transcription...");
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: openaiKey });
    const fileStream = fs.createReadStream(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fileStream as unknown as File,
    });
    return transcription.text || null;
  } catch (err) {
    console.warn("[video-analysis] Whisper transcription failed:", err);
    return null;
  } finally {
    try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch { /* cleanup */ }
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
      const startTime = Date.now();
      console.log(`[video-analysis] File received: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

      // Probe duration to pick smart frame interval
      let interval = 2;
      try {
        const duration = await getVideoDuration(file.path);
        console.log(`[video-analysis] Video duration: ${duration.toFixed(1)}s`);
        if (duration > 30) interval = Math.ceil(duration / 10); // ~10 frames max
      } catch { /* use default 2s */ }

      // Extract frames + transcribe in parallel
      console.log(`[video-analysis] Extracting frames (interval=${interval}s)...`);
      const extractStart = Date.now();
      const [framePaths, transcript] = await Promise.all([
        extractFrames(file.path, framesDir, interval),
        transcribeAudio(file.path),
      ]);
      console.log(`[video-analysis] Frames extracted: ${framePaths.length} (${Date.now() - extractStart}ms)`);
      if (transcript) console.log(`[video-analysis] Transcript: ${transcript.slice(0, 100)}...`);
      else console.log("[video-analysis] No transcript (Whisper skipped or failed)");

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

      // Build Claude vision message with frames as base64 images (max 10)
      const selectedFrames = framePaths.slice(0, 10);
      console.log(`[video-analysis] Sending ${selectedFrames.length} frames to Claude Sonnet...`);
      const imageContent: Anthropic.ImageBlockParam[] = selectedFrames.map((fp) => {
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

      const analysisPrompt = `Analyze this video for social media captioning. You have ${selectedFrames.length} extracted frames and ${transcript ? "an audio transcript" : "no audio"}.
${practiceContext}
${transcript ? `\nAUDIO TRANSCRIPT: "${transcript}"` : "\n(No audio transcript available)"}
${videoContext}

ANALYSIS APPROACH:
- The transcript is your PRIMARY source for understanding what this video is about, its tone, and purpose
- Use the frames to identify people, settings, and visual details that support the audio
- Determine the content type: skit, educational, testimonial, behind-the-scenes, trend, etc.
- Think about what emotional loop this video opens and how a caption can amplify that

TARGET PLATFORMS: ${platformList.join(", ")}

Respond with a JSON object:
{
  "visualDescription": "3-4 sentence summary. Focus on the narrative/concept and vibe, not frame-by-frame. Who's in it, where, what's the energy.",
  "mood": "One word (energetic, calming, educational, humorous, authentic, chaotic, wholesome, etc.)",
  "hookSuggestions": ["5 hooks that use the ZEIGARNIK EFFECT - open a curiosity loop the viewer MUST resolve by watching. Use incomplete information, unexpected contrast, or imply something happened. NEVER describe or summarize the video. BAD: 'Watch our team react to a box delivery' GOOD: 'She had no idea what was about to hit her.' Keep under 10 words each."],
  "captionSuggestions": {
    "instagram_reels": "2-3 lines. Start with a mirror (describe the viewer's world), then the shift (what this video shows). End with a coupled CTA that connects to THIS specific content. Add 3-5 hashtags at end. Voice: warm, real, like texting a friend.",
    "tiktok": "1 line MAX. Raw, unfiltered, chaotic energy if the video is funny. No hashtags. No explanation. Let the video speak. Think: what would the person in this video actually type?",
    "youtube_shorts": "Title that's a curiosity gap AND contains searchable keywords. One-line description that mirrors the viewer's situation. Not clickbait - a genuine open loop.",
    "youtube_long": "3-4 sentences using the micro story arc: Mirror their situation → surface the friction → show the shift this video represents → invite them to engage. Include natural keywords."
  },
  "ctaSuggestion": "ONE call-to-action that is tightly coupled to this specific video's content. It should close the loop the video opens. Never generic like 'follow for more' or 'book now'. Connect it to the actual moment or story in the video.",
  "hashtagSuggestions": ["10-12 hashtags: 2-3 broad reach (500K+ posts), 3-4 niche community, 2-3 content-type, 2-3 culture/trending"],
  "waterfallIdeas": ["2-3 specific ideas for repurposing this exact video into other content formats. Be specific: 'Pull the 0:14 reaction as a standalone TikTok with text overlay: ...' not generic advice."],
  "keyMoments": [{"timestamp": "0:05", "description": "Brief description"}],
  "transcript": "the transcript text if available, or null"
}

Only include platforms from the target list. Your response must be valid JSON only.`;

      const apiStart = Date.now();
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a social media strategist who understands storytelling psychology. Key principles you apply:

ZEIGARNIK EFFECT: The brain hates unfinished business. Every hook should open a loop - incomplete information that forces the viewer to watch. Never describe what happens in the video. Instead, imply a story the viewer needs to see resolved.

MICRO STORY ARC: Every caption follows: Mirror (where the viewer is) → Friction (the tension) → Shift (the payoff) → Invitation (coupled CTA). This is NOT a formula to follow literally - it's the emotional rhythm underneath.

COUPLED CTAs: A CTA must close the loop the content opened. "Follow for more" is dead. If the video is about a box hitting someone, the CTA connects to THAT moment, not to booking an appointment.

PLATFORM TRUTH: Each platform has a different native language. TikTok is raw and chaotic. Instagram is curated but real. YouTube is searchable. Never resize the same caption - write natively for each.

Write like a real creator with a personality, not a social media manager following a template. The captions should feel like they were written by the person in the video.`,
        messages: [{
          role: "user",
          content: [
            ...imageContent,
            { type: "text", text: analysisPrompt },
          ],
        }],
      }, { timeout: 180_000 });
      console.log(`[video-analysis] Claude API responded in ${Date.now() - apiStart}ms`);

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

      let analysis;
      try {
        analysis = JSON.parse(cleaned);
      } catch {
        console.error("[video-analysis] JSON parse failed. Raw response:", cleaned.slice(0, 500));
        res.status(500).json({ error: "AI response was incomplete. Try again." });
        return;
      }
      // Include transcript in response
      if (transcript && !analysis.transcript) {
        analysis.transcript = transcript;
      }

      console.log(`[video-analysis] Complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      res.json({ analysis });
    } catch (error) {
      const isTimeout = error instanceof Error && (error.message.includes("timeout") || error.message.includes("timed out"));
      const msg = isTimeout
        ? "AI analysis timed out. Try a shorter video or try again."
        : error instanceof Error ? error.message : "Video analysis failed";
      console.error("[video-analysis] Error:", error);
      res.status(isTimeout ? 504 : 500).json({ error: msg });
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
