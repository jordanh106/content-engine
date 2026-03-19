import { Router } from "express";
import { parseViralInsights, listDigestDates } from "../parsers/viral-insights.js";

export function createViralInsightsRouter(viralInsightsDir: string) {
  const router = Router();

  router.get("/latest", (_req, res) => {
    try {
      const digest = parseViralInsights(viralInsightsDir);
      const dates = listDigestDates(viralInsightsDir);
      res.json({ digest, availableDates: dates });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
