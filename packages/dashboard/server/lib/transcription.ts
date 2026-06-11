/**
 * Shared transcription helpers.
 *
 * Extracted from the closure-scoped copies in routes/creator-videos.ts and
 * routes/video-analysis.ts so the media transcript queue (and future callers)
 * can reuse them. Two paths:
 *
 *   1. fetchCaptionsViaYtDlp(url)  — free. Pulls native/auto subtitles with
 *      yt-dlp, parses + dedupes the VTT (YouTube auto-subs emit every line
 *      2-3x as rolling cues), returns plain text. Returns null when the
 *      source has no captions.
 *   2. whisperTranscribe(mediaPath) — paid fallback. Extracts mono 64kbps mp3
 *      (keeps hour-long audio under Whisper's 25MB limit) and sends it to
 *      OpenAI whisper-1. Distinguishes "no key configured" from real failures
 *      so queue status reporting stays honest.
 *
 * yt-dlp invocation: the PATH binary first (`yt-dlp`), `python3 -m yt_dlp` as
 * fallback. Note the rest of the codebase (video-downloader.ts) historically
 * used only the python-module form, which is broken when python3 has no
 * yt_dlp module installed — the binary-first order here is deliberate.
 *
 * NOTE: the whisper-1 helper here duplicates the closure-scoped copies still
 * living in routes/creator-videos.ts and routes/video-analysis.ts. Those were
 * NOT yet refactored to import this — consolidation is pending. This copy adds
 * a richer failure taxonomy (no_key / extract_failed / api_failed) the queue
 * relies on for honest status reporting.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

/**
 * ffmpeg binary preference: system ffmpeg on PATH first (signed; macOS
 * Gatekeeper SIGKILLs the unsigned ffmpeg-static npm binary on its first
 * spawn from a non-blessed process), ffmpeg-static as fallback.
 */
let ffmpegConfigured: Promise<void> | null = null;

function ensureFfmpegConfigured(): Promise<void> {
  if (!ffmpegConfigured) {
    ffmpegConfigured = new Promise((resolve) => {
      execFile("ffmpeg", ["-version"], { timeout: 5_000 }, (err) => {
        if (err && ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
        // else: leave fluent-ffmpeg on the PATH binary
        resolve();
      });
    });
  }
  return ffmpegConfigured;
}

// ── yt-dlp invocation (binary first, python module fallback) ────────────────

type YtDlpInvocation = { cmd: string; baseArgs: string[] };

let cachedInvocation: YtDlpInvocation | null = null;

function execFileP(cmd: string, args: string[], opts: { timeoutMs: number }): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: opts.timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const rawCode = err ? (err as { code?: number | string }).code : 0;
      const code = typeof rawCode === "number" ? rawCode : err ? 1 : 0;
      resolve({ stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "", code });
    });
  });
}

/**
 * Resolve a working yt-dlp invocation. SUCCESS is cached for the process
 * lifetime; failures are NOT cached, so a transient first-probe failure (e.g.
 * a slow boot before brew's PATH is ready) doesn't permanently disable yt-dlp.
 */
export async function resolveYtDlp(): Promise<YtDlpInvocation | null> {
  if (cachedInvocation) return cachedInvocation;
  const candidates: YtDlpInvocation[] = [
    { cmd: "yt-dlp", baseArgs: [] },
    { cmd: "python3", baseArgs: ["-m", "yt_dlp"] },
  ];
  for (const c of candidates) {
    const { code } = await execFileP(c.cmd, [...c.baseArgs, "--version"], { timeoutMs: 8_000 });
    if (code === 0) {
      cachedInvocation = c;
      return c;
    }
  }
  return null;
}

// ── VTT parsing + dedupe ─────────────────────────────────────────────────────

/**
 * Parse a WebVTT file into deduped plain text.
 *
 * YouTube auto-generated subtitles emit rolling cues — each line appears 2-3
 * times, and successive cues often extend the previous one by a few words.
 * Without dedupe the stored transcript is ~3x bloated, which wrecks token
 * budgets. Two rules, ported from the /watch skill's transcribe.py:
 *   - drop a cue identical to the previous cue
 *   - when a cue starts with the previous cue's text, keep only the extension
 */
export function vttToPlainText(vttContent: string): string {
  const lines = vttContent.split("\n");
  const cues: string[] = [];
  let inCue = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.includes("-->")) {
      inCue = true;
      continue;
    }
    if (line === "" || line === "WEBVTT" || /^\d+$/.test(line) || line.startsWith("NOTE") || line.startsWith("Kind:") || line.startsWith("Language:") || line.startsWith("STYLE")) {
      inCue = false;
      continue;
    }
    if (!inCue) continue;

    // Strip inline tags like <00:00:01.000> and <c>...</c>
    const text = line.replace(/<[^>]*>/g, "").trim();
    if (!text) continue;

    const prev = cues[cues.length - 1];
    if (prev === text) continue;                      // exact rolling duplicate
    if (prev && text.startsWith(prev)) {              // prefix extension — replace
      cues[cues.length - 1] = text;
      continue;
    }
    if (prev && prev.endsWith(text)) continue;        // suffix already captured
    cues.push(text);
  }

  return cues.join(" ").replace(/\s+/g, " ").trim();
}

// ── Captions-first transcript fetch ─────────────────────────────────────────

/**
 * Try to fetch native or auto-generated captions for a URL via yt-dlp.
 * Returns plain transcript text, or null if no captions exist / yt-dlp missing.
 *
 * yt-dlp subtitle runs frequently exit non-zero even on success (429s on
 * subtitle variants) — so the exit code is ignored and success is judged by
 * whether a .vtt landed on disk.
 */
export async function fetchCaptionsViaYtDlp(url: string): Promise<string | null> {
  const invocation = await resolveYtDlp();
  if (!invocation) return null;

  const tmpDir = path.join(os.tmpdir(), `ce-captions-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await execFileP(invocation.cmd, [
      ...invocation.baseArgs,
      "--skip-download",
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs", "en,en-US,en-GB,en-orig",
      "--sub-format", "vtt",
      "--convert-subs", "vtt",
      "--no-playlist",
      "--ignore-errors",
      "--no-warnings",
      "-o", path.join(tmpDir, "video.%(ext)s"),
      "--",          // end-of-options: a URL beginning with '-' can't be read as a flag
      url,
    ], { timeoutMs: 120_000 });

    const vttFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".vtt"));
    if (vttFiles.length === 0) return null;

    // Prefer plain ".en" over regional/orig variants
    vttFiles.sort((a, b) => {
      const score = (f: string) => (f.includes(".en.") ? 0 : f.includes(".en-orig.") ? 2 : 1);
      return score(a) - score(b);
    });

    const content = fs.readFileSync(path.join(tmpDir, vttFiles[0]), "utf-8");
    const text = vttToPlainText(content);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── Whisper fallback ─────────────────────────────────────────────────────────

export type WhisperResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no_key" | "empty_audio" | "extract_failed" | "api_failed"; detail?: string };

/** Extract mono 64kbps mp3 from any audio/video file. ~470KB/min keeps long media under Whisper's 25MB cap. */
async function extractAudioMp3(mediaPath: string): Promise<string> {
  await ensureFfmpegConfigured();
  const audioPath = `${mediaPath}.audio.mp3`;
  return new Promise((resolve, reject) => {
    ffmpeg(mediaPath)
      .outputOptions(["-vn", "-ac", "1", "-ab", "64k", "-f", "mp3"])
      .output(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Transcribe an audio or video file via OpenAI whisper-1.
 * Reads OPENAI_API_KEY lazily (env is loaded after module imports in index.ts).
 */
export async function whisperTranscribe(mediaPath: string): Promise<WhisperResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { ok: false, reason: "no_key" };

  let audioPath: string | null = null;
  try {
    try {
      audioPath = await extractAudioMp3(mediaPath);
    } catch (err) {
      return { ok: false, reason: "extract_failed", detail: err instanceof Error ? err.message : String(err) };
    }

    const stat = fs.statSync(audioPath);
    if (stat.size < 1024) return { ok: false, reason: "empty_audio" };

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: openaiKey });
      const result = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(audioPath) as unknown as File,
      });
      const text = (result.text ?? "").trim();
      if (!text) return { ok: false, reason: "api_failed", detail: "whisper returned empty text" };
      return { ok: true, text };
    } catch (err) {
      return { ok: false, reason: "api_failed", detail: err instanceof Error ? err.message : String(err) };
    }
  } finally {
    if (audioPath) {
      try { fs.unlinkSync(audioPath); } catch { /* already gone */ }
    }
  }
}
