/**
 * Background transcript queue for media_assets.
 *
 * DB-backed single-flight pump: the transcript_status column on media_assets
 * IS the queue (pending → running → ready | failed). No in-memory job array,
 * so the queue survives server restarts — recoverStuckTranscripts() resets any
 * row left 'running' by a crash back to 'pending' at boot.
 *
 * Strategy per asset:
 *   - URL videos (youtube/tiktok/instagram/loom): captions-first via yt-dlp
 *     (free), Whisper fallback (download → extract audio → whisper-1).
 *   - Uploaded audio/video files: straight to Whisper on the stored file.
 *
 * Concurrency: 1 (matching the renders.ts single-flight convention) — yt-dlp
 * downloads + Whisper calls are slow and we don't want parallel downloads
 * saturating the connection.
 */
import { sqlite } from "../db.js";
import { fetchCaptionsViaYtDlp, whisperTranscribe } from "./transcription.js";
import { recomputeTokenCount } from "./media-ingest.js";
import { downloadVideo, cleanupDownload, isYtDlpAvailable } from "./video-downloader.js";

let pumping = false;

type QueueRow = {
  id: number;
  kind: string;
  platform: string | null;
  source_url: string | null;
  file_path: string | null;
};

/** Reset rows stranded in 'running' by a previous crash. Call once at router init. */
export function recoverStuckTranscripts(): number {
  const result = sqlite.prepare(
    "UPDATE media_assets SET transcript_status = 'pending' WHERE transcript_status = 'running'",
  ).run();
  return result.changes;
}

/** Mark an asset pending + kick the pump. Safe to call for any asset id. */
export function enqueueTranscript(assetId: number): void {
  sqlite.prepare(
    "UPDATE media_assets SET transcript_status = 'pending', transcript_error = NULL WHERE id = ?",
  ).run(assetId);
  void pump();
}

/** Kick the pump without changing any statuses (used at boot after recovery). */
export function kickTranscriptQueue(): void {
  void pump();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const row = sqlite.prepare(
        "SELECT id, kind, platform, source_url, file_path FROM media_assets WHERE transcript_status = 'pending' ORDER BY id ASC LIMIT 1",
      ).get() as QueueRow | undefined;
      if (!row) break;

      sqlite.prepare("UPDATE media_assets SET transcript_status = 'running' WHERE id = ?").run(row.id);

      // Completion writes are guarded on still being 'running'. If the row was
      // re-queued (retranscribe) or deleted mid-run, changes === 0 and we leave
      // the new 'pending'/absent state alone — the loop picks it up next pass.
      try {
        const outcome = await transcribeOne(row);
        if (outcome.ok) {
          const upd = sqlite.prepare(
            "UPDATE media_assets SET transcript = ?, transcript_status = 'ready', transcript_error = NULL WHERE id = ? AND transcript_status = 'running'",
          ).run(outcome.text, row.id);
          if (upd.changes > 0) {
            recomputeTokenCount(row.id);
            console.log(`[transcript-queue] #${row.id} ready (${outcome.source}, ${outcome.text.length} chars)`);
          }
        } else {
          sqlite.prepare(
            "UPDATE media_assets SET transcript_status = 'failed', transcript_error = ? WHERE id = ? AND transcript_status = 'running'",
          ).run(outcome.error, row.id);
          console.warn(`[transcript-queue] #${row.id} failed: ${outcome.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sqlite.prepare(
          "UPDATE media_assets SET transcript_status = 'failed', transcript_error = ? WHERE id = ? AND transcript_status = 'running'",
        ).run(msg, row.id);
        console.warn(`[transcript-queue] #${row.id} crashed: ${msg}`);
      }
    }
  } finally {
    pumping = false;
  }
}

type TranscribeOutcome =
  | { ok: true; text: string; source: "captions" | "whisper" }
  | { ok: false; error: string };

async function transcribeOne(row: QueueRow): Promise<TranscribeOutcome> {
  // Uploaded files: straight to Whisper on the stored file.
  if (row.file_path) {
    const result = await whisperTranscribe(row.file_path);
    if (result.ok) return { ok: true, text: result.text, source: "whisper" };
    return { ok: false, error: whisperErrorMessage(result.reason, result.detail) };
  }

  if (!row.source_url) return { ok: false, error: "no source_url or file_path on asset" };

  // URL videos: captions first (free), Whisper fallback (download + extract).
  const captions = await fetchCaptionsViaYtDlp(row.source_url);
  if (captions) return { ok: true, text: captions, source: "captions" };

  if (!(await isYtDlpAvailable())) {
    return { ok: false, error: "no captions available and yt-dlp is not installed (brew install yt-dlp)" };
  }

  let downloadedPath: string | null = null;
  try {
    const download = await downloadVideo(row.source_url);
    downloadedPath = download.filePath;
    const result = await whisperTranscribe(download.filePath);
    if (result.ok) return { ok: true, text: result.text, source: "whisper" };
    return { ok: false, error: whisperErrorMessage(result.reason, result.detail) };
  } catch (err) {
    return { ok: false, error: `download failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    if (downloadedPath) cleanupDownload(downloadedPath);
  }
}

function whisperErrorMessage(reason: string, detail?: string): string {
  switch (reason) {
    case "no_key": return "OPENAI_API_KEY not configured — captions unavailable and Whisper fallback disabled";
    case "empty_audio": return "audio track is empty or too short to transcribe";
    case "extract_failed": return `audio extraction failed: ${detail ?? "unknown ffmpeg error"}`;
    default: return `whisper API failed: ${detail ?? "unknown error"}`;
  }
}
