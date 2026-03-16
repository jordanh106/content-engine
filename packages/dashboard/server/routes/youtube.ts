import express from "express";
import { db } from "../db.js";
import { platformConnections, youtubeVideoLinks, performanceMetrics } from "../../shared/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI ?? "http://localhost:3001/api/metrics/youtube/callback";
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

export function createYoutubeRouter(contentLibraryPath: string) {
  const router = express.Router();

  // GET /status — connection state
  router.get("/status", (_req, res) => {
    const conn = db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platform, "youtube"))
      .limit(1)
      .all()[0] ?? null;

    if (!conn || !conn.accessToken) {
      res.json({ connected: false });
      return;
    }

    const links = db
      .select()
      .from(youtubeVideoLinks)
      .all();

    res.json({
      connected: true,
      channelName: conn.channelName,
      channelId: conn.channelId,
      connectedAt: conn.connectedAt,
      linkedVideos: links.length,
    });
  });

  // GET /auth — redirect to Google OAuth consent screen
  router.get("/auth", (_req, res) => {
    if (!CLIENT_ID) {
      res.status(500).json({ error: "YOUTUBE_CLIENT_ID not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // GET /callback — exchange authorization code for tokens
  router.get("/callback", async (req, res) => {
    const { code, error } = req.query as Record<string, string>;

    if (error || !code) {
      res.redirect("/#metrics?youtube_error=" + encodeURIComponent(error ?? "no_code"));
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };

      if (!tokenRes.ok || tokens.error || !tokens.access_token) {
        console.error("[youtube] Token exchange failed:", tokens);
        res.redirect("/#metrics?youtube_error=token_exchange_failed");
        return;
      }

      // Fetch channel info
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      const channelData = await channelRes.json() as {
        items?: Array<{ id: string; snippet: { title: string } }>;
      };

      const channel = channelData.items?.[0];
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

      // Upsert connection
      const existing = db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.platform, "youtube"))
        .limit(1)
        .all()[0];

      if (existing) {
        db.update(platformConnections)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? existing.refreshToken,
            tokenExpiresAt: expiresAt,
            channelId: channel?.id ?? existing.channelId,
            channelName: channel?.snippet.title ?? existing.channelName,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(platformConnections.platform, "youtube"))
          .run();
      } else {
        db.insert(platformConnections)
          .values({
            platform: "youtube",
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            tokenExpiresAt: expiresAt,
            channelId: channel?.id ?? null,
            channelName: channel?.snippet.title ?? null,
          })
          .run();
      }

      console.log(`[youtube] Connected: ${channel?.snippet.title ?? "unknown channel"}`);
      res.redirect("/#metrics?youtube_connected=1");
    } catch (err) {
      console.error("[youtube] OAuth callback error:", err);
      res.redirect("/#metrics?youtube_error=callback_error");
    }
  });

  // Refresh access token using stored refresh token
  async function refreshAccessToken(): Promise<string | null> {
    const conn = db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platform, "youtube"))
      .limit(1)
      .all()[0];

    if (!conn?.refreshToken) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json() as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!res.ok || !data.access_token) {
      console.error("[youtube] Token refresh failed:", data);
      return null;
    }

    const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
    db.update(platformConnections)
      .set({
        accessToken: data.access_token,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(platformConnections.platform, "youtube"))
      .run();

    return data.access_token;
  }

  // Get a valid access token (refresh if expired)
  async function getValidToken(): Promise<string | null> {
    const conn = db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platform, "youtube"))
      .limit(1)
      .all()[0];

    if (!conn?.accessToken) return null;

    // Refresh if expires within 5 minutes
    const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt).getTime() : 0;
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      return refreshAccessToken();
    }

    return conn.accessToken;
  }

  // GET /links — list all linked videos
  router.get("/links", (_req, res) => {
    const links = db
      .select()
      .from(youtubeVideoLinks)
      .orderBy(desc(youtubeVideoLinks.createdAt))
      .all();
    res.json({ links });
  });

  // POST /link — manually link a video code to a YouTube video ID
  router.post("/link", (req, res) => {
    const { videoCode, youtubeVideoId, platform } = req.body as {
      videoCode: string;
      youtubeVideoId: string;
      platform?: string;
    };

    if (!videoCode || !youtubeVideoId) {
      res.status(400).json({ error: "videoCode and youtubeVideoId required" });
      return;
    }

    db.insert(youtubeVideoLinks)
      .values({
        videoCode,
        youtubeVideoId,
        matchMethod: "manual",
        platform: platform ?? "youtube_shorts",
      })
      .onConflictDoUpdate({
        target: youtubeVideoLinks.youtubeVideoId,
        set: { videoCode, matchMethod: "manual", platform: platform ?? "youtube_shorts" },
      })
      .run();

    res.json({ ok: true });
  });

  // POST /match — auto-match channel videos to content library by title
  router.post("/match", async (_req, res) => {
    const token = await getValidToken();
    if (!token) {
      res.status(401).json({ error: "YouTube not connected or token expired" });
      return;
    }

    try {
      // Parse content library for titles
      const videos = parseContentLibrary(contentLibraryPath);
      const libraryVideos = videos.map((v) => ({
        code: v.code,
        title: v.title,
        words: new Set(v.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)),
      }));

      // Fetch user's channel uploads playlist
      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const channelData = await channelRes.json() as {
        items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
      };

      const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        res.status(404).json({ error: "No uploads playlist found" });
        return;
      }

      // Fetch all video IDs from uploads playlist (up to 200)
      const ytVideos: Array<{ id: string; title: string; durationSeconds?: number }> = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          part: "snippet",
          playlistId: uploadsPlaylistId,
          maxResults: "50",
          ...(pageToken ? { pageToken } : {}),
        });
        const playlistRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const playlistData = await playlistRes.json() as {
          nextPageToken?: string;
          items?: Array<{ snippet: { resourceId: { videoId: string }; title: string } }>;
        };

        for (const item of playlistData.items ?? []) {
          ytVideos.push({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
          });
        }
        pageToken = playlistData.nextPageToken;
      } while (pageToken && ytVideos.length < 200);

      // Fetch durations to classify shorts vs long
      const videoIds = ytVideos.map((v) => v.id);
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const detailRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(",")}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const detailData = await detailRes.json() as {
          items?: Array<{ id: string; contentDetails: { duration: string } }>;
        };
        for (const item of detailData.items ?? []) {
          const yt = ytVideos.find((v) => v.id === item.id);
          if (yt) {
            yt.durationSeconds = parseDuration(item.contentDetails.duration);
          }
        }
      }

      // Match by title word overlap
      const matches: Array<{
        youtubeVideoId: string;
        youtubeTitle: string;
        videoCode: string;
        matchScore: number;
        platform: string;
      }> = [];

      for (const ytVideo of ytVideos) {
        const ytWords = new Set(
          ytVideo.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean),
        );
        let bestScore = 0;
        let bestCode = "";

        for (const lib of libraryVideos) {
          const intersection = [...lib.words].filter((w) => ytWords.has(w)).length;
          const union = new Set([...lib.words, ...ytWords]).size;
          const score = union > 0 ? Math.round((intersection / union) * 100) : 0;
          if (score > bestScore) {
            bestScore = score;
            bestCode = lib.code;
          }
        }

        // Only auto-link if >40% word overlap
        if (bestScore >= 40) {
          const platform = (ytVideo.durationSeconds ?? 999) <= 60 ? "youtube_shorts" : "youtube_long";
          matches.push({
            youtubeVideoId: ytVideo.id,
            youtubeTitle: ytVideo.title,
            videoCode: bestCode,
            matchScore: bestScore,
            platform,
          });
        }
      }

      // Upsert matches
      for (const match of matches) {
        db.insert(youtubeVideoLinks)
          .values({
            videoCode: match.videoCode,
            youtubeVideoId: match.youtubeVideoId,
            youtubeTitle: match.youtubeTitle,
            matchScore: match.matchScore,
            matchMethod: "auto",
            platform: match.platform,
          })
          .onConflictDoUpdate({
            target: youtubeVideoLinks.youtubeVideoId,
            set: {
              videoCode: match.videoCode,
              youtubeTitle: match.youtubeTitle,
              matchScore: match.matchScore,
              matchMethod: "auto",
              platform: match.platform,
            },
          })
          .run();
      }

      res.json({
        channelVideosFound: ytVideos.length,
        matched: matches.length,
        matches: matches.slice(0, 20), // preview first 20
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Match failed";
      console.error("[youtube] match error:", err);
      res.status(500).json({ error: message });
    }
  });

  // POST /sync — fetch latest stats for all linked videos and write to performance_metrics
  router.post("/sync", async (_req, res) => {
    const token = await getValidToken();
    if (!token) {
      res.status(401).json({ error: "YouTube not connected or token expired" });
      return;
    }

    const links = db.select().from(youtubeVideoLinks).all();
    if (links.length === 0) {
      res.json({ synced: 0, message: "No linked videos. Run /match first." });
      return;
    }

    try {
      const videoIds = links.map((l) => l.youtubeVideoId);
      const synced: string[] = [];

      // Fetch stats in batches of 50
      for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${batch.join(",")}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const statsData = await statsRes.json() as {
          items?: Array<{
            id: string;
            statistics: {
              viewCount?: string;
              likeCount?: string;
              commentCount?: string;
              favoriteCount?: string;
            };
            contentDetails?: { duration?: string };
          }>;
        };

        const today = new Date().toISOString().split("T")[0];

        for (const item of statsData.items ?? []) {
          const link = links.find((l) => l.youtubeVideoId === item.id);
          if (!link) continue;

          const views = parseInt(item.statistics.viewCount ?? "0", 10);
          const likes = parseInt(item.statistics.likeCount ?? "0", 10);
          const comments = parseInt(item.statistics.commentCount ?? "0", 10);

          // Upsert: update existing record for today or insert new one
          const existing = db
            .select({ id: performanceMetrics.id })
            .from(performanceMetrics)
            .where(
              and(
                eq(performanceMetrics.videoCode, link.videoCode),
                eq(performanceMetrics.platform, link.platform),
                eq(performanceMetrics.recordedAt, today),
              ),
            )
            .limit(1)
            .all()[0];

          if (existing) {
            db.update(performanceMetrics)
              .set({ views, likes, comments })
              .where(eq(performanceMetrics.id, existing.id))
              .run();
          } else {
            db.insert(performanceMetrics)
              .values({
                videoCode: link.videoCode,
                platform: link.platform,
                recordedAt: today,
                views,
                likes,
                comments,
                saves: 0,
                shares: 0,
              })
              .run();
          }

          // Update last synced
          db.update(youtubeVideoLinks)
            .set({ lastSyncedAt: new Date().toISOString() })
            .where(eq(youtubeVideoLinks.youtubeVideoId, item.id))
            .run();

          synced.push(link.videoCode);
        }
      }

      res.json({ synced: synced.length, videoCodes: synced });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      console.error("[youtube] sync error:", err);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /disconnect — remove stored tokens
  router.delete("/disconnect", (_req, res) => {
    db.delete(platformConnections)
      .where(eq(platformConnections.platform, "youtube"))
      .run();
    res.json({ ok: true });
  });

  return router;
}

// ISO 8601 duration to seconds (e.g. PT4M13S -> 253)
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? "0") * 3600) + (parseInt(match[2] ?? "0") * 60) + parseInt(match[3] ?? "0");
}
