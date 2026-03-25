import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { creatorVideos } from "../../shared/schema.js";

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Resolve a direct thumbnail URL from a video URL + platform.
 * YouTube: construct URL directly (no API key needed).
 * TikTok: use oEmbed endpoint.
 * Instagram: skip (requires Meta App token).
 */
export async function resolveThumbnailUrl(
  videoUrl: string,
  platform: string,
): Promise<string | null> {
  const p = platform.toLowerCase();

  if (p.includes("youtube") || p.includes("yt") || videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    const id = extractYouTubeId(videoUrl);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  if (p.includes("tiktok") || videoUrl.includes("tiktok.com")) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
      const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.thumbnail_url) return data.thumbnail_url as string;
      }
    } catch {
      // TikTok oEmbed may rate-limit or timeout; fail silently
    }
  }

  // Instagram requires Meta App token -- skip for now
  return null;
}

/**
 * Download a thumbnail image and cache it locally.
 * Returns the local serving path (e.g., "/thumbnails/42.jpg").
 */
export async function cacheThumbnail(
  thumbnailUrl: string,
  videoId: number,
  thumbnailsDir: string,
): Promise<string | null> {
  try {
    const ext = thumbnailUrl.includes(".png") ? ".png" : ".jpg";
    const filename = `${videoId}${ext}`;
    const filepath = path.join(thumbnailsDir, filename);

    // Already cached?
    if (fs.existsSync(filepath)) return `/thumbnails/${filename}`;

    const resp = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return `/thumbnails/${filename}`;
  } catch {
    return null;
  }
}

/**
 * Orchestrator: ensure a creator video has a cached thumbnail.
 * Checks if already cached, resolves URL if needed, downloads, updates DB.
 */
export async function ensureThumbnail(
  video: { id: number; videoUrl: string | null; thumbnailUrl: string | null; platform: string },
  thumbnailsDir: string,
): Promise<string | null> {
  // Already has a local cached thumbnail?
  if (video.thumbnailUrl && video.thumbnailUrl.startsWith("/thumbnails/")) {
    const filepath = path.join(thumbnailsDir, path.basename(video.thumbnailUrl));
    if (fs.existsSync(filepath)) return video.thumbnailUrl;
  }

  // Already has an external thumbnail URL? Cache it.
  if (video.thumbnailUrl && !video.thumbnailUrl.startsWith("/thumbnails/")) {
    const localPath = await cacheThumbnail(video.thumbnailUrl, video.id, thumbnailsDir);
    if (localPath) {
      db.update(creatorVideos).set({ thumbnailUrl: localPath }).where(eq(creatorVideos.id, video.id)).run();
      return localPath;
    }
  }

  // No thumbnail URL at all? Resolve from video URL.
  if (video.videoUrl) {
    const resolved = await resolveThumbnailUrl(video.videoUrl, video.platform);
    if (resolved) {
      const localPath = await cacheThumbnail(resolved, video.id, thumbnailsDir);
      if (localPath) {
        db.update(creatorVideos).set({ thumbnailUrl: localPath }).where(eq(creatorVideos.id, video.id)).run();
        return localPath;
      }
      // Even if cache failed, store the external URL
      db.update(creatorVideos).set({ thumbnailUrl: resolved }).where(eq(creatorVideos.id, video.id)).run();
      return resolved;
    }
  }

  return null;
}
