import fs from "fs";
import path from "path";
import { eq, isNull, or } from "drizzle-orm";
import { db, sqlite } from "../db.js";
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
 * Check if a URL is a profile URL (not a specific video).
 * Profile URLs can't be resolved to thumbnails via oEmbed.
 */
function isProfileUrl(url: string): boolean {
  // TikTok profile: tiktok.com/@handle (no /video/ segment)
  if (url.includes("tiktok.com") && !url.includes("/video/")) return true;
  // Instagram profile: instagram.com/handle (no /reel/ or /p/)
  if (url.includes("instagram.com") && !url.includes("/reel/") && !url.includes("/p/")) return true;
  return false;
}

/**
 * Resolve a direct thumbnail URL from a video URL + platform.
 * YouTube: construct URL directly (no API key needed).
 * TikTok: use oEmbed endpoint (requires direct video URL, not profile).
 * Instagram: use oEmbed endpoint (public, works for public reels).
 */
export async function resolveThumbnailUrl(
  videoUrl: string,
  platform: string,
): Promise<string | null> {
  if (!videoUrl || videoUrl === "unknown") return null;
  if (isProfileUrl(videoUrl)) return null;

  const p = platform.toLowerCase();

  // YouTube
  if (p.includes("youtube") || p.includes("yt") || videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    const id = extractYouTubeId(videoUrl);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // TikTok - oEmbed (only works with direct video URLs)
  if (p.includes("tiktok") || videoUrl.includes("tiktok.com")) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
      const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.thumbnail_url) return data.thumbnail_url as string;
      }
    } catch {
      // TikTok oEmbed may rate-limit or timeout
    }
  }

  // Instagram - fetch-based resolution is unreliable (returns login-wall images).
  // Use POST /api/creator-videos/bulk-thumbnails with Xpoz CDN URLs instead.
  if (p.includes("instagram") || videoUrl.includes("instagram.com")) {
    console.log(`[thumbnail] Skipping Instagram fetch for ${videoUrl} — use bulk-thumbnails endpoint with Xpoz imageUrl`);
    return null;
  }

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

    const resp = await fetch(thumbnailUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentEngine/1.0)" },
    });
    if (!resp.ok) return null;

    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 1000) return null; // Skip empty/error responses (real thumbnails are >1KB)

    // Reject Instagram login-wall / placeholder images by checking for known small sizes
    // Instagram's "login to view" placeholder is typically ~10-15KB, real thumbnails are 50KB+
    // Also reject if content-type suggests HTML (login redirect)
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return null;

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
  if (video.videoUrl && video.videoUrl !== "unknown") {
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

/**
 * Purge likely-bad cached thumbnails for Instagram videos.
 * Instagram oEmbed sometimes returns login-wall images that get cached.
 * This clears thumbnails under a size threshold so they get re-resolved.
 */
export function purgeSmallInstagramThumbnails(thumbnailsDir: string): number {
  const rows = sqlite.prepare(
    "SELECT id, thumbnail_url as thumbnailUrl FROM creator_videos WHERE platform LIKE '%instagram%' AND thumbnail_url LIKE '/thumbnails/%'"
  ).all() as { id: number; thumbnailUrl: string }[];

  let purged = 0;
  for (const row of rows) {
    const filepath = path.join(thumbnailsDir, path.basename(row.thumbnailUrl));
    if (fs.existsSync(filepath)) {
      const stat = fs.statSync(filepath);
      // Login-wall placeholder images are typically 25-37KB; real thumbnails are 50KB+
      if (stat.size < 40000) {
        fs.unlinkSync(filepath);
        sqlite.prepare("UPDATE creator_videos SET thumbnail_url = NULL WHERE id = ?").run(row.id);
        purged++;
      }
    }
  }
  return purged;
}

/**
 * Aggressive backfill: attempt to resolve ALL videos missing thumbnails.
 * Includes retry logic with delays between requests to avoid rate limiting.
 * Returns stats about what was resolved.
 */
export async function backfillAllThumbnails(
  thumbnailsDir: string,
): Promise<{ total: number; resolved: number; failed: number; noUrl: number }> {
  const rows = sqlite.prepare(
    "SELECT id, video_url as videoUrl, thumbnail_url as thumbnailUrl, platform FROM creator_videos WHERE thumbnail_url IS NULL OR thumbnail_url = ''"
  ).all() as { id: number; videoUrl: string | null; thumbnailUrl: string | null; platform: string }[];

  let resolved = 0;
  let failed = 0;
  let noUrl = 0;

  for (const row of rows) {
    if (!row.videoUrl || row.videoUrl === "unknown" || isProfileUrl(row.videoUrl || "")) {
      noUrl++;
      continue;
    }

    const result = await ensureThumbnail(row, thumbnailsDir);
    if (result) {
      resolved++;
    } else {
      failed++;
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  return { total: rows.length, resolved, failed, noUrl };
}
