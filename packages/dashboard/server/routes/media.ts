/**
 * /api/media — universal media ingestion (Poppy-parity Phase 1).
 *
 * POST /ingest-url     { url, thumbnailUrl?|imageUrl?, title?, author? }
 * POST /ingest-file    multipart "file" — pdf | audio/* | image/* | video/*
 * GET  /               list (?kind=, ?limit=)
 * GET  /:id            single asset
 * POST /:id/retranscribe   re-queue transcription
 * DELETE /:id          remove asset + files
 *
 * Uploaded files are stored under data/media/files, thumbnails under
 * data/media/thumbs — both served by the /media static mount in index.ts.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import {
  ingestUrl,
  ingestFile,
  getMediaAsset,
  deleteMediaAsset,
  rowToMediaAsset,
  type MediaDirs,
} from "../lib/media-ingest.js";
import {
  enqueueTranscript,
  recoverStuckTranscripts,
  kickTranscriptQueue,
} from "../lib/media-transcript-queue.js";
import { sqlite } from "../db.js";

const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm", "audio/ogg", "audio/aac", "audio/flac",
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
]);

export function createMediaRouter(mediaDir: string) {
  const router = Router();

  const dirs: MediaDirs = {
    filesDir: path.join(mediaDir, "files"),
    thumbsDir: path.join(mediaDir, "thumbs"),
  };
  fs.mkdirSync(dirs.filesDir, { recursive: true });
  fs.mkdirSync(dirs.thumbsDir, { recursive: true });

  // Crash recovery + resume any pending work from a previous run.
  const recovered = recoverStuckTranscripts();
  if (recovered > 0) console.log(`[media] recovered ${recovered} stuck transcript(s) to pending`);
  kickTranscriptQueue();

  // JSON bodies are parsed by the global express.json() in index.ts (raised to
  // 2mb there); ingest-url bodies are tiny so no router-level parser is needed.

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      ALLOWED_MIMETYPES.has(file.mimetype)
        ? cb(null, true)
        : cb(new Error(`unsupported file type: ${file.mimetype}`)),
  });

  // ── POST /api/media/ingest-url ────────────────────────────────────────────
  router.post("/ingest-url", async (req, res) => {
    const body = req.body as {
      url?: string;
      thumbnailUrl?: string;
      imageUrl?: string;   // Xpoz alias (carousels trending/seed convention)
      title?: string;
      author?: string;
    };
    const url = body.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: "a valid http(s) url is required" });
      return;
    }

    try {
      const result = await ingestUrl(url, {
        thumbnailUrl: body.thumbnailUrl ?? body.imageUrl,
        title: body.title,
        author: body.author,
      }, dirs);

      if (!result.duplicate && result.asset.transcriptStatus === "pending") {
        kickTranscriptQueue();
      }

      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (err) {
      console.error("[media] ingest-url failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── POST /api/media/ingest-file ───────────────────────────────────────────
  router.post("/ingest-file", upload.single("file"), async (req, res) => {
    const file = (req as unknown as { file?: { path: string; originalname: string; mimetype: string } }).file;
    if (!file) {
      res.status(400).json({ error: "multipart field 'file' is required (pdf, audio, image, or video)" });
      return;
    }

    try {
      const result = await ingestFile({
        tempPath: file.path,
        originalName: file.originalname,
        mimetype: file.mimetype,
      }, dirs);

      if (result.asset.transcriptStatus === "pending") {
        kickTranscriptQueue();
      }

      res.status(201).json(result);
    } catch (err) {
      console.error("[media] ingest-file failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      try { fs.unlinkSync(file.path); } catch { /* multer temp already gone */ }
    }
  });

  // ── GET /api/media ────────────────────────────────────────────────────────
  router.get("/", (req, res) => {
    const kind = typeof req.query.kind === "string" ? req.query.kind : null;
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const rows = kind
      ? sqlite.prepare("SELECT * FROM media_assets WHERE kind = ? ORDER BY id DESC LIMIT ?").all(kind, limit)
      : sqlite.prepare("SELECT * FROM media_assets ORDER BY id DESC LIMIT ?").all(limit);
    res.json({ assets: (rows as Record<string, unknown>[]).map(rowToMediaAsset), total: rows.length });
  });

  // ── GET /api/media/:id ────────────────────────────────────────────────────
  router.get("/:id", (req, res) => {
    const asset = getMediaAsset(Number(req.params.id));
    if (!asset) { res.status(404).json({ error: "media asset not found" }); return; }
    res.json({ asset });
  });

  // ── POST /api/media/:id/retranscribe ──────────────────────────────────────
  router.post("/:id/retranscribe", (req, res) => {
    const asset = getMediaAsset(Number(req.params.id));
    if (!asset) { res.status(404).json({ error: "media asset not found" }); return; }
    if (asset.kind !== "video" && asset.kind !== "audio") {
      res.status(422).json({ error: `cannot transcribe kind '${asset.kind}'` });
      return;
    }
    enqueueTranscript(asset.id);
    res.json({ ok: true, asset: getMediaAsset(asset.id) });
  });

  // ── DELETE /api/media/:id ─────────────────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const ok = deleteMediaAsset(Number(req.params.id), dirs);
    if (!ok) { res.status(404).json({ error: "media asset not found" }); return; }
    res.json({ ok: true });
  });

  // Error middleware — keeps multer rejections (oversized / bad type) in the
  // repo's { error } JSON shape instead of Express's default HTML handler.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  });

  return router;
}
