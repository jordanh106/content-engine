import { Router } from "express";
import path from "path";
import { parseWatchlist } from "../parsers/watchlist.js";
import { parseCreatorInsights } from "../parsers/creator-insights.js";

export function createWatchlistRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");

  // GET /api/watchlist - list all tracked creators with insight availability
  router.get("/", (_req, res) => {
    const creators = parseWatchlist(watchlistPath);
    const insights = parseCreatorInsights(creatorInsightsDir);

    const enriched = creators.map((c) => ({
      ...c,
      hasInsight: insights.has(c.handle.replace("@", "").toLowerCase()),
    }));

    res.json({ creators: enriched, total: enriched.length });
  });

  // GET /api/watchlist/:handle/insights - Get creator analysis if available
  router.get("/:handle/insights", (req, res) => {
    const handle = req.params.handle.replace("@", "").toLowerCase();
    const insights = parseCreatorInsights(creatorInsightsDir);
    const insight = insights.get(handle);

    if (insight) {
      res.json({ available: true, handle, insight });
    } else {
      res.json({ available: false, handle, insight: null });
    }
  });

  return router;
}
