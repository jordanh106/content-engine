import { Router } from "express";
import path from "path";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseIdeaBank } from "../parsers/idea-bank.js";
import { parseWatchlist } from "../parsers/watchlist.js";
import { db } from "../db.js";
import { vaultHooks } from "../../shared/schema.js";

type SearchResult = {
  type: "video" | "idea" | "creator" | "hook";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
};

export function createSearchRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const ideaBankPath = path.join(industryDir, "idea-bank.md");
  const watchlistPath = path.join(industryDir, "watchlist.md");

  router.get("/", (req, res) => {
    const q = ((req.query.q as string) || "").toLowerCase().trim();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const results: SearchResult[] = [];
    const limit = 20;

    // Search videos
    const videos = parseContentLibrary(contentLibraryPath);
    for (const v of videos) {
      if (results.length >= limit) break;
      if (
        v.code.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        results.push({
          type: "video",
          id: v.code,
          title: `${v.code}: ${v.title}`,
          subtitle: `Format ${v.format} | ${v.audienceLabel}`,
          meta: v.format,
        });
      }
    }

    // Search ideas
    const ideas = parseIdeaBank(ideaBankPath);
    for (const idea of ideas) {
      if (results.length >= limit) break;
      if (
        idea.topic.toLowerCase().includes(q) ||
        idea.hookAngle.toLowerCase().includes(q)
      ) {
        results.push({
          type: "idea",
          id: String(idea.id),
          title: idea.topic,
          subtitle: `${idea.category} | ${idea.priority} priority`,
          meta: idea.suggestedFormat,
        });
      }
    }

    // Search creators
    const creators = parseWatchlist(watchlistPath);
    for (const c of creators) {
      if (results.length >= limit) break;
      if (
        c.handle.toLowerCase().includes(q) ||
        c.contentStyle.toLowerCase().includes(q)
      ) {
        results.push({
          type: "creator",
          id: c.handle,
          title: `@${c.handle}`,
          subtitle: `${c.platform} | ${c.followers}`,
        });
      }
    }

    // Search hooks
    const hooks = db.select().from(vaultHooks).all();
    for (const h of hooks) {
      if (results.length >= limit) break;
      if (
        h.pattern.toLowerCase().includes(q) ||
        (h.example && h.example.toLowerCase().includes(q))
      ) {
        results.push({
          type: "hook",
          id: String(h.id),
          title: h.pattern,
          subtitle: `${h.category} hook${h.platform ? ` | ${h.platform}` : ""}`,
        });
      }
    }

    res.json({ results: results.slice(0, limit) });
  });

  return router;
}
