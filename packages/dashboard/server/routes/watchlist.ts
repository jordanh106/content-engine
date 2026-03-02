import { Router } from "express";
import path from "path";
import { parseWatchlist } from "../parsers/watchlist.js";

export function createWatchlistRouter(contentLibraryPath: string) {
  const router = Router();
  const watchlistPath = path.join(path.dirname(contentLibraryPath), "watchlist.md");

  // GET /api/watchlist - list all tracked creators
  router.get("/", (_req, res) => {
    const creators = parseWatchlist(watchlistPath);
    res.json({ creators, total: creators.length });
  });

  return router;
}
