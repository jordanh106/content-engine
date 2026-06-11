import { execFile } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { resolveYtDlp } from "./transcription.js";

export interface DownloadResult {
  filePath: string;
  title: string;
  duration: number | null;
}

/**
 * Download a video from a URL using yt-dlp.
 * Supports YouTube, Instagram, TikTok, and other platforms yt-dlp handles.
 * Returns the local file path for further processing (frame extraction, transcription).
 *
 * Invocation: PATH binary `yt-dlp` first, `python3 -m yt_dlp` fallback (via
 * resolveYtDlp). The previous hardcoded python-module form broke whenever
 * python3 had no yt_dlp installed even though the brew binary was present.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const invocation = await resolveYtDlp();
  if (!invocation) throw new Error("yt-dlp is not installed (brew install yt-dlp)");

  const tmpDir = path.join(os.tmpdir(), `ce-download-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const outputTemplate = path.join(tmpDir, "%(title).50s.%(ext)s");

  const args = [
    ...invocation.baseArgs,
    "--no-playlist",
    "-f", "mp4[height<=1080]/best[height<=1080]/mp4/best",
    "--merge-output-format", "mp4",
    "-o", outputTemplate,
    "--print-json",
    "--no-warnings",
    "--",          // end-of-options: prevents a malicious URL from being parsed as yt-dlp flags
    url,
  ];

  return new Promise<DownloadResult>((resolve, reject) => {
    execFile(invocation.cmd, args, { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // Clean up on failure
        try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
        reject(new Error(`yt-dlp failed: ${stderr || error.message}`));
        return;
      }

      try {
        // yt-dlp --print-json outputs JSON metadata
        const lines = stdout.trim().split("\n");
        const jsonLine = lines[lines.length - 1];
        const metadata = JSON.parse(jsonLine);

        const filename = metadata._filename || metadata.filename;
        const filePath = filename && fs.existsSync(filename)
          ? filename
          : findDownloadedFile(tmpDir);

        if (!filePath) {
          reject(new Error("Download completed but file not found"));
          return;
        }

        resolve({
          filePath,
          title: metadata.title || "Unknown",
          duration: metadata.duration || null,
        });
      } catch (parseError) {
        // Fallback: find any video file in the tmp dir
        const filePath = findDownloadedFile(tmpDir);
        if (filePath) {
          resolve({ filePath, title: "Unknown", duration: null });
        } else {
          reject(new Error("Download completed but could not locate file"));
        }
      }
    });
  });
}

function findDownloadedFile(dir: string): string | null {
  const videoExtensions = [".mp4", ".webm", ".mkv", ".mov", ".avi"];
  try {
    const files = fs.readdirSync(dir);
    const videoFile = files.find((f) =>
      videoExtensions.some((ext) => f.toLowerCase().endsWith(ext)),
    );
    return videoFile ? path.join(dir, videoFile) : null;
  } catch {
    return null;
  }
}

/**
 * Check if yt-dlp is available on this system (PATH binary or python module).
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  return (await resolveYtDlp()) !== null;
}

/**
 * Clean up a downloaded video file and its parent temp directory.
 */
export function cleanupDownload(filePath: string): void {
  try {
    const dir = path.dirname(filePath);
    if (dir.includes("ce-download-")) {
      fs.rmSync(dir, { recursive: true });
    } else {
      fs.unlinkSync(filePath);
    }
  } catch { /* best effort */ }
}
