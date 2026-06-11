/**
 * Universal media ingestion — the "paste anything, it just works" service.
 *
 * Any URL or file ingested anywhere in the app becomes a media_assets row:
 * normalized metadata + a cached thumbnail + extracted text where applicable,
 * with transcript_status driving the background transcript queue for videos.
 *
 *   ingestUrl(url, opts, dirs)  — YouTube / TikTok / Instagram / Twitter-X /
 *                                 Loom / generic website
 *   ingestFile(input, dirs)    — PDF / audio / image / video uploads
 *
 * Platform notes:
 *   - Instagram has no usable public oEmbed; callers supply thumbnail/title/
 *     author from Xpoz CDN payloads (imageUrl → thumbnailUrl alias accepted,
 *     matching the carousels trending/seed convention). IG CDN fetches need
 *     a real browser UA + Referer or they serve login-wall HTML.
 *   - TikTok oEmbed thumbnail URLs are short-lived signed URLs — always cached
 *     to disk at ingest, never stored as the long-term reference.
 */
import fs from "fs";
import path from "path";
import { sqlite } from "../db.js";
import type { MediaAsset, MediaAssetKind, MediaPlatform, TranscriptStatus } from "../../shared/types.js";

export type MediaDirs = {
  filesDir: string;   // uploaded file storage, served at /media/files
  thumbsDir: string;  // cached thumbnails, served at /media/thumbs
};

export type IngestUrlOptions = {
  /** Caller-supplied thumbnail (Xpoz CDN URL for Instagram). Alias: imageUrl. */
  thumbnailUrl?: string;
  title?: string;
  author?: string;
};

export type IngestResult = { asset: MediaAsset; duplicate: boolean };

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TEXT_CAP = 60_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;       // size ceiling for website fetch
const MAX_THUMB_BYTES = 10 * 1024 * 1024;     // size ceiling for thumbnail fetch

/** Map a validated mimetype to a safe file extension (never trust the upload's own extension). */
const MIMETYPE_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/wav": ".wav",
  "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/aac": ".aac", "audio/flac": ".flac",
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-msvideo": ".avi",
};

/** Read a fetch body up to a byte ceiling; returns null if Content-Length exceeds it. */
async function readBodyCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared && declared > maxBytes) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > maxBytes ? null : buf;
}

// ── Row mapping ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export function rowToMediaAsset(r: Row): MediaAsset {
  return {
    id: r.id as number,
    kind: r.kind as MediaAssetKind,
    platform: (r.platform as MediaPlatform) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    title: (r.title as string) ?? null,
    author: (r.author as string) ?? null,
    thumbnailPath: (r.thumbnail_path as string) ?? null,
    filePath: (r.file_path as string) ?? null,
    publicUrl: (r.public_url as string) ?? null,
    transcript: (r.transcript as string) ?? null,
    transcriptStatus: r.transcript_status as TranscriptStatus,
    transcriptError: (r.transcript_error as string) ?? null,
    textContent: (r.text_content as string) ?? null,
    metadataJson: (r.metadata_json as string) ?? null,
    tokenCount: (r.token_count as number) ?? 0,
    createdAt: r.created_at as string,
  };
}

export function getMediaAsset(id: number): MediaAsset | null {
  const row = sqlite.prepare("SELECT * FROM media_assets WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToMediaAsset(row) : null;
}

/** ~4 chars per token. Good enough for budget display; no tokenizer dependency. */
export function estimateTokens(...texts: Array<string | null | undefined>): number {
  const total = texts.reduce<number>((acc, t) => acc + (t ? t.length : 0), 0);
  return Math.ceil(total / 4);
}

export function recomputeTokenCount(id: number): void {
  const asset = getMediaAsset(id);
  if (!asset) return;
  const count = estimateTokens(asset.transcript, asset.textContent, asset.title);
  sqlite.prepare("UPDATE media_assets SET token_count = ? WHERE id = ?").run(count, id);
}

// ── URL classification ───────────────────────────────────────────────────────

export type ClassifiedUrl = { kind: MediaAssetKind; platform: MediaPlatform };

export function classifyUrl(url: string): ClassifiedUrl {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { kind: "video", platform: "youtube" };
  if (u.includes("tiktok.com")) return { kind: "video", platform: "tiktok" };
  if (u.includes("instagram.com")) return { kind: "video", platform: "instagram" };
  if (u.includes("loom.com")) return { kind: "video", platform: "loom" };
  if (/(^|\.)((twitter|x)\.com)\//.test(u.replace(/^https?:\/\//, ""))) return { kind: "tweet", platform: "twitter" };
  return { kind: "website", platform: "web" };
}

// ── Thumbnail caching ────────────────────────────────────────────────────────

function headersForHost(url: string): Record<string, string> {
  if (/cdninstagram|fbcdn|instagram\.com/.test(url)) {
    return { "User-Agent": BROWSER_UA, Referer: "https://www.instagram.com/" };
  }
  return { "User-Agent": BROWSER_UA };
}

/**
 * Download a remote thumbnail to thumbsDir as `media-{assetId}.{ext}`.
 * Returns the public URL path (/media/thumbs/...) or null on failure.
 */
export async function cacheMediaThumbnail(thumbnailUrl: string, assetId: number, dirs: MediaDirs): Promise<string | null> {
  try {
    const res = await fetch(thumbnailUrl, {
      headers: headersForHost(thumbnailUrl),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) return null; // login wall / error page
    const buf = await readBodyCapped(res, MAX_THUMB_BYTES);
    if (!buf || buf.length < 1000) return null;

    const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
    const filename = `media-${assetId}${ext}`;
    fs.mkdirSync(dirs.thumbsDir, { recursive: true });
    fs.writeFileSync(path.join(dirs.thumbsDir, filename), buf);
    return `/media/thumbs/${filename}`;
  } catch {
    return null;
  }
}

// ── Per-platform metadata fetchers ───────────────────────────────────────────

type UrlMetadata = {
  title: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  textContent: string | null;
  raw: Record<string, unknown>;
};

async function fetchOembed(endpoint: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchYouTubeMetadata(url: string): Promise<UrlMetadata> {
  const data = await fetchOembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  return {
    title: (data?.title as string) ?? null,
    author: data?.author_name ? `@${String(data.author_name).replace(/\s+/g, "")}` : null,
    thumbnailUrl: (data?.thumbnail_url as string) ?? null,
    textContent: null,
    raw: data ?? {},
  };
}

async function fetchTikTokMetadata(url: string): Promise<UrlMetadata> {
  const data = await fetchOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  return {
    title: (data?.title as string) ?? null,
    author: data?.author_name ? `@${data.author_name}` : null,
    thumbnailUrl: (data?.thumbnail_url as string) ?? null,
    textContent: null,
    raw: data ?? {},
  };
}

async function fetchLoomMetadata(url: string): Promise<UrlMetadata> {
  const data = await fetchOembed(`https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`);
  return {
    title: (data?.title as string) ?? null,
    author: null,
    thumbnailUrl: (data?.thumbnail_url as string) ?? null,
    textContent: null,
    raw: data ?? {},
  };
}

async function fetchTweetMetadata(url: string): Promise<UrlMetadata> {
  const data = await fetchOembed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`);
  let text: string | null = null;
  if (data?.html) {
    // Tweet text lives inside the blockquote HTML — strip tags.
    text = String(data.html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&mdash;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+\n/g, "\n")
      .trim();
  }
  return {
    title: text ? text.slice(0, 120) : null,
    author: (data?.author_name as string) ?? null,
    thumbnailUrl: null,
    textContent: text,
    raw: data ?? {},
  };
}

async function fetchWebsiteMetadata(url: string): Promise<UrlMetadata> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return { title: null, author: null, thumbnailUrl: null, textContent: null, raw: { status: res.status } };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { title: url, author: null, thumbnailUrl: null, textContent: null, raw: { contentType } };
    }
    const htmlBuf = await readBodyCapped(res, MAX_HTML_BYTES);
    if (!htmlBuf) return { title: url, author: null, thumbnailUrl: null, textContent: null, raw: { error: "response exceeded size ceiling" } };
    const html = htmlBuf.toString("utf-8");
    const { load } = await import("cheerio");
    const $ = load(html);

    $("script, style, noscript, nav, header, footer, iframe, svg, form, aside").remove();

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").first().text().trim() ||
      null;
    const author =
      $('meta[name="author"]').attr("content") ||
      $('meta[property="article:author"]').attr("content") ||
      null;
    // og:image / twitter:image are often relative or protocol-relative — resolve against the final URL.
    const rawThumb =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null;
    let thumbnailUrl: string | null = null;
    if (rawThumb) {
      try { thumbnailUrl = new URL(rawThumb, res.url).toString(); } catch { thumbnailUrl = null; }
    }

    // Prefer semantic containers; fall back to body.
    const container = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
    const textContent = container.text().replace(/\s+/g, " ").trim().slice(0, TEXT_CAP) || null;

    const description = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || null;

    return { title, author, thumbnailUrl, textContent, raw: { description, finalUrl: res.url } };
  } catch (err) {
    return { title: null, author: null, thumbnailUrl: null, textContent: null, raw: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// ── ingestUrl ────────────────────────────────────────────────────────────────

export async function ingestUrl(url: string, opts: IngestUrlOptions, dirs: MediaDirs): Promise<IngestResult> {
  const trimmed = url.trim();

  // Dedupe by exact source_url (discover add-url convention)
  const existing = sqlite.prepare("SELECT * FROM media_assets WHERE source_url = ?").get(trimmed) as Row | undefined;
  if (existing) return { asset: rowToMediaAsset(existing), duplicate: true };

  const { kind, platform } = classifyUrl(trimmed);

  let meta: UrlMetadata;
  switch (platform) {
    case "youtube":   meta = await fetchYouTubeMetadata(trimmed); break;
    case "tiktok":    meta = await fetchTikTokMetadata(trimmed); break;
    case "loom":      meta = await fetchLoomMetadata(trimmed); break;
    case "twitter":   meta = await fetchTweetMetadata(trimmed); break;
    case "instagram": meta = { title: null, author: null, thumbnailUrl: null, textContent: null, raw: { note: "no public oEmbed; metadata from caller (Xpoz)" } }; break;
    default:          meta = await fetchWebsiteMetadata(trimmed); break;
  }

  // Caller-supplied fields win (Instagram/Xpoz path; manual overrides elsewhere)
  const title = opts.title ?? meta.title;
  const author = opts.author ?? meta.author;
  const thumbnailUrl = opts.thumbnailUrl ?? meta.thumbnailUrl;

  // Videos get queued for transcription; everything else carries text_content.
  // Instagram is special: only /reel/ posts are videos. Photo posts + profiles
  // would burn a guaranteed-to-fail yt-dlp download (login wall), so skip them.
  const igIsReel = /\/reels?\//.test(trimmed);
  const wantsTranscript = kind === "video" && (platform !== "instagram" || igIsReel);
  const transcriptStatus: TranscriptStatus = wantsTranscript ? "pending" : "none";
  const tokenCount = estimateTokens(meta.textContent, title);

  // INSERT ... ON CONFLICT guards against a concurrent double-post of the same
  // URL slipping past the dedupe SELECT above (the unique index backs this).
  const result = sqlite.prepare(`
    INSERT INTO media_assets (kind, platform, source_url, title, author, transcript_status, text_content, metadata_json, token_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_url) DO NOTHING
  `).run(kind, platform, trimmed, title, author, transcriptStatus, meta.textContent, JSON.stringify(meta.raw), tokenCount);

  if (result.changes === 0) {
    // Lost the race — another concurrent ingest of the same URL already inserted.
    const winner = sqlite.prepare("SELECT * FROM media_assets WHERE source_url = ?").get(trimmed) as Row | undefined;
    if (winner) return { asset: rowToMediaAsset(winner), duplicate: true };
  }
  const id = Number(result.lastInsertRowid);

  if (thumbnailUrl) {
    const cached = await cacheMediaThumbnail(thumbnailUrl, id, dirs);
    if (cached) sqlite.prepare("UPDATE media_assets SET thumbnail_path = ? WHERE id = ?").run(cached, id);
  }

  const asset = getMediaAsset(id);
  if (!asset) throw new Error("media asset insert failed");
  return { asset, duplicate: false };
}

// ── ingestFile ───────────────────────────────────────────────────────────────

export type IngestFileInput = {
  /** Path to the uploaded temp file (multer disk storage). */
  tempPath: string;
  originalName: string;
  mimetype: string;
};

function kindFromMimetype(mimetype: string): MediaAssetKind | null {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return null;
}

export async function ingestFile(input: IngestFileInput, dirs: MediaDirs): Promise<IngestResult> {
  const kind = kindFromMimetype(input.mimetype);
  if (!kind) throw new Error(`unsupported mimetype: ${input.mimetype}`);

  fs.mkdirSync(dirs.filesDir, { recursive: true });
  // Derive the stored extension from the VALIDATED mimetype, not the upload's
  // own extension — otherwise `payload.html` with mimetype image/png would be
  // served as text/html from a same-origin path and execute against the API.
  const baseName = input.originalName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  const ext = MIMETYPE_EXT[input.mimetype] ?? "";
  const storedName = `${Date.now()}-${baseName}${ext}`;
  const storedPath = path.join(dirs.filesDir, storedName);
  fs.copyFileSync(input.tempPath, storedPath);
  const publicUrl = `/media/files/${storedName}`;

  let textContent: string | null = null;
  if (kind === "pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const data = new Uint8Array(fs.readFileSync(storedPath));
      const pdf = await getDocumentProxy(data);
      const { text } = await extractText(pdf, { mergePages: true });
      textContent = (text ?? "").replace(/\s+/g, " ").trim().slice(0, TEXT_CAP) || null;
    } catch (err) {
      console.warn("[media-ingest] pdf extraction failed:", err instanceof Error ? err.message : err);
    }
  }

  // Audio + video uploads go to the transcript queue; pdf/image carry text/nothing.
  const transcriptStatus: TranscriptStatus = kind === "audio" || kind === "video" ? "pending" : "none";
  const title = input.originalName.replace(/\.[^.]+$/, "");
  const tokenCount = estimateTokens(textContent, title);

  const result = sqlite.prepare(`
    INSERT INTO media_assets (kind, platform, title, file_path, public_url, transcript_status, text_content, metadata_json, token_count)
    VALUES (?, 'upload', ?, ?, ?, ?, ?, ?, ?)
  `).run(kind, title, storedPath, publicUrl, transcriptStatus, textContent, JSON.stringify({ originalName: input.originalName, mimetype: input.mimetype }), tokenCount);
  const id = Number(result.lastInsertRowid);

  // Images double as their own thumbnail.
  if (kind === "image") {
    sqlite.prepare("UPDATE media_assets SET thumbnail_path = ? WHERE id = ?").run(publicUrl, id);
  }

  const asset = getMediaAsset(id);
  if (!asset) throw new Error("media asset insert failed");
  return { asset, duplicate: false };
}

/** Delete an asset + its files on disk. */
export function deleteMediaAsset(id: number, dirs: MediaDirs): boolean {
  const asset = getMediaAsset(id);
  if (!asset) return false;
  if (asset.filePath) {
    try { fs.unlinkSync(asset.filePath); } catch { /* already gone */ }
  }
  if (asset.thumbnailPath?.startsWith("/media/thumbs/")) {
    try { fs.unlinkSync(path.join(dirs.thumbsDir, path.basename(asset.thumbnailPath))); } catch { /* already gone */ }
  }
  sqlite.prepare("DELETE FROM media_assets WHERE id = ?").run(id);
  return true;
}
